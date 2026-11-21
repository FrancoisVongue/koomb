import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPageFetcher, isPrivateAddress } from './fetcher.ts';

const HTML = '<title>Local</title><a href="/a">A</a>';

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/ok') res.writeHead(200, { 'content-type': 'text/html' }).end(HTML);
    else if (req.url === '/redirect') res.writeHead(302, { location: '/ok' }).end();
    else if (req.url === '/json')
      res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
    else if (req.url === '/big')
      res.writeHead(200, { 'content-type': 'text/html' }).end('x'.repeat(5_000));
    else if (req.url === '/slow') setTimeout(() => res.end(HTML), 500);
    else if (req.url === '/loop') res.writeHead(302, { location: '/loop' }).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
});

const options = { timeoutMs: 200, maxBytes: 1_000, maxRedirects: 3 };
// The test server is on 127.0.0.1, so private addresses are allowed here.
const fetcher = createPageFetcher({ ...options, allowPrivateAddresses: true });

describe('page fetcher', () => {
  it('follows redirects and returns the HTML with the URL it ended on', async () => {
    expect(await fetcher.fetchPage(`${base}/redirect`)).toEqual({
      tag: 'ok',
      data: { html: HTML, url: `${base}/ok` },
    });
  });

  it('turns every way a page can fail into an outcome', async () => {
    expect((await fetcher.fetchPage(`${base}/json`)).tag).toBe('notHtml');
    expect((await fetcher.fetchPage(`${base}/big`)).tag).toBe('tooLarge');
    expect((await fetcher.fetchPage(`${base}/slow`)).tag).toBe('timeout');
    expect((await fetcher.fetchPage(`${base}/loop`)).tag).toBe('tooManyRedirects');
    expect((await fetcher.fetchPage('http://127.0.0.1:1/')).tag).toBe('unreachable');
  });

  it('blocks private addresses (SSRF)', async () => {
    const strict = createPageFetcher({ ...options, allowPrivateAddresses: false });

    expect((await strict.fetchPage(`${base}/ok`)).tag).toBe('blocked');
    expect((await strict.fetchPage('http://[::ffff:127.0.0.1]/')).tag).toBe('blocked');
    // The address check resolves the host first: an unknown host is unreachable.
    expect((await strict.fetchPage('http://no-such-host.invalid/')).tag).toBe('unreachable');
  });

  it('tells private addresses from public ones', () => {
    for (const address of ['10.1.2.3', '169.254.169.254', '::1', 'fd00::1', '::ffff:7f00:1']) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
    for (const address of ['8.8.8.8', '2606:4700::1111', '::ffff:808:808']) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });
});
