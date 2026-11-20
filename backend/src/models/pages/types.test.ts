import { describe, expect, it } from 'vitest';
import { PageUrl, Pagination } from './types.ts';

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
