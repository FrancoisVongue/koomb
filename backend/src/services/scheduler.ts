/** Timers used inside the app (the SSE heartbeat). Returns the function that stops it. */
export type Scheduler = {
  interval(ms: number, task: () => void): () => void;
};

export const createScheduler = (): Scheduler => ({
  interval: (ms, task) => {
    const timer = setInterval(task, ms);
    return () => clearInterval(timer);
  },
});
