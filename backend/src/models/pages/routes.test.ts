import type { Api } from 'shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.ts';
import { createTestServices, fakeFetcher, htmlPage, startServer } from '../../services/testing.ts';

const URL_A = 'https://a.test/';
const HTML_A =
  '<title>Page A</title><a href="/1">One</a><a href="/2">Two</a><a href="/3">Three</a>';

let close: () => Promise<void> = async () => {};
afterEach(() => close());

const start = async () => {
  const test = createTestServices({ fetcher: fakeFetcher({ [URL_A]: htmlPage(URL_A, HTML_A) }) });
  const server = await startServer(createApp(test.services));
  close = server.close;
  const api = (path: string, init?: RequestInit) => fetch(`${server.url}/api${path}`, init);
  const post = async (body: unknown) => {
    const res = await api('/pages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const get = async (path: string) => (await api(path)).json();
  return { ...test, api, post, get };
};

describe('POST /api/pages', () => {
  it('answers right away with the queued page and scrapes it in the background', async () => {
    const { post, get, background } = await start();

    const res = await post({ url: URL_A });

    expect(res).toMatchObject({ status: 201, body: { url: URL_A, status: 'queued' } });
    await background.flush();
    expect(await get(`/pages/${res.body.id}`)).toMatchObject({ page: { status: 'done' } });
  });

  it('answers 409 with the existing page when the URL was already added', async () => {
    const { post } = await start();
    const first = await post({ url: URL_A });

    const again = await post({ url: 'https://A.test/#top' });

    expect(again).toEqual({
      status: 409,
      body: { message: 'This page was already added', page: first.body },
    });
  });

  it('answers 400 with a message for an invalid URL', async () => {
    const { post } = await start();

    expect(await post({ url: 'ftp://a.test/' })).toEqual({
      status: 400,
      body: { message: 'Only http and https URLs are supported' },
    });
  });
});

describe('GET /api/pages', () => {
  it('pages through pages newest first, with status and link count', async () => {
    const { post, get, background } = await start();
    await post({ url: URL_A });
    await background.flush();
    await post({ url: 'https://b.test/' });

    const first: Api.Paginated<Api.Page> = await get('/pages?page=1&pageSize=1');
    const second: Api.Paginated<Api.Page> = await get('/pages?page=2&pageSize=1');

    expect(first).toMatchObject({
      total: 2,
      items: [{ url: 'https://b.test/', status: 'queued' }],
    });
    expect(second.items).toMatchObject([{ title: 'Page A', status: 'done', linkCount: 3 }]);
  });
});

describe('GET /api/pages/:id', () => {
  it('returns the page and a page of its links', async () => {
    const { post, get, background } = await start();
    const { body: page } = await post({ url: URL_A });
    await background.flush();

    const detail: Api.PageDetail = await get(`/pages/${page.id}?page=2&pageSize=2`);

    expect(detail.links).toEqual({
      page: 2,
      pageSize: 2,
      total: 3,
      items: [{ id: expect.any(Number), href: 'https://a.test/3', name: 'Three' }],
    });
  });

  it('answers 404 for an unknown page', async () => {
    const { api } = await start();

    expect((await api('/pages/999')).status).toBe(404);
  });
});

describe('DELETE /api/pages/:id', () => {
  it('removes the page and its links, then answers 404 for it', async () => {
    const { post, api, services, background } = await start();
    const { body: page } = await post({ url: URL_A });
    await background.flush();

    const deleted = await api(`/pages/${page.id}`, { method: 'DELETE' });
    const again = await api(`/pages/${page.id}`, { method: 'DELETE' });

    expect(deleted.status).toBe(204);
    expect(again.status).toBe(404);
    const links = await services.db.links.listByPage(page.id, { page: 1, pageSize: 10 });
    expect(links.total).toBe(0);
  });
});

describe('GET /api/pages/events', () => {
  it('streams page updates and heartbeats, and cleans up when the client leaves', async () => {
    const { post, api, scheduler } = await start();
    const client = new AbortController();
    const res = await api('/pages/events', { signal: client.signal });
    const reader = res.body?.pipeThrough(new TextDecoderStream()).getReader();
    if (!reader) throw new Error('no body');
    await reader.read(); // ": connected"

    const { body: page } = await post({ url: URL_A });
    expect((await reader.read()).value).toBe(
      `event: page.updated\ndata: {"id":${page.id},"status":"queued"}\n\n`,
    );
    await scheduler.tick();
    expect((await reader.read()).value).toBe(': heartbeat\n\n');

    client.abort();
    await vi.waitFor(() => expect(scheduler.active()).toBe(0));
  });
});
