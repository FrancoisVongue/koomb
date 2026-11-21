import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { match } from 'venum';
import { type AddPageOutcome, addPage } from '@/api/pages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = { onAdded: () => void };

export function AddPageForm({ onAdded }: Props) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOutcome = (outcome: AddPageOutcome) =>
    match(outcome, {
      created: () => {
        setUrl('');
        toast.success('Page added', { description: 'Scraping has started.' });
        onAdded();
      },
      alreadyExists: ({ message, page }) => {
        toast.warning(message, { description: page.url });
      },
      invalid: ({ message }) => {
        toast.error(message);
      },
    });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    addPage(url.trim())
      .then(handleOutcome, () => toast.error('Could not reach the server. Please try again.'))
      .finally(() => setSubmitting(false));
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="text"
        inputMode="url"
        placeholder="Add new page"
        aria-label="Page URL"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        className="h-9"
      />
      <Button type="submit" size="lg" disabled={submitting || url.trim() === ''} className="px-4">
        Scrape
      </Button>
    </form>
  );
}
