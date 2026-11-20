import type { ReactNode } from 'react';
import { match } from 'venum';
import { AddPageForm } from '@/components/AddPageForm';
import { PagePagination } from '@/components/PagePagination';
import { PagesTable } from '@/components/PagesTable';
import { usePageEvents } from '@/hooks/usePageEvents';
import { usePageParam } from '@/hooks/usePageParam';
import { usePages } from '@/hooks/usePages';
import { Paginated } from '@/lib/paginated';

export function PagesListPage() {
  const [page, setPage] = usePageParam();
  const { state, reload } = usePages(page);

  usePageEvents(reload);

  const showFirstPage = () => (page === 1 ? reload() : setPage(1));

  return (
    <div className="flex flex-col gap-6">
      <AddPageForm onAdded={showFirstPage} />
      {match(state, {
        loading: () => <Message>Loading pages…</Message>,
        failed: ({ message }) => <Message>Could not load the pages: {message}</Message>,
        ready: (pages) => (
          <>
            <section className="rounded-xl border bg-card">
              <PagesTable pages={pages.items} />
            </section>
            <PagePagination page={page} pageCount={Paginated.pageCount(pages)} />
          </>
        ),
      })}
    </div>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">{children}</p>
    </section>
  );
}
