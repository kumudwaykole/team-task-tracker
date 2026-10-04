import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { commentsApi } from '../../api/comments';
import type { Comment, Paginated, WorkItemDetail } from '../../api/types';
import { useCurrentUser } from '../../context/AuthContext';
import { errorMessage } from '../../lib/errors';
import { formatDateTime, timeAgo } from '../../lib/format';
import { Avatar } from '../ui/badges';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/form';
import { ListSkeleton } from '../ui/skeletons';

const PAGE_SIZE = 20;

type CommentPages = InfiniteData<Paginated<Comment>, number>;

/** Newest pages are fetched first and shown oldest-first; "Load older" pages backwards. */
export function Comments({ item }: { item: WorkItemDetail }) {
  const comments = useInfiniteQuery({
    queryKey: ['comments', item.id],
    queryFn: ({ pageParam, signal }) =>
      commentsApi.list(item.id, { page: pageParam, limit: PAGE_SIZE, order: 'desc' }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNext ? last.meta.page + 1 : undefined),
  });

  // A comment added locally shifts later pages by one, so de-duplicate by id.
  const seen = new Set<string>();
  const ordered = (comments.data?.pages.flatMap((page) => page.data) ?? [])
    .filter((comment) => !seen.has(comment.id) && seen.add(comment.id))
    .reverse();

  return (
    <section aria-labelledby="activity-heading" className="space-y-3">
      <h2 id="activity-heading" className="font-semibold text-fg-strong">
        Activity
      </h2>

      {comments.hasNextPage && (
        <Button
          size="sm"
          variant="subtle"
          loading={comments.isFetchingNextPage}
          onClick={() => void comments.fetchNextPage()}
        >
          Load older comments
        </Button>
      )}

      {comments.isPending ? (
        <ListSkeleton rows={3} />
      ) : ordered.length === 0 ? (
        <p className="flex items-center gap-2 text-fg-subtle">
          <MessageSquare className="size-4" aria-hidden /> No comments yet.
        </p>
      ) : (
        <ol className="space-y-4">
          {ordered.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar user={comment.user} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-fg-subtle">
                  <span className="font-semibold text-fg-strong">{comment.user.name}</span>
                  {' · '}
                  <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)}>
                    {timeAgo(comment.createdAt)}
                  </time>
                </p>
                {/* Plain text: React escapes it, and newlines are kept. */}
                <p className="mt-0.5 break-words whitespace-pre-wrap text-fg">{comment.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {item.permissions.canComment ? (
        <CommentForm itemId={item.id} />
      ) : (
        <p className="rounded-md bg-secondary px-3 py-2 text-fg-subtle">
          You can view this item but cannot comment.
        </p>
      )}
    </section>
  );
}

function CommentForm({ itemId }: { itemId: string }) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const add = useMutation({
    mutationFn: (text: string) => commentsApi.create(itemId, text),
    onSuccess: (comment) => {
      // Put the returned comment straight into the cache instead of refetching.
      queryClient.setQueryData<CommentPages>(['comments', itemId], (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page, index) =>
                index === 0
                  ? {
                      ...page,
                      data: [comment, ...page.data],
                      meta: { ...page.meta, total: page.meta.total + 1 },
                    }
                  : page,
              ),
            }
          : data,
      );
      queryClient.setQueryData<WorkItemDetail>(
        ['workItem', itemId],
        (item) => item && { ...item, _count: { comments: item._count.comments + 1 } },
      );
      setBody('');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = () => {
    const text = body.trim();
    if (text && !add.isPending) add.mutate(text);
  };

  return (
    <form
      className="flex gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Avatar user={user} />
      <div className="flex-1 space-y-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit();
          }}
          placeholder="Add a comment… (Ctrl+Enter to save)"
          aria-label="Add a comment"
          maxLength={2000}
          className="min-h-20"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={add.isPending}
          disabled={!body.trim()}
        >
          Save
        </Button>
      </div>
    </form>
  );
}
