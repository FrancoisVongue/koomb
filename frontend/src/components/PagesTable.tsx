import { Trash2Icon } from 'lucide-react';
import { Link } from 'react-router';
import type { Api } from 'shared';
import { LinkCount } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageView } from '@/lib/page-view';

type Props = { pages: Api.Page[]; onDelete: (page: Api.Page) => void };

export function PagesTable({ pages, onDelete }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="w-32 text-right">Total links</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {pages.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
              No pages yet. Add a URL above to scrape it.
            </TableCell>
          </TableRow>
        )}
        {pages.map((page) => (
          <TableRow key={page.id}>
            <TableCell className="max-w-0 truncate">
              <Link
                to={`/pages/${page.id}`}
                title={page.url}
                className="font-medium hover:underline underline-offset-4"
              >
                {PageView.name(page)}
              </Link>
            </TableCell>
            <TableCell className="text-right">
              <LinkCount page={page} />
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${PageView.name(page)}`}
                title="Delete"
                onClick={() => onDelete(page)}
              >
                <Trash2Icon />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
