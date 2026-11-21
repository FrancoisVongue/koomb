import { venum } from 'venum';
import type { PageFetcher } from '../../services/fetcher.ts';
import type { Services } from '../../services/index.ts';
import { listLinks } from '../links/controller.ts';
import {
  type AddPageInput,
  Page,
  type PageDetailQuery,
  type PageId,
  type Pagination,
  ScrapedPage,
  ScrapeFailure,
  Sweep,
} from './types.ts';

// Expected outcomes are venum values. Infrastructure failures (e.g. the
// database is down) are thrown and reach the global error handler.

/** Adds a URL: saves it as queued and starts scraping it without waiting. */
export const addPage = async (services: Services, input: AddPageInput) => {
  const now = services.clock.now();
  const result = await services.db.pages.createIfNew(input.url, now);
  if (result.tag === 'alreadyExists') {
    return result;
  }

  const page = result.data;
  const event = Page.toEvent(page);
  services.events.pageUpdated(event);
  services.background.run(() => scrapePage(services, page.id));

  return result;
};

/** The pages list, newest first, with link counts and statuses. */
export const listPages = async (services: Services, pagination: Pagination) => {
  const pages = await services.db.pages.list(pagination);
  return venum('ok', pages);
};

/** One page and a page of its links. */
export const getPage = async (services: Services, query: PageDetailQuery) => {
  const page = await services.db.pages.findById(query.id);
  if (!page) {
    return venum('notFound', { message: `Page ${query.id} not found` });
  }

  const links = await listLinks(services, page.id, query.links);
  return venum('ok', { page, links });
};

/** Removes a page and its links. */
export const deletePage = async (services: Services, id: PageId) => {
  const deleted = await services.db.pages.delete(id);
  if (!deleted) {
    return venum('notFound', { message: `Page ${id} not found` });
  }

  return venum('deleted');
};

/** Scrapes a page right after it was added. Skipped if the sweep took it first. */
export const scrapePage = async (services: Services, pageId: PageId) => {
  const now = services.clock.now();
  const page = await services.db.pages.claim(pageId, now);
  if (!page) {
    return venum('skipped');
  }

  const result = await scrape(services, page);
  return result;
};

/** Re-queues stuck pages, then scrapes a batch of queued ones. Run by cron.ts. */
export const sweep = async (services: Services) => {
  const now = services.clock.now();
  const stuckBefore = Sweep.stuckBefore(now);
  const requeued = await services.db.pages.requeueStuck(stuckBefore, now, Page.MAX_ATTEMPTS);
  const batch = await services.db.pages.claimQueued(Sweep.BATCH_SIZE, now);

  // allSettled: one page failing (e.g. a database error) must not lose the others.
  const settled = await Promise.allSettled(batch.map((page) => scrape(services, page)));
  const errors = settled.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
  if (errors.length > 0) {
    throw new AggregateError(errors, `Sweep: ${errors.length} page(s) failed to scrape`);
  }

  const results = settled.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  return venum('swept', { requeued, results });
};

/**
 * Fetches a claimed page and stores its links, or the failure. The page may
 * have been deleted meanwhile: then there is nothing to store or announce.
 */
const scrape = async (services: Services, page: Page) => {
  const processing = Page.toEvent(page);
  services.events.pageUpdated(processing);

  const fetched = await services.fetcher.fetchPage(page.url);
  const updated = await storeResult(services, page, fetched);
  if (!updated) {
    return venum('gone', { id: page.id });
  }

  const finished = Page.toEvent(updated);
  services.events.pageUpdated(finished);
  return venum('scraped', finished);
};

/** A tag check, not match: venum's `_` handler does not narrow to the failures. */
const storeResult = (services: Services, page: Page, fetched: PageFetcher.Result) =>
  fetched.tag === 'ok'
    ? storeLinks(services, page, fetched.data)
    : storeFailure(services, page, fetched);

/** Saves the title and links and marks the page done, in one transaction. */
const storeLinks = (services: Services, page: Page, fetched: PageFetcher.Fetched) => {
  const scraped = ScrapedPage.fromHtml(fetched.html, fetched.url);
  const now = services.clock.now();
  return services.db.pages.complete(page.id, scraped, now);
};

const storeFailure = (services: Services, page: Page, failure: PageFetcher.Failure) => {
  const outcome = ScrapeFailure.outcome(failure, page);
  const now = services.clock.now();
  return services.db.pages.fail(page.id, outcome, now);
};
