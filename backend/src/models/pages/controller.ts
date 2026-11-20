import { venum } from 'venum';
import type { Services } from '../../services/index.ts';
import { scrapePage } from '../scrape/controller.ts';
import { type AddPageInput, Page, type PageDetailQuery, type Pagination } from './types.ts';

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

  const links = await services.db.links.listByPage(page.id, query.links);
  return venum('ok', { page, links });
};
