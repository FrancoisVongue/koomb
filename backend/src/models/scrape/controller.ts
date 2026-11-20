import type { Api } from 'shared';
import { venum } from 'venum';
import type { PageFetcher } from '../../services/fetcher.ts';
import type { Services } from '../../services/index.ts';
import { Page } from '../pages/types.ts';
import { ScrapedPage, ScrapeFailure, Sweep } from './types.ts';

/** Scrapes a page right after it was added. Skipped if the sweep took it first. */
export const scrapePage = async (services: Services, pageId: number) => {
  const now = services.clock.now();
  const page = await services.db.pages.claim(pageId, now);
  if (!page) {
    return venum('skipped');
  }

  const result = await scrape(services, page);
  return venum('scraped', result);
};

/** Runs on a schedule: re-queues stuck pages, then scrapes a batch of queued ones. */
export const sweep = async (services: Services) => {
  const now = services.clock.now();
  const stuckBefore = Sweep.stuckBefore(now);
  const requeued = await services.db.pages.requeueStuck(stuckBefore, now);
  const batch = await services.db.pages.claimQueued(Sweep.BATCH_SIZE, now);

  const scraped = await Promise.all(batch.map((page) => scrape(services, page)));

  return venum('swept', { requeued, scraped });
};

/** Fetches a claimed page and stores its links, or the failure. */
const scrape = async (services: Services, page: Page): Promise<Api.PageUpdatedEvent> => {
  const processing = Page.toEvent(page);
  services.events.pageUpdated(processing);

  const fetched = await services.fetcher.fetchPage(page.url);
  const updated = await storeResult(services, page, fetched);

  const finished = Page.toEvent(updated);
  services.events.pageUpdated(finished);
  return finished;
};

/** A tag check, not match: venum's `_` handler does not narrow to the failures. */
const storeResult = (services: Services, page: Page, fetched: PageFetcher.Result) =>
  fetched.tag === 'ok'
    ? storeLinks(services, page, fetched.data)
    : storeFailure(services, page, fetched);

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
