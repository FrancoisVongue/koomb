import { EventEmitter } from 'node:events';
import type { Api } from 'shared';

/** In-process event bus. The worker publishes; the SSE route subscribes. */
export type Events = {
  pageUpdated(event: Api.PageUpdatedEvent): void;
  /** Returns the function that unsubscribes. */
  onPageUpdated(listener: (event: Api.PageUpdatedEvent) => void): () => void;
};

export const createEvents = (): Events => {
  const emitter = new EventEmitter();
  // One listener per open SSE connection: no meaningful limit.
  emitter.setMaxListeners(0);
  return {
    pageUpdated: (event) => {
      emitter.emit('page.updated', event);
    },
    onPageUpdated: (listener) => {
      emitter.on('page.updated', listener);
      return () => {
        emitter.off('page.updated', listener);
      };
    },
  };
};
