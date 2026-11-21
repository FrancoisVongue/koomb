import type { Api } from 'shared';

export namespace Paginated {
  /** A page entry in the pagination bar: a page number or a gap. */
  export type Entry = number | 'gap';

  /** Number of pages; at least 1 so an empty list still shows "page 1 of 1". */
  export const pageCount = (list: Api.Paginated<unknown>): number =>
    Math.max(1, Math.ceil(list.total / list.pageSize));

  /** Reads `?page=` from the URL; anything that is not a positive integer is page 1. */
  export const parsePage = (raw: string | null): number => {
    const page = Number(raw);
    return Number.isInteger(page) && page >= 1 ? page : 1;
  };

  /** First, last, and the pages around the current one, with gaps in between. */
  export const entries = (current: number, count: number): Entry[] => {
    const pages = [...new Set([1, current - 1, current, current + 1, count])]
      .filter((page) => page >= 1 && page <= count)
      .sort((a, b) => a - b);
    return pages.flatMap((page, index): Entry[] => {
      const previous = pages[index - 1];
      return previous !== undefined && page - previous > 1 ? ['gap', page] : [page];
    });
  };
}
