import type { Api } from 'shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LinkView } from '@/lib/page-view';

type Props = { links: Api.Link[]; emptyText: string };

export function LinksTable({ links, emptyText }: Props) {
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-2/5">Name</TableHead>
          <TableHead>URL</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {links.length === 0 && (
          <TableRow>
            <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
              {emptyText}
            </TableCell>
          </TableRow>
        )}
        {links.map((link) => (
          <TableRow key={link.id}>
            <TableCell className="truncate font-medium" title={LinkView.name(link)}>
              {LinkView.name(link)}
            </TableCell>
            <TableCell className="truncate">
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                title={link.href}
                className="text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
              >
                {link.href}
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
