import { CircleAlert, SearchX, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isApiError } from '../../api/client';
import { errorMessage } from '../../lib/errors';
import { Button } from './Button';

const KINDS = {
  'not-found': {
    icon: SearchX,
    title: 'Not found',
    text: 'This page does not exist, or you do not have access to it.',
  },
  forbidden: {
    icon: ShieldAlert,
    title: 'Not allowed',
    text: 'Your role does not have access to this page.',
  },
  error: { icon: CircleAlert, title: 'Something went wrong', text: 'Please try again.' },
};

interface ErrorStateProps {
  kind: keyof typeof KINDS;
  message?: string;
  onRetry?: () => void;
}

/** Full-area state for 404 / 403 / failures when loading a page. */
export function ErrorState({ kind, message, onRetry }: ErrorStateProps) {
  const { icon: Icon, title, text } = KINDS[kind];
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <Icon className="size-10 text-fg-subtle" aria-hidden />
      <h1 className="text-lg font-semibold text-fg-strong">{title}</h1>
      <p className="max-w-md text-fg-subtle">{message ?? text}</p>
      <div className="mt-2 flex gap-2">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Link
          to="/"
          className="inline-flex h-8 items-center rounded-md px-3 text-primary hover:underline"
        >
          Go to Your work
        </Link>
      </div>
    </div>
  );
}

/**
 * Maps a failed page query to the right state. A 404 also covers records outside the user's
 * scope: the API does not reveal that they exist.
 */
export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (isApiError(error) && error.status === 404) return <ErrorState kind="not-found" />;
  if (isApiError(error) && error.status === 403) return <ErrorState kind="forbidden" />;
  return <ErrorState kind="error" message={errorMessage(error)} {...(onRetry && { onRetry })} />;
}
