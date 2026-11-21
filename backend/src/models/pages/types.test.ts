import { venum } from 'venum';
import { describe, expect, it } from 'vitest';
import { T0 } from '../../services/testing.ts';
import { type Page, PageUrl, Pagination, ScrapedPage, ScrapeFailure } from './types.ts';

describe('PageUrl.parse', () => {
  it('normalizes URLs so the same page is detected as a duplicate', () => {
    expect(PageUrl.parse('  https://EXAMPLE.com/Path?q=1#frag ')).toEqual({
      tag: 'ok',
      data: 'https://example.com/Path?q=1',
    });
    expect(PageUrl.parse('https://example.com')).toEqual({
      tag: 'ok',
      data: 'https://example.com/',
    });
  });

  it('accepts only http and https', () => {
    expect(PageUrl.parse('example.com').tag).toBe('invalid');
    expect(PageUrl.parse('javascript:alert(1)').tag).toBe('invalid');
    expect(PageUrl.parse('file:///etc/passwd').tag).toBe('invalid');
  });
});

describe('Pagination.parse', () => {
  it('defaults to the first page of 20 and rejects out-of-range values', () => {
    expect(Pagination.parse({})).toEqual({ tag: 'ok', data: { page: 1, pageSize: 20 } });
    expect(Pagination.parse({ page: '0' }).tag).toBe('invalid');
    expect(Pagination.parse({ page: '1.5' }).tag).toBe('invalid');
    expect(Pagination.parse({ pageSize: '101' }).tag).toBe('invalid');
  });
});

describe('ScrapedPage.fromHtml', () => {
  it('uses the <title> as page name and the anchor body as link name', () => {
    const page = ScrapedPage.fromHtml(
      `<title>W3</title><a href='https://www.w3schools.com'>Visit W3Schools.com!</a>`,
      'https://example.com/',
    );

    expect(page).toEqual({
      title: 'W3',
      links: [{ href: 'https://www.w3schools.com/', name: 'Visit W3Schools.com!' }],
    });
  });
});

describe('ScrapeFailure.outcome', () => {
  const attempted = (attempts: number): Page => ({
    id: 1,
    url: 'https://example.com/',
    title: null,
    status: 'processing',
    error: null,
    attempts,
    createdAt: T0,
    updatedAt: T0,
  });

  it('retries temporary failures until the last attempt', () => {
    const timeout = venum('timeout', { timeoutMs: 10_000 });

    expect(ScrapeFailure.outcome(timeout, attempted(1))).toEqual({
      error: 'The page did not answer within 10 s',
      retry: true,
    });
    expect(ScrapeFailure.outcome(timeout, attempted(3)).retry).toBe(false);
  });

  it('never retries permanent failures', () => {
    const notFound = venum('badStatus', { status: 404 });
    const blocked = venum('blocked', { hostname: 'localhost' });
    const unavailable = venum('badStatus', { status: 503 });

    expect(ScrapeFailure.outcome(notFound, attempted(1)).retry).toBe(false);
    expect(ScrapeFailure.outcome(blocked, attempted(1)).retry).toBe(false);
    expect(ScrapeFailure.outcome(unavailable, attempted(1)).retry).toBe(true);
  });
});
