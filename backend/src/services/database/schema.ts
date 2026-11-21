import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const pages = sqliteTable(
  'pages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    url: text('url').notNull().unique(),
    title: text('title'),
    status: text('status', { enum: ['queued', 'processing', 'done', 'failed'] }).notNull(),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('pages_status_idx').on(table.status, table.updatedAt)],
);

export const links = sqliteTable(
  'links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    pageId: integer('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    href: text('href').notNull(),
    name: text('name').notNull(),
  },
  (table) => [index('links_page_id_idx').on(table.pageId)],
);
