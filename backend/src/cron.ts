import cron from 'node-cron';
import { sweep } from './models/pages/controller.ts';
import type { Services } from './services/index.ts';

/** Every 10 seconds. */
const SWEEP_SCHEDULE = '*/10 * * * * *';

/**
 * Entrance 2, by time (entrance 1 is HTTP, in app.ts): the safety net for
 * pages that were missed or got stuck, e.g. after a restart.
 * Returns the function that stops it.
 */
export const startCron = (services: Services) => {
  const task = cron.schedule(
    SWEEP_SCHEDULE,
    () => sweep(services).catch((error: unknown) => console.error('Sweep failed:', error)),
    { noOverlap: true },
  );
  return () => {
    void task.stop();
  };
};
