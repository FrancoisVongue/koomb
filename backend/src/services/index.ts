import type { Config } from '../config.ts';
import { type Background, createBackground } from './background.ts';
import { type Clock, createClock } from './clock.ts';
import { createDatabase, type Database } from './database/index.ts';
import { createEvents, type Events } from './events.ts';
import { createPageFetcher, DEFAULT_FETCHER_OPTIONS, type PageFetcher } from './fetcher.ts';
import { createScheduler, type Scheduler } from './scheduler.ts';

/** Everything external or async the app uses. Built once, in src/index.ts. */
export type Services = {
  db: Database;
  fetcher: PageFetcher;
  events: Events;
  scheduler: Scheduler;
  background: Background;
  clock: Clock;
};

export const createServices = (config: Config): Services => ({
  db: createDatabase(config.databaseFile),
  fetcher: createPageFetcher({ ...DEFAULT_FETCHER_OPTIONS, delayMs: config.scrapeDelayMs }),
  events: createEvents(),
  scheduler: createScheduler(),
  background: createBackground(),
  clock: createClock(),
});
