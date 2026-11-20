import { describe, expect, it } from 'vitest';
import { Html } from '../../lib/html.ts';
import { Link } from './types.ts';

const linksOf = (html: string, pageUrl = 'https://example.com/') => {
  const parsed = Html.parse(html);
  const links = Link.fromAnchors(parsed.anchors, parsed.baseHref, pageUrl);
  return links;
};

describe('Link.fromAnchors', () => {
  it('resolves relative links against the page URL, or <base> when there is one', () => {
    const page = 'https://example.com/company/index.html';

    const plain = linksOf('<a href="/about">a</a><a href="team">t</a>', page);
    const based = linksOf('<base href="/docs/"><a href="intro">i</a>', page);

    expect(plain.map((l) => l.href)).toEqual([
      'https://example.com/about',
      'https://example.com/company/team',
    ]);
    expect(based.map((l) => l.href)).toEqual(['https://example.com/docs/intro']);
  });

  it('drops unusable hrefs and keeps each link once, fragments ignored, first name wins', () => {
    const links = linksOf(
      `<a>none</a><a href="">empty</a><a href="javascript:void(0)">js</a>
       <a href="/a#intro">First</a><a href="https://example.com/a#usage">Second</a>`,
    );

    expect(links).toEqual([{ href: 'https://example.com/a', name: 'First' }]);
  });

  it('names a link by its visible text only, or by its label when it has no text', () => {
    const links = linksOf(
      `<a href="/1"> <i class="icon"></i><b>Home</b>
         <!-- <span>old</span> --> <span>page</span><script>track()</script></a>
       <a href="/2"><img src="logo.png" alt="Company logo"></a>
       <a href="/3" aria-label="Close"><svg></svg></a>
       <a href="/4"><img src="x.png"></a>`,
    );

    expect(links.map((l) => l.name)).toEqual(['Home page', 'Company logo', 'Close', '']);
  });
});
