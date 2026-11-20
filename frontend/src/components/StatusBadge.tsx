import { CircleAlertIcon, LoaderCircleIcon } from 'lucide-react';
import type { Api } from 'shared';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Props = { page: Api.Page };

/** "in progress", "failed" (error on hover) or "done". */
export function StatusBadge({ page }: Props) {
  switch (page.status) {
    case 'queued':
    case 'processing':
      return (
        <Badge variant="secondary">
          <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
          in progress
        </Badge>
      );
    case 'failed':
      return (
        <Tooltip>
          <TooltipTrigger
            render={
              <Badge variant="outline" className="cursor-help text-muted-foreground">
                <CircleAlertIcon data-icon="inline-start" />
                failed
              </Badge>
            }
          />
          <TooltipContent>{page.error ?? 'The page could not be scraped.'}</TooltipContent>
        </Tooltip>
      );
    case 'done':
      return <Badge variant="outline">done</Badge>;
  }
}

/** The number of links once the page is scraped, its status otherwise. */
export function LinkCount({ page }: Props) {
  if (page.status === 'done') return <span className="tabular-nums">{page.linkCount}</span>;
  return <StatusBadge page={page} />;
}
