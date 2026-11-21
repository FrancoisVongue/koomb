import { useSearchParams } from 'react-router';
import { Paginated } from '@/lib/paginated';

/** The current page number, kept in the `?page=` query so it survives a refresh. */
export const usePageParam = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Paginated.parsePage(searchParams.get('page'));
  const setPage = (next: number) => setSearchParams(next === 1 ? {} : { page: String(next) });
  return [page, setPage] as const;
};
