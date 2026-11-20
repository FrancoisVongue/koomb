import cron from 'node-cron';

/** Timers. Each function returns the function that stops it. */
export type Scheduler = {
  /** Runs `task` on a cron expression (seconds field supported); a run never overlaps the previous one. */
  cron(expression: string, task: () => Promise<unknown>): () => void;
  interval(ms: number, task: () => void): () => void;
};

export const createScheduler = (
  onError: (error: unknown) => void = (error) => console.error('Scheduled task failed', error),
): Scheduler => ({
  cron: (expression, task) => {
    const scheduled = cron.schedule(expression, () => task().catch(onError), { noOverlap: true });
    return () => {
      void scheduled.stop();
    };
  },
  interval: (ms, task) => {
    const timer = setInterval(task, ms);
    return () => clearInterval(timer);
  },
});
