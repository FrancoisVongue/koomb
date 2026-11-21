/** Runs work after the request has been answered, without waiting for it. */
export type Background = {
  run(task: () => Promise<unknown>): void;
};

export const createBackground = (
  onError: (error: unknown) => void = (error) => console.error('Background task failed', error),
): Background => ({
  run: (task) => {
    task().catch(onError);
  },
});
