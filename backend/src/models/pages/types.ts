import type { Api } from 'shared';
import { match, venum } from 'venum';
import { Html } from '../../lib/html.ts';
import type { PageFetcher } from '../../services/fetcher.ts';
import { Link } from '../links/types.ts';

export type Page = {
  id: number;
  url: string;
  title: string | null;
  status: Page.Status;
  error: string | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
};

export namespace Page {
  export type Status = Api.PageStatus;
  export type WithLinkCount = Page & { linkCount: number };

  /** A failed scrape is retried until the page has been attempted this many times. */
  export const MAX_ATTEMPTS = 3;

  export const toApi = (page: WithLinkCount): Api.Page => ({
    id: page.id,
    url: page.url,
    title: page.title,
    status: page.status,
    error: page.error,
    linkCount: page.linkCount,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  });

  export const toEvent = (page: Page): Api.PageUpdatedEvent => ({
    id: page.id,
    status: page.status,
  });
}

/** An absolute http(s) URL, normalized so the same page always has the same string. */
export type PageUrl = string;

export namespace PageUrl {
  export const parse = (raw: unknown) => {
    if (typeof raw !== 'string' || raw.trim() === '') {
      return venum('invalid', { message: 'A URL is required' });
    }
    if (!URL.canParse(raw.trim())) {
      return venum('invalid', { message: 'This is not a valid URL' });
    }
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return venum('invalid', { message: 'Only http and https URLs are supported' });
    }
    // URL already lowercases the host; the fragment never changes the page.
    url.hash = '';
    return venum('ok', url.toString() as PageUrl);
  };
}

export type AddPageInput = { url: PageUrl };

export namespace AddPageInput {
  export const parse = (body: unknown) => {
    const raw = typeof body === 'object' && body !== null && 'url' in body ? body.url : undefined;
    const url = PageUrl.parse(raw);
    if (url.tag === 'invalid') return url;
    return venum('ok', { url: url.data } satisfies AddPageInput);
  };
}

export type Pagination = { page: number; pageSize: number };

export namespace Pagination {
  export const DEFAULT_PAGE_SIZE = 20;
  export const MAX_PAGE_SIZE = 100;

  /** Parses `?page=&pageSize=`; both are optional. */
  export const parse = (query: Record<string, unknown>) => {
    const page = positiveInteger(query.page, 1);
    const pageSize = positiveInteger(query.pageSize, DEFAULT_PAGE_SIZE);
    if (page === undefined) {
      return venum('invalid', { message: '`page` must be a positive integer' });
    }
    if (pageSize === undefined || pageSize > MAX_PAGE_SIZE) {
      return venum('invalid', {
        message: `\`pageSize\` must be an integer between 1 and ${MAX_PAGE_SIZE}`,
      });
    }
    return venum('ok', { page, pageSize } satisfies Pagination);
  };

  export const offset = (pagination: Pagination): number =>
    (pagination.page - 1) * pagination.pageSize;

  export const toApi = <T, R>(
    pagination: Pagination,
    result: { items: T[]; total: number },
    map: (item: T) => R,
  ): Api.Paginated<R> => ({
    items: result.items.map(map),
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: result.total,
  });

  const positiveInteger = (value: unknown, fallback: number): number | undefined => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
    const n = Number(value);
    return n >= 1 ? n : undefined;
  };
}

export type PageId = number;

export namespace PageId {
  export const parse = (raw: unknown) => {
    if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1) {
      return venum('invalid', { message: 'Page id must be a positive integer' });
    }
    return venum('ok', Number(raw) as PageId);
  };
}

/** Input of GET /api/pages/:id: the page id and the pagination of its links. */
export type PageDetailQuery = { id: PageId; links: Pagination };

export namespace PageDetailQuery {
  export const parse = (rawId: unknown, query: Record<string, unknown>) => {
    const id = PageId.parse(rawId);
    if (id.tag === 'invalid') return id;
    const links = Pagination.parse(query);
    if (links.tag === 'invalid') return links;
    return venum('ok', { id: id.data, links: links.data } satisfies PageDetailQuery);
  };
}

/** What we keep from a scraped page: its title and its links. */
export type ScrapedPage = { title: string | null; links: Link.Scraped[] };

export namespace ScrapedPage {
  export const fromHtml = (html: string, pageUrl: string): ScrapedPage => {
    const parsed = Html.parse(html);
    const links = Link.fromAnchors(parsed.anchors, parsed.baseHref, pageUrl);
    return { title: parsed.title, links };
  };
}

/** Why fetching a page failed, and whether to try again. */
export namespace ScrapeFailure {
  /** What is recorded after a failed attempt. */
  export type Outcome = { error: string; retry: boolean };

  export const describe = (failure: PageFetcher.Failure): string =>
    match(failure, {
      timeout: ({ timeoutMs }) => `The page did not answer within ${timeoutMs / 1000} s`,
      unreachable: ({ reason }) => `The page could not be reached (${reason})`,
      badStatus: ({ status }) => `The page answered with HTTP ${status}`,
      notHtml: ({ contentType }) => `Not an HTML page (${contentType || 'no content type'})`,
      tooLarge: ({ maxBytes }) => `The page is larger than ${maxBytes / (1024 * 1024)} MB`,
      blocked: ({ hostname }) => `${hostname} is a private or local address`,
      tooManyRedirects: ({ maxRedirects }) => `More than ${maxRedirects} redirects`,
    });

  /** Failures that may go away on their own: worth another attempt. */
  export const isTemporary = (failure: PageFetcher.Failure): boolean =>
    match(failure, {
      timeout: () => true,
      unreachable: () => true,
      badStatus: ({ status }) => status >= 500 || status === 429,
      _: () => false,
    });

  /** What to record after a failed attempt on `page`. */
  export const outcome = (failure: PageFetcher.Failure, page: Page): Outcome => ({
    error: describe(failure),
    retry: isTemporary(failure) && page.attempts < Page.MAX_ATTEMPTS,
  });
}

/** The safety net that cron.ts runs: stuck and queued pages. */
export namespace Sweep {
  export const STUCK_AFTER_MS = 2 * 60 * 1000;
  export const BATCH_SIZE = 5;

  export const stuckBefore = (now: Date): Date => new Date(now.getTime() - STUCK_AFTER_MS);
}
