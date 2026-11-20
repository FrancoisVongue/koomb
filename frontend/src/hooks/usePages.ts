import { useCallback } from 'react';
import { fetchPages } from '@/api/pages';
import { useRemoteData } from './useRemoteData';

/** One page of the scraped pages list. */
export const usePages = (page: number) => {
  const load = useCallback(() => fetchPages(page), [page]);
  return useRemoteData(load);
};
