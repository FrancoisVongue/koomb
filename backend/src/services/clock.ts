export type Clock = {
  now(): Date;
};

export const createClock = (): Clock => ({
  now: () => new Date(),
});
