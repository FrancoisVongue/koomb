import * as cheerio from 'cheerio';

/** What an HTML document contains, as written; no business rules applied. */
export type ParsedHtml = {
  title: string | null;
  baseHref: string | null;
  anchors: Html.Anchor[];
};

export namespace Html {
  export type Anchor = {
    href: string | null;
    /** The visible text, like `innerText`: no tags, no comments, no scripts, whitespace collapsed. */
    text: string;
    /** A text alternative when the anchor has no text: `aria-label`, `title`, or an image's `alt`. */
    label: string | null;
  };

  export const parse = (html: string): ParsedHtml => {
    const $ = cheerio.load(html);
    const title = clean($('title').first().text());
    return {
      title: title === '' ? null : title,
      baseHref: $('base[href]').first().attr('href') ?? null,
      anchors: $('a')
        .toArray()
        .map((element) => {
          const anchor = $(element).clone();
          anchor.find('script, style, noscript, template').remove();
          return {
            href: anchor.attr('href') ?? null,
            text: clean(anchor.text()),
            label: firstNonEmpty([
              anchor.attr('aria-label'),
              anchor.attr('title'),
              anchor.find('img[alt]').first().attr('alt'),
            ]),
          };
        }),
    };
  };

  const clean = (text: string): string => text.replace(/\s+/g, ' ').trim();

  const firstNonEmpty = (values: (string | undefined)[]): string | null =>
    values.map((value) => clean(value ?? '')).find((value) => value !== '') ?? null;
}
