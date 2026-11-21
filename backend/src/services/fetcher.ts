import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { venum } from 'venum';

export type FetcherOptions = {
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  /** Only for tests against a local server. */
  allowPrivateAddresses: boolean;
  /** Artificial wait before each fetch, to see "in progress" in development. */
  delayMs?: number;
};

export const DEFAULT_FETCHER_OPTIONS: FetcherOptions = {
  timeoutMs: 10_000,
  maxBytes: 5 * 1024 * 1024,
  maxRedirects: 5,
  allowPrivateAddresses: false,
};

export type PageFetcher = {
  fetchPage(url: string): Promise<PageFetcher.Result>;
};

export namespace PageFetcher {
  export type Result = Awaited<ReturnType<typeof fetchPage>>;
  /** A downloaded page: its HTML and the URL it ended on after redirects. */
  export type Fetched = Extract<Result, { tag: 'ok' }>['data'];
  export type Failure = Exclude<Result, { tag: 'ok' }>;
}

export const createPageFetcher = (
  options: FetcherOptions = DEFAULT_FETCHER_OPTIONS,
): PageFetcher => ({
  fetchPage: (url) => fetchPage(url, options),
});

/**
 * Downloads an HTML page. Every way the target page can fail is an outcome,
 * never an exception. Redirects are followed by hand so that each hop goes
 * through the private-address check.
 */
const fetchPage = async (url: string, options: FetcherOptions) => {
  if (options.delayMs) {
    await sleep(options.delayMs);
  }

  const signal = AbortSignal.timeout(options.timeoutMs);
  let current = url;

  for (let hop = 0; hop <= options.maxRedirects; hop++) {
    const address = await checkAddress(current, options);
    if (address.tag !== 'ok') return address;

    const response = await request(current, signal, options);
    if (response.tag !== 'ok') return response;
    const res = response.data;

    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location !== null) {
      await res.body?.cancel();
      if (!URL.canParse(location, current)) {
        return venum('badRedirect', { location });
      }
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      return venum('badStatus', { status: res.status });
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('text/html')) {
      await res.body?.cancel();
      return venum('notHtml', { contentType });
    }

    const body = await readBody(res, signal, options);
    if (body.tag !== 'ok') return body;
    return venum('ok', { html: body.data, url: current });
  }

  return venum('tooManyRedirects', { maxRedirects: options.maxRedirects });
};

const checkAddress = async (url: string, options: FetcherOptions) => {
  if (options.allowPrivateAddresses) return venum('ok');
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
  const addresses = await resolve(hostname);
  if (addresses.tag !== 'ok') return addresses;
  if (addresses.data.some(isPrivateAddress)) {
    return venum('blocked', { hostname });
  }
  return venum('ok');
};

// dns.lookup and fetch report failures by throwing: these two functions are
// the boundary where those throws become outcomes.

const resolve = async (hostname: string) => {
  if (isIP(hostname) !== 0) return venum('ok', [hostname]);
  try {
    const results = await lookup(hostname, { all: true });
    return venum(
      'ok',
      results.map((result) => result.address),
    );
  } catch {
    return venum('unreachable', { reason: `could not resolve ${hostname}` });
  }
};

const request = async (url: string, signal: AbortSignal, options: FetcherOptions) => {
  try {
    const res = await fetch(url, {
      signal,
      redirect: 'manual',
      headers: { accept: 'text/html' },
    });
    return venum('ok', res);
  } catch (error) {
    if (isTimeout(error)) return venum('timeout', { timeoutMs: options.timeoutMs });
    return venum('unreachable', { reason: errorReason(error) });
  }
};

const readBody = async (res: Response, signal: AbortSignal, options: FetcherOptions) => {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > options.maxBytes) {
    await res.body?.cancel();
    return venum('tooLarge', { maxBytes: options.maxBytes });
  }
  if (res.body === null) return venum('ok', '');

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > options.maxBytes) {
        await reader.cancel();
        return venum('tooLarge', { maxBytes: options.maxBytes });
      }
      chunks.push(value);
    }
  } catch (error) {
    if (signal.aborted || isTimeout(error))
      return venum('timeout', { timeoutMs: options.timeoutMs });
    return venum('unreachable', { reason: errorReason(error) });
  }
  return venum('ok', new TextDecoder().decode(Buffer.concat(chunks)));
};

const isTimeout = (error: unknown): boolean =>
  error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');

const errorReason = (error: unknown): string => {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Error && 'code' in cause && typeof cause.code === 'string')
    return cause.code;
  return error instanceof Error ? error.message : String(error);
};

const privateRanges = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv6');
}

/** Loopback, private, link-local and unspecified addresses (IPv4, IPv6, IPv4-mapped IPv6). */
export const isPrivateAddress = (address: string): boolean => {
  const mapped = ipv4FromMapped(address);
  if (mapped !== undefined) return privateRanges.check(mapped, 'ipv4');
  return privateRanges.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
};

/** `::ffff:127.0.0.1`, or `::ffff:7f00:1` as URL normalizes it, to `127.0.0.1`. */
const ipv4FromMapped = (address: string): string | undefined => {
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (dotted?.[1] !== undefined) return dotted[1];
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
  if (hex?.[1] === undefined || hex[2] === undefined) return undefined;
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
};
