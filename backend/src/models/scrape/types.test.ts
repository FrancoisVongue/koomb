import { venum } from 'venum';
import { describe, expect, it } from 'vitest';
import { T0 } from '../../services/testing.ts';
import type { Page } from '../pages/types.ts';
import { ScrapedPage, ScrapeFailure } from './types.ts';

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

  it('resolves relative links against the page URL, or <base> when there is one', () => {
    const page = 'https://example.com/company/index.html';

    const plain = ScrapedPage.fromHtml('<a href="/about">a</a><a href="team">t</a>', page);
    const based = ScrapedPage.fromHtml('<base href="/docs/"><a href="intro">i</a>', page);

    expect(plain.links.map((l) => l.href)).toEqual([
      'https://example.com/about',
      'https://example.com/company/team',
    ]);
    expect(based.links.map((l) => l.href)).toEqual(['https://example.com/docs/intro']);
  });

  it('drops unusable hrefs and keeps each link once, fragments ignored, first name wins', () => {
    const { links } = ScrapedPage.fromHtml(
      `<a>none</a><a href="">empty</a><a href="javascript:void(0)">js</a>
       <a href="/a#intro">First</a><a href="https://example.com/a#usage">Second</a>`,
      'https://example.com/',
    );

    expect(links).toEqual([{ href: 'https://example.com/a', name: 'First' }]);
  });

  it('names a link by its visible text only, or by its label when it has no text', () => {
    const { links } = ScrapedPage.fromHtml(
      `<a href="/1"> <i class="icon"></i><b>Home</b>
         <!-- <span>old</span> --> <span>page</span><script>track()</script></a>
       <a href="/2"><img src="logo.png" alt="Company logo"></a>
       <a href="/3" aria-label="Close"><svg></svg></a>
       <a href="/4"><img src="x.png"></a>`,
      'https://example.com/',
    );

    expect(links.map((l) => l.name)).toEqual(['Home page', 'Company logo', 'Close', '']);
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
    expect(ScrapeFailure.outcome(venum('badStatus', { status: 404 }), attempted(1)).retry).toBe(
      false,
    );
    expect(
      ScrapeFailure.outcome(venum('blocked', { hostname: 'localhost' }), attempted(1)).retry,
    ).toBe(false);
    expect(ScrapeFailure.outcome(venum('badStatus', { status: 503 }), attempted(1)).retry).toBe(
      true,
    );
  });
});
