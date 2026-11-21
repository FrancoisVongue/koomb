export type PageId = number;

export namespace PageId {
  /** Reads the `:id` route parameter; `null` when it is not a positive integer. */
  export const parse = (raw: string | undefined): PageId | null => {
    const id = Number(raw);
    return Number.isInteger(id) && id >= 1 ? id : null;
  };
}
