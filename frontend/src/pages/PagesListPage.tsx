import type { ReactNode } from 'react';
import type { Api } from 'shared';
import { toast } from 'sonner';
import { match } from 'venum';
import { deletePage } from '@/api/pages';
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

  const removePage = async (removed: Api.Page) => {
    const result = await deletePage(removed.id);
    match(result, {
      deleted: () => {
        toast.success('Page deleted', { description: removed.url });
      },
      notFound: () => {
        toast.warning('This page was already deleted');
      },
    });
    reload();
  };

  const handleDelete = (removed: Api.Page) => {
    removePage(removed).catch(() => toast.error('Could not reach the server. Please try again.'));
  };

  return (
    <div className="flex flex-col gap-6">
      <AddPageForm onAdded={showFirstPage} />
      {match(state, {
        loading: () => <Message>Loading pages…</Message>,
        failed: ({ message }) => <Message>Could not load the pages: {message}</Message>,
        ready: (pages) => (
          <>
            <section className="rounded-xl border bg-card">
              <PagesTable pages={pages.items} onDelete={handleDelete} />
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
