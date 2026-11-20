import type { Api } from 'shared';
import { venum } from 'venum';
import { describe, expect, it } from 'vitest';
import { createTestServices, fakeFetcher, htmlPage } from '../../services/testing.ts';
import { scrapePage, sweep } from './controller.ts';

const URL_A = 'https://a.test/';

const setup = (pages: Parameters<typeof fakeFetcher>[0]) => {
  const test = createTestServices({ fetcher: fakeFetcher(pages) });
  const events: Api.PageUpdatedEvent[] = [];
  test.services.events.onPageUpdated((event) => events.push(event));
  const add = async (url: string) => {
    const result = await test.services.db.pages.createIfNew(url, test.clock.now());
    if (result.tag !== 'created') throw new Error('expected a new page');
    return result.data;
  };
  return { ...test, events, add };
};

describe('scrapePage', () => {
  it('stores the title and links and announces each status', async () => {
    const { services, events, add } = setup({
      [URL_A]: htmlPage(URL_A, '<title>A</title><a href="/1">1</a><a href="/2">2</a>'),
    });
    const page = await add(URL_A);

    await scrapePage(services, page.id);

    expect(await services.db.pages.findById(page.id)).toMatchObject({
      status: 'done',
      title: 'A',
      linkCount: 2,
    });
    expect(events.map((e) => e.status)).toEqual(['processing', 'done']);
  });

  it('queues the page again after a temporary failure', async () => {
    const { services, add } = setup({ [URL_A]: venum('timeout', { timeoutMs: 10_000 }) });
    const page = await add(URL_A);

    await scrapePage(services, page.id);

    expect(await services.db.pages.findById(page.id)).toMatchObject({
      status: 'queued',
      attempts: 1,
    });
  });

  it('marks the page failed, with the reason, after a permanent failure', async () => {
    const { services, add } = setup({
      [URL_A]: venum('notHtml', { contentType: 'application/pdf' }),
    });
    const page = await add(URL_A);

    await scrapePage(services, page.id);

    expect(await services.db.pages.findById(page.id)).toMatchObject({
      status: 'failed',
      error: 'Not an HTML page (application/pdf)',
    });
  });
});

describe('sweep', () => {
  it('re-scrapes a page stuck in processing for more than two minutes', async () => {
    const { services, clock, add } = setup({ [URL_A]: htmlPage(URL_A, '<a href="/1">1</a>') });
    const page = await add(URL_A);
    await services.db.pages.claim(page.id, clock.now());

    clock.advance(60_000);
    await sweep(services);
    expect(await services.db.pages.findById(page.id)).toMatchObject({ status: 'processing' });

    clock.advance(61_000);
    await sweep(services);
    expect(await services.db.pages.findById(page.id)).toMatchObject({ status: 'done' });
  });

  it('gives up after three temporary failures', async () => {
    const { services, add } = setup({ [URL_A]: venum('timeout', { timeoutMs: 10_000 }) });
    const page = await add(URL_A);

    await scrapePage(services, page.id);
    await sweep(services);
    await sweep(services);
    await sweep(services);

    expect(await services.db.pages.findById(page.id)).toMatchObject({
      status: 'failed',
      attempts: 3,
    });
  });
});
