import type { Api } from 'shared';
import { venum } from 'venum';

// The one place that knows the API URLs and status codes. Expected outcomes
// (400, 404, 409) are returned as venum values; anything else is a real
// failure and is thrown.

export const PAGE_SIZE = 20;

export const PAGE_EVENTS_URL = '/api/pages/events';

const json = <T>(response: Response): Promise<T> => response.json() as Promise<T>;

const unexpected = (response: Response): Error =>
  new Error(`Unexpected response from the server (HTTP ${response.status})`);

const pageQuery = (page: number): string =>
  new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) }).toString();

export const fetchPages = async (page: number): Promise<Api.Paginated<Api.Page>> => {
  const response = await fetch(`/api/pages?${pageQuery(page)}`);
  if (!response.ok) throw unexpected(response);
  return json<Api.Paginated<Api.Page>>(response);
};

export const fetchPageDetail = async (id: number, page: number) => {
  const response = await fetch(`/api/pages/${id}?${pageQuery(page)}`);
  if (response.ok) return venum('found', await json<Api.PageDetail>(response));
  if (response.status === 404) return venum('notFound', await json<Api.ErrorBody>(response));
  throw unexpected(response);
};

export const addPage = async (url: string) => {
  const response = await fetch('/api/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (response.status === 201) return venum('created', await json<Api.Page>(response));
  if (response.status === 409) {
    return venum('alreadyExists', await json<Api.AlreadyExistsBody>(response));
  }
  if (response.status === 400) return venum('invalid', await json<Api.ErrorBody>(response));
  throw unexpected(response);
};

export type AddPageOutcome = Awaited<ReturnType<typeof addPage>>;
