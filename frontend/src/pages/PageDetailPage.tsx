import { ArrowLeftIcon, ExternalLinkIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { Api } from 'shared';
import { match } from 'venum';
import { LinksTable } from '@/components/LinksTable';
import { PagePagination } from '@/components/PagePagination';
import { StatusBadge } from '@/components/StatusBadge';
import { usePageDetail } from '@/hooks/usePageDetail';
import { usePageEvents } from '@/hooks/usePageEvents';
import { usePageParam } from '@/hooks/usePageParam';
import { PageId } from '@/lib/page-id';
import { PageView } from '@/lib/page-view';
import { Paginated } from '@/lib/paginated';

export function PageDetailPage() {
  const id = PageId.parse(useParams().id);
  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        All pages
      </Link>
      {id === null ? <Message>This page does not exist.</Message> : <PageDetail id={id} />}
    </div>
  );
}

function PageDetail({ id }: { id: PageId }) {
  const [page] = usePageParam();
  const { state, reload } = usePageDetail(id, page);

  usePageEvents((event) => {
    if (event === null || event.id === id) reload();
  });

  return match(state, {
    loading: () => <Message>Loading…</Message>,
    failed: ({ message }) => <Message>Could not load the page: {message}</Message>,
    ready: (result) =>
      match(result, {
        notFound: ({ message }) => <Message>{message}</Message>,
        found: ({ page: scraped, links }) => (
          <>
            <PageHeader page={scraped} />
            <section className="rounded-xl border bg-card">
              <LinksTable links={links.items} emptyText={emptyText(scraped)} />
            </section>
            <PagePagination page={page} pageCount={Paginated.pageCount(links)} />
          </>
        ),
      }),
  });
}

function PageHeader({ page }: { page: Api.Page }) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{PageView.name(page)}</h2>
        <StatusBadge page={page} />
      </div>
      <a
        href={page.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-fit items-center gap-1.5 text-sm break-all text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
      >
        {page.url}
        <ExternalLinkIcon className="size-3.5 shrink-0" />
      </a>
      {page.status === 'done' && (
        <p className="text-sm text-muted-foreground">
          {page.linkCount} {page.linkCount === 1 ? 'link' : 'links'} found
        </p>
      )}
      {page.status === 'failed' && page.error && (
        <p className="text-sm text-muted-foreground">{page.error}</p>
      )}
    </header>
  );
}

const emptyText = (page: Api.Page): string => {
  if (PageView.isInProgress(page)) return 'Scraping in progress…';
  if (page.status === 'failed') return 'The page could not be scraped.';
  return 'No links were found on this page.';
};

function Message({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
