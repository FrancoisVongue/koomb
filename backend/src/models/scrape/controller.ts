import type { Api } from 'shared';
import { venum } from 'venum';
import type { PageFetcher } from '../../services/fetcher.ts';
import type { Services } from '../../services/index.ts';
import { Page } from '../pages/types.ts';
import { ScrapedPage, ScrapeFailure, Sweep } from './types.ts';

/** Scrapes a page right after it was added. Skipped if the sweep took it first. */
export const scrapePage = async (services: Services, pageId: number) => {
  const page = await services.db.pages.claim(pageId, services.clock.now());
  if (!page) return venum('skipped');

  return venum('scraped', await scrape(services, page));
};

/** Runs on a schedule: re-queues stuck pages, then scrapes a batch of queued ones. */
export const sweep = async (services: Services) => {
  const now = services.clock.now();
  const requeued = await services.db.pages.requeueStuck(Sweep.stuckBefore(now), now);
  const batch = await services.db.pages.claimQueued(Sweep.BATCH_SIZE, now);

  const scraped = await Promise.all(batch.map((page) => scrape(services, page)));

  return venum('swept', { requeued, scraped });
};

/** Fetches a claimed page and stores its links, or the failure. */
const scrape = async (services: Services, page: Page): Promise<Api.PageUpdatedEvent> => {
  services.events.pageUpdated(Page.toEvent(page));

  const fetched = await services.fetcher.fetchPage(page.url);
  // A tag check, not match: venum's `_` handler does not narrow to the failures.
  const updated =
    fetched.tag === 'ok'
      ? await storeLinks(services, page, fetched.data)
      : await storeFailure(services, page, fetched);

  services.events.pageUpdated(Page.toEvent(updated));
  return Page.toEvent(updated);
};

const storeLinks = (services: Services, page: Page, { html, url }: PageFetcher.Fetched) =>
  services.db.pages.complete(page.id, ScrapedPage.fromHtml(html, url), services.clock.now());

const storeFailure = (services: Services, page: Page, failure: PageFetcher.Failure) =>
  services.db.pages.fail(page.id, ScrapeFailure.outcome(failure, page), services.clock.now());
