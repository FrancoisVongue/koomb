import { match } from 'venum';
import { Html } from '../../lib/html.ts';
import type { PageFetcher } from '../../services/fetcher.ts';
import { Page } from '../pages/types.ts';

export type ScrapedLink = { href: string; name: string };

/** What we keep from a scraped page. */
export type ScrapedPage = { title: string | null; links: ScrapedLink[] };

export namespace ScrapedPage {
  export const NAME_MAX_LENGTH = 500;

  /**
   * Applies our link rules to the page's anchors: hrefs resolved against the
   * page URL (and `<base>`) without their `#fragment`, empty and `javascript:`
   * hrefs dropped, each resolved href kept once (first name wins).
   */
  export const fromHtml = (html: string, pageUrl: string): ScrapedPage => {
    const parsed = Html.parse(html);
    const base = baseUrl(parsed.baseHref, pageUrl);
    const seen = new Set<string>();
    const links = parsed.anchors.flatMap((anchor) => {
      const href = resolveHref(anchor.href, base);
      if (href === undefined || seen.has(href)) return [];
      seen.add(href);
      return [{ href, name: linkName(anchor) }];
    });
    return { title: parsed.title, links };
  };

  const baseUrl = (baseHref: string | null, pageUrl: string): string =>
    baseHref !== null && URL.canParse(baseHref, pageUrl)
      ? new URL(baseHref, pageUrl).toString()
      : pageUrl;

  const resolveHref = (raw: string | null, base: string): string | undefined => {
    const href = raw?.trim() ?? '';
    if (href === '' || !URL.canParse(href, base)) return undefined;
    const url = new URL(href, base);
    if (url.protocol === 'javascript:') return undefined;
    // `/a#intro` and `/a#usage` are the same page.
    url.hash = '';
    return url.toString();
  };

  /** The visible text; for a link without text (an icon, an image), its label; else empty. */
  const linkName = (anchor: Html.Anchor): string =>
    (anchor.text || anchor.label || '').slice(0, NAME_MAX_LENGTH);
}

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

/** The cron safety net. */
export namespace Sweep {
  /** Every 10 seconds. */
  export const SCHEDULE = '*/10 * * * * *';
  export const STUCK_AFTER_MS = 2 * 60 * 1000;
  export const BATCH_SIZE = 5;

  export const stuckBefore = (now: Date): Date => new Date(now.getTime() - STUCK_AFTER_MS);
}
