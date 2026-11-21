import type { Api } from 'shared';
import type { Html } from '../../lib/html.ts';

export type Link = {
  id: number;
  pageId: number;
  href: string;
  name: string;
};

export namespace Link {
  /** A link found on a scraped page, before it is stored. */
  export type Scraped = { href: string; name: string };

  export const NAME_MAX_LENGTH = 500;

  export const toApi = (link: Link): Api.Link => ({
    id: link.id,
    href: link.href,
    name: link.name,
  });

  /**
   * Our link rules: hrefs resolved against the page URL (and `<base>`) without
   * their `#fragment`, empty and `javascript:` hrefs dropped, each resolved
   * href kept once (first name wins).
   */
  export const fromAnchors = (
    anchors: Html.Anchor[],
    baseHref: string | null,
    pageUrl: string,
  ): Scraped[] => {
    const base = baseUrl(baseHref, pageUrl);
    const seen = new Set<string>();
    return anchors.flatMap((anchor) => {
      const href = resolveHref(anchor.href, base);
      if (href === undefined || seen.has(href)) return [];
      seen.add(href);
      return [{ href, name: name(anchor) }];
    });
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
  const name = (anchor: Html.Anchor): string =>
    (anchor.text || anchor.label || '').slice(0, NAME_MAX_LENGTH);
}
