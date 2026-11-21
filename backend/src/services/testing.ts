// Test helpers: a Services container with fakes. Never imported by app code.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { venum } from 'venum';
import type { Background } from './background.ts';
import type { Clock } from './clock.ts';
import { createDatabase } from './database/index.ts';
import { createEvents } from './events.ts';
import type { PageFetcher } from './fetcher.ts';
import type { Services } from './index.ts';
import type { Scheduler } from './scheduler.ts';

export const T0 = new Date('2026-01-01T00:00:00Z');

/** A clock that only moves when the test says so. */
export const fakeClock = (start = T0) => {
  let now = start;
  return {
    now: (): ReturnType<Clock['now']> => now,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
};

/** Collects background tasks; `flush()` runs them. */
export const fakeBackground = () => {
  const tasks: (() => Promise<unknown>)[] = [];
  return {
    run: ((task) => {
      tasks.push(task);
    }) satisfies Background['run'],
    pending: () => tasks.length,
    flush: async () => {
      while (tasks.length > 0) await tasks.shift()?.();
    },
  };
};

/** Never fires on its own; `tick()` runs every registered task once. */
export const fakeScheduler = () => {
  const tasks = new Set<() => unknown>();
  const add = (task: () => unknown) => {
    tasks.add(task);
    return () => {
      tasks.delete(task);
    };
  };
  return {
    interval: ((_ms, task) => add(task)) satisfies Scheduler['interval'],
    active: () => tasks.size,
    tick: async () => {
      for (const task of [...tasks]) await task();
    },
  };
};

/** Answers every URL from a map; unknown URLs are unreachable. */
export const fakeFetcher = (pages: Record<string, PageFetcher.Result> = {}): PageFetcher => ({
  fetchPage: async (url) => pages[url] ?? venum('unreachable', { reason: 'ENOTFOUND' }),
});

export const htmlPage = (url: string, html: string): PageFetcher.Result =>
  venum('ok', { html, url });

export const createTestServices = (overrides: Partial<Services> = {}) => {
  const clock = fakeClock();
  const background = fakeBackground();
  const scheduler = fakeScheduler();
  const services: Services = {
    db: createDatabase(':memory:'),
    fetcher: fakeFetcher(),
    events: createEvents(),
    scheduler,
    background,
    clock,
    ...overrides,
  };
  return { services, clock, background, scheduler };
};

/** Starts an app on a free port; returns its base URL and a close function. */
export const startServer = async (app: Express) => {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
};
