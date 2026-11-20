import { useEffect, useEffectEvent } from 'react';
import type { Api } from 'shared';
import { PAGE_EVENTS_URL } from '@/api/pages';

/**
 * Subscribes to the server's page events. `onChange` is called with the event
 * when a page changes, and with `null` when the stream (re)connects, since
 * events may have been missed while disconnected.
 */
export const usePageEvents = (onChange: (event: Api.PageUpdatedEvent | null) => void) => {
  const notify = useEffectEvent(onChange);

  useEffect(() => {
    const source = new EventSource(PAGE_EVENTS_URL);
    source.onopen = () => notify(null);
    source.addEventListener('page.updated', (message) => {
      notify(JSON.parse(message.data) as Api.PageUpdatedEvent);
    });
    return () => source.close();
  }, []);
};
