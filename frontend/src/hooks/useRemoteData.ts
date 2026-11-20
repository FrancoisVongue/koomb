import { useCallback, useEffect, useRef, useState } from 'react';
import { venum } from 'venum';

/** What a screen shows: still loading, the data, or why it could not be loaded. */
export type RemoteData<T> =
  | { readonly tag: 'loading'; readonly data: undefined }
  | { readonly tag: 'ready'; readonly data: T }
  | { readonly tag: 'failed'; readonly data: { message: string } };

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Runs `load` on mount and whenever `load` changes; `reload` runs it again.
 * Keeps showing the previous data while reloading, and ignores responses that
 * arrive after a newer request was started.
 */
export const useRemoteData = <T>(load: () => Promise<T>) => {
  const [state, setState] = useState<RemoteData<T>>(venum('loading'));
  const latestRequest = useRef(0);

  const reload = useCallback(() => {
    latestRequest.current += 1;
    const request = latestRequest.current;
    const isLatest = () => request === latestRequest.current;
    load().then(
      (data) => {
        if (isLatest()) setState(venum('ready', data));
      },
      (error: unknown) => {
        if (isLatest()) setState(venum('failed', { message: errorMessage(error) }));
      },
    );
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { state, reload };
};
