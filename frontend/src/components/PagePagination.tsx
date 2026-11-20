import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Paginated } from '@/lib/paginated';

type Props = { page: number; pageCount: number };

const linkTo = (page: number) => ({ search: page === 1 ? '' : `?page=${page}` });

const disabled = {
  'aria-disabled': true,
  tabIndex: -1,
  className: 'pointer-events-none opacity-50',
};

/** Previous, page numbers, Next. Each one is a link to `?page=N`. */
export function PagePagination({ page, pageCount }: Props) {
  const hasPrevious = page > 1;
  const hasNext = page < pageCount;
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            to={linkTo(Math.max(1, page - 1))}
            {...(hasPrevious ? {} : disabled)}
          />
        </PaginationItem>
        {Paginated.entries(page, pageCount).map((entry, index) =>
          entry === 'gap' ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: gaps have no identity of their own
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationLink to={linkTo(entry)} isActive={entry === page}>
                {entry}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            to={linkTo(Math.min(pageCount, page + 1))}
            {...(hasNext ? {} : disabled)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
