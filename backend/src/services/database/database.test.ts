import { beforeEach, describe, expect, it } from 'vitest';
import { T0 } from '../testing.ts';
import { createDatabase, type Database } from './index.ts';

const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

let db: Database;
beforeEach(() => {
  db = createDatabase(':memory:');
});

const create = async (url: string, now = T0) => {
  const result = await db.pages.createIfNew(url, now);
  if (result.tag !== 'created') throw new Error(`expected ${url} to be new`);
  return result.data;
};

describe('database', () => {
  it('creates a page once per URL', async () => {
    const first = await create('https://example.com/');

    expect(await db.pages.createIfNew('https://example.com/', at(1))).toEqual({
      tag: 'alreadyExists',
      data: first,
    });
  });

  it('counts the links of each page, whatever the ids', async () => {
    const empty = await create('https://empty.test/', at(0));
    const full = await create('https://full.test/', at(1));
    const links = ['a', 'b', 'c'].map((n) => ({ href: `https://full.test/${n}`, name: n }));
    await db.pages.complete(full.id, { title: null, links }, at(2));

    const listed = await db.pages.list({ page: 1, pageSize: 10 });

    expect(listed.items.map((p) => [p.id, p.linkCount])).toEqual([
      [full.id, 3],
      [empty.id, 0],
    ]);
  });

  it('lets only one worker claim a queued page', async () => {
    const page = await create('https://example.com/');

    expect(await db.pages.claim(page.id, at(1))).toMatchObject({
      status: 'processing',
      attempts: 1,
    });
    expect(await db.pages.claim(page.id, at(1))).toBeUndefined();
    expect(await db.pages.claimQueued(5, at(1))).toEqual([]);
  });

  it('requeues only pages stuck in processing since before the cutoff', async () => {
    const stuck = await create('https://stuck.test/');
    const fresh = await create('https://fresh.test/');
    await db.pages.claim(stuck.id, at(0));
    await db.pages.claim(fresh.id, at(100));

    expect(await db.pages.requeueStuck(at(50), at(120))).toBe(1);
    expect(await db.pages.findById(stuck.id)).toMatchObject({ status: 'queued' });
  });

  it('replaces the links of a page when it is scraped again, beyond one insert chunk', async () => {
    const page = await create('https://example.com/');
    await db.pages.complete(
      page.id,
      { title: 'Old', links: [{ href: 'https://old/', name: 'o' }] },
      at(1),
    );
    const many = Array.from({ length: 1_234 }, (_, i) => ({
      href: `https://x/${i}`,
      name: `${i}`,
    }));

    await db.pages.complete(page.id, { title: 'New', links: many }, at(2));

    const links = await db.links.listByPage(page.id, { page: 1, pageSize: 1 });
    expect(links).toMatchObject({ total: 1_234, items: [{ href: 'https://x/0' }] });
  });
});
