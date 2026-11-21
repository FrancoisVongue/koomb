import type { Api } from 'shared';

/** How a scraped page is shown in the UI. */
export namespace PageView {
  /** The page title, or its URL while there is no title yet. */
  export const name = (page: Api.Page): string => page.title?.trim() || page.url;

  export const isInProgress = (page: Api.Page): boolean =>
    page.status === 'queued' || page.status === 'processing';
}

/** How a link found on a page is shown in the UI. */
export namespace LinkView {
  /** The link text, or its URL when the text is empty. */
  export const name = (link: Api.Link): string => link.name.trim() || link.href;
}
