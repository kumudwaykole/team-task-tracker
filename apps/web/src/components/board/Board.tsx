import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { Params } from '../../api/client';
import type { Board as BoardData, BoardColumn, Status, WorkItem } from '../../api/types';
import { workItemsApi } from '../../api/workItems';
import { cx } from '../../lib/cx';
import { errorMessage } from '../../lib/errors';
import { formatDate, isOverdue } from '../../lib/format';
import { itemKey, STATUS_LABELS } from '../../lib/labels';
import { Avatar, PriorityIcon, TypeIcon } from '../ui/badges';
import { Button } from '../ui/Button';

export const PER_COLUMN = 20;

interface BoardProps {
  board: BoardData;
  queryKey: QueryKey;
  /** Filters for "load more", which pages through the normal list endpoint. */
  listParams: Params;
  /** Changes whenever the board data changes; resets the columns' extra pages. */
  version: number;
}

const itemOf = (data: unknown) => (data as { item: WorkItem }).item;

/** Pointer first (precise), falling back to overlap for keyboard dragging. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

/** Moves a card between columns in the cached board (optimistic update). */
function moveCard(board: BoardData, item: WorkItem, to: Status): BoardData {
  return {
    ...board,
    columns: board.columns.map((column) => {
      if (column.status === item.status) {
        return {
          ...column,
          total: column.total - 1,
          items: column.items.filter((card) => card.id !== item.id),
        };
      }
      if (column.status === to) {
        // Its next moves are unknown until the server answers, so it cannot be dragged again yet.
        const moved = { ...item, status: to, allowedTransitions: [] };
        return { ...column, total: column.total + 1, items: [moved, ...column.items] };
      }
      return column;
    }),
  };
}

export function Board({ board, queryKey, listParams, version }: BoardProps) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<WorkItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const move = useMutation({
    mutationFn: ({ item, to }: { item: WorkItem; to: Status }) =>
      workItemsApi.update(item.id, { status: to }),
    onMutate: async ({ item, to }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BoardData>(queryKey);
      queryClient.setQueryData<BoardData>(
        queryKey,
        (current) => current && moveCard(current, item, to),
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(errorMessage(error));
    },
    onSettled: () => {
      // The server is the authority: refetch (also covers STALE_STATE and INVALID_TRANSITION).
      for (const key of ['board', 'workItems', 'summary']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  const onDragStart = ({ active: dragged }: DragStartEvent) =>
    setActive(itemOf(dragged.data.current));

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    setActive(null);
    const item = itemOf(dragged.data.current);
    const to = over?.id as Status | undefined;
    if (!to || to === item.status) return;
    if (!item.allowedTransitions.includes(to)) {
      toast.error(`${STATUS_LABELS[item.status]} → ${STATUS_LABELS[to]} is not allowed`);
      return;
    }
    move.mutate({ item, to });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {board.columns.map((column) => (
          <Column
            key={`${column.status}-${version}`}
            column={column}
            active={active}
            listParams={listParams}
          />
        ))}
      </div>
      <DragOverlay>{active && <CardBody item={active} lifted />}</DragOverlay>
    </DndContext>
  );
}

interface ColumnProps {
  column: BoardColumn;
  active: WorkItem | null;
  listParams: Params;
}

function Column({ column, active, listParams }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  const [extra, setExtra] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);

  const items = [...column.items, ...extra];
  // While dragging, columns the card may move to light up; the others dim.
  const canDrop = !!active && active.allowedTransitions.includes(column.status);
  const dimmed = !!active && !canDrop && active.status !== column.status;

  const loadMore = async () => {
    setLoading(true);
    try {
      // The board's order matches `sortBy=priority&order=desc`, so list pages continue it.
      const next = await workItemsApi.list({
        ...listParams,
        status: [column.status],
        sortBy: 'priority',
        order: 'desc',
        limit: PER_COLUMN,
        page: Math.floor(items.length / PER_COLUMN) + 1,
      });
      const shown = new Set(items.map((item) => item.id));
      setExtra((current) => [...current, ...next.data.filter((item) => !shown.has(item.id))]);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      ref={setNodeRef}
      aria-label={`${STATUS_LABELS[column.status]}: ${column.total} items`}
      className={cx(
        'flex w-72 shrink-0 flex-col rounded-lg bg-sunken p-2 transition-[opacity,background-color]',
        canDrop && 'bg-selected',
        canDrop && isOver && 'ring-2 ring-primary',
        dimmed && 'opacity-40',
      )}
    >
      <h2 className="flex items-center gap-2 px-1 pb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
        {STATUS_LABELS[column.status]}
        <span className="rounded-full bg-secondary px-1.5 text-fg">{column.total}</span>
      </h2>
      <div className="flex min-h-24 flex-col gap-2">
        {items.map((item) => (
          <DraggableCard key={item.id} item={item} />
        ))}
      </div>
      {items.length < column.total && (
        <Button size="sm" variant="subtle" loading={loading} onClick={loadMore} className="mt-2">
          Load more ({column.total - items.length})
        </Button>
      )}
    </section>
  );
}

function DraggableCard({ item }: { item: WorkItem }) {
  const movable = item.allowedTransitions.length > 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
    disabled: !movable,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${itemKey(item)} ${item.title}`}
      className={cx('rounded-md', movable && 'cursor-grab', isDragging && 'opacity-30')}
    >
      <CardBody item={item} />
    </div>
  );
}

function CardBody({ item, lifted }: { item: WorkItem; lifted?: boolean }) {
  return (
    <article
      className={cx(
        'rounded-md border border-border bg-surface p-2.5 transition-colors hover:bg-hover',
        lifted && 'rotate-2 shadow-overlay',
      )}
    >
      <Link
        to={`/work-items/${item.id}`}
        className="line-clamp-2 text-fg-strong hover:text-primary hover:underline"
      >
        {item.title}
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-fg-subtle">
        <span className="flex items-center gap-1.5">
          <TypeIcon type={item.type} />
          {itemKey(item)}
          <PriorityIcon priority={item.priority} />
        </span>
        <span className="flex items-center gap-2">
          {item.dueDate && (
            <time
              dateTime={item.dueDate}
              className={cx(isOverdue(item) && 'font-semibold text-danger')}
            >
              {formatDate(item.dueDate)}
            </time>
          )}
          <Avatar user={item.assignee} small />
        </span>
      </div>
    </article>
  );
}
