// API contract between backend and frontend. Types only.

export namespace Api {
  export type PageStatus = 'queued' | 'processing' | 'done' | 'failed';

  export type Page = {
    id: number;
    url: string;
    title: string | null;
    status: PageStatus;
    error: string | null;
    linkCount: number;
    createdAt: string;
    updatedAt: string;
  };

  export type Link = {
    id: number;
    href: string;
    name: string;
  };

  export type Paginated<T> = {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
  };

  /** GET /api/pages/:id */
  export type PageDetail = {
    page: Page;
    links: Paginated<Link>;
  };

  /** Body of every 4xx/5xx response. */
  export type ErrorBody = {
    message: string;
  };

  /** 409 from POST /api/pages when the URL was already added. */
  export type AlreadyExistsBody = ErrorBody & {
    page: Page;
  };

  /** `data` of a `page.updated` event on GET /api/pages/events. */
  export type PageUpdatedEvent = {
    id: number;
    status: PageStatus;
  };
}
