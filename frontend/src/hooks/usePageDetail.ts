import { useCallback } from 'react';
import { fetchPageDetail } from '@/api/pages';
import { useRemoteData } from './useRemoteData';

/** One scraped page and one page of its links. */
export const usePageDetail = (id: number, page: number) => {
  const load = useCallback(() => fetchPageDetail(id, page), [id, page]);
  return useRemoteData(load);
};
