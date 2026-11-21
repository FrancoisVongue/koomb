import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Sqlite from 'better-sqlite3';
import { and, count, desc, eq, getTableColumns, gte, inArray, lt, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { venum } from 'venum';
import type { Link } from '../../models/links/types.ts';
import {
  type Page,
  Pagination,
  type ScrapedPage,
  type ScrapeFailure,
} from '../../models/pages/types.ts';
import * as schema from './schema.ts';

const { pages, links } = schema;

const MIGRATIONS = fileURLToPath(new URL('./migrations', import.meta.url));
/** SQLite caps bound parameters per statement; links are inserted in chunks. */
const INSERT_CHUNK = 500;

export type Database = ReturnType<typeof createDatabase>;

export type Paged<T> = { items: T[]; total: number };

/**
 * Opens (or creates) the SQLite database, applies migrations, and returns the
 * queries the app needs. Pass `':memory:'` for a throwaway database in tests.
 *
 * Methods are async even though better-sqlite3 is synchronous, so the rest of
 * the app doesn't depend on that.
 */
export const createDatabase = (file: string) => {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const sqlite = new Sqlite(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });

  const withLinkCount = {
    ...getTableColumns(pages),
    // Qualified by hand: Drizzle renders bare column names here, and a bare
    // "id" inside the subquery would mean links.id.
    linkCount: sql<number>`(select count(*) from "links" where "links"."page_id" = "pages"."id")`,
  };

  const findById = (id: number): Page.WithLinkCount | undefined =>
    db.select(withLinkCount).from(pages).where(eq(pages.id, id)).get();

  return {
    pages: {
      /** Inserts a `queued` page, unless a page with this URL already exists. */
      createIfNew: async (url: string, now: Date) =>
        db.transaction((tx) => {
          const existing = tx.select(withLinkCount).from(pages).where(eq(pages.url, url)).get();
          if (existing) return venum('alreadyExists', existing);
          const page = tx
            .insert(pages)
            .values({ url, status: 'queued', attempts: 0, createdAt: now, updatedAt: now })
            .returning()
            .get();
          return venum('created', { ...page, linkCount: 0 });
        }),

      findById: async (id: number) => findById(id),

      /** Deletes the page and, by cascade, its links. False if there was no such page. */
      delete: async (id: number): Promise<boolean> => {
        const result = db.delete(pages).where(eq(pages.id, id)).run();
        return result.changes > 0;
      },

      /** Newest first. */
      list: async (pagination: Pagination): Promise<Paged<Page.WithLinkCount>> => ({
        items: db
          .select(withLinkCount)
          .from(pages)
          .orderBy(desc(pages.createdAt), desc(pages.id))
          .limit(pagination.pageSize)
          .offset(Pagination.offset(pagination))
          .all(),
        total: db.select({ total: count() }).from(pages).get()?.total ?? 0,
      }),

      /**
       * Moves a `queued` page to `processing` and counts the attempt.
       * Returns undefined if the page is not queued (someone else took it).
       */
      claim: async (id: number, now: Date): Promise<Page | undefined> =>
        db
          .update(pages)
          .set({ status: 'processing', attempts: sql`${pages.attempts} + 1`, updatedAt: now })
          .where(and(eq(pages.id, id), eq(pages.status, 'queued')))
          .returning()
          .get(),

      /** Claims up to `limit` of the oldest `queued` pages. */
      claimQueued: async (limit: number, now: Date): Promise<Page[]> => {
        const ids = db
          .select({ id: pages.id })
          .from(pages)
          .where(eq(pages.status, 'queued'))
          .orderBy(pages.id)
          .limit(limit)
          .all()
          .map((row) => row.id);
        if (ids.length === 0) return [];
        return db
          .update(pages)
          .set({ status: 'processing', attempts: sql`${pages.attempts} + 1`, updatedAt: now })
          .where(and(inArray(pages.id, ids), eq(pages.status, 'queued')))
          .returning()
          .all();
      },

      /**
       * Pages `processing` since before `before` go back to `queued`, or to
       * `failed` once they have used all their attempts (so a scrape that keeps
       * crashing can't loop forever). Returns how many were re-queued.
       */
      requeueStuck: async (before: Date, now: Date, maxAttempts: number): Promise<number> =>
        db.transaction((tx) => {
          const stuck = and(eq(pages.status, 'processing'), lt(pages.updatedAt, before));
          tx.update(pages)
            .set({
              status: 'failed',
              error: `Gave up after ${maxAttempts} attempts`,
              updatedAt: now,
            })
            .where(and(stuck, gte(pages.attempts, maxAttempts)))
            .run();
          const requeued = tx
            .update(pages)
            .set({ status: 'queued', updatedAt: now })
            .where(stuck)
            .run();
          return requeued.changes;
        }),

      /**
       * Replaces the page's links and marks it `done`. Undefined if the page was
       * deleted while it was being scraped.
       */
      complete: async (
        id: number,
        scraped: ScrapedPage,
        now: Date,
      ): Promise<Page.WithLinkCount | undefined> =>
        db.transaction((tx) => {
          // Marked done first: this also checks the page still exists before any
          // link is written (links of a deleted page would break the foreign key).
          const page = tx
            .update(pages)
            .set({ status: 'done', title: scraped.title, error: null, updatedAt: now })
            .where(eq(pages.id, id))
            .returning()
            .get();
          if (!page) return undefined;

          tx.delete(links).where(eq(links.pageId, id)).run();
          for (let i = 0; i < scraped.links.length; i += INSERT_CHUNK) {
            const chunk = scraped.links.slice(i, i + INSERT_CHUNK);
            tx.insert(links)
              .values(chunk.map((link) => ({ pageId: id, ...link })))
              .run();
          }
          return { ...page, linkCount: scraped.links.length };
        }),

      /**
       * Records a failed attempt: back to `queued` if it will be retried, else
       * `failed`. Undefined if the page was deleted while it was being scraped.
       */
      fail: async (
        id: number,
        failure: ScrapeFailure.Outcome,
        now: Date,
      ): Promise<Page.WithLinkCount | undefined> => {
        db.update(pages)
          .set({
            status: failure.retry ? 'queued' : 'failed',
            error: failure.error,
            updatedAt: now,
          })
          .where(eq(pages.id, id))
          .run();
        return findById(id);
      },
    },

    links: {
      listByPage: async (pageId: number, pagination: Pagination): Promise<Paged<Link>> => ({
        items: db
          .select()
          .from(links)
          .where(eq(links.pageId, pageId))
          .orderBy(links.id)
          .limit(pagination.pageSize)
          .offset(Pagination.offset(pagination))
          .all(),
        total:
          db.select({ total: count() }).from(links).where(eq(links.pageId, pageId)).get()?.total ??
          0,
      }),
    },

    close: () => sqlite.close(),
  };
};
