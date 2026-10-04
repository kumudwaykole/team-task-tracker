import { ArrowDown, ArrowUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { SortOrder, WorkItem } from '../../api/types';
import { cx } from '../../lib/cx';
import { formatDate, formatDateTime, isOverdue, timeAgo } from '../../lib/format';
import { itemKey } from '../../lib/labels';
import { PriorityIcon, StatusLozenge, TypeIcon, UserLabel } from '../ui/badges';

export type SortField = 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title';

interface SortProps {
  sortBy: SortField;
  order: SortOrder;
  onSort: (sortBy: SortField, order: SortOrder) => void;
}

interface WorkItemTableProps {
  items: WorkItem[];
  sort?: SortProps;
  showProject?: boolean;
  /** Dims the rows while the next page loads (previous rows stay visible). */
  stale?: boolean;
}

export function WorkItemTable({ items, sort, showProject = true, stale }: WorkItemTableProps) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table
        className={cx('w-full min-w-[760px] text-left transition-opacity', stale && 'opacity-60')}
      >
        <thead className="bg-surface text-xs text-fg-subtle">
          <tr className="border-b border-border">
            <th className="w-28 px-3 py-2 font-semibold">Key</th>
            <SortHeader field="title" label="Title" sort={sort} />
            {showProject && <th className="px-3 py-2 font-semibold">Project</th>}
            <th className="px-3 py-2 font-semibold">Status</th>
            <SortHeader field="priority" label="Priority" sort={sort} />
            <th className="px-3 py-2 font-semibold">Assignee</th>
            <SortHeader field="dueDate" label="Due" sort={sort} />
            <SortHeader field="updatedAt" label="Updated" sort={sort} />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => navigate(`/work-items/${item.id}`)}
              className="cursor-pointer border-b border-border last:border-b-0 hover:bg-hover"
            >
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-fg-subtle">
                  <TypeIcon type={item.type} />
                  {itemKey(item)}
                </span>
              </td>
              <td className="max-w-80 px-3 py-2">
                <Link
                  to={`/work-items/${item.id}`}
                  onClick={(event) => event.stopPropagation()}
                  className="line-clamp-1 font-medium text-fg-strong hover:text-primary hover:underline"
                >
                  {item.title}
                </Link>
              </td>
              {showProject && (
                <td className="max-w-40 truncate px-3 py-2 text-fg-subtle">
                  {item.project?.name ?? '—'}
                </td>
              )}
              <td className="px-3 py-2">
                <StatusLozenge status={item.status} />
              </td>
              <td className="px-3 py-2">
                <PriorityIcon priority={item.priority} withLabel />
              </td>
              <td className="max-w-44 px-3 py-2">
                <UserLabel user={item.assignee} />
              </td>
              <td
                className={cx(
                  'px-3 py-2 whitespace-nowrap',
                  isOverdue(item) ? 'font-semibold text-danger' : 'text-fg-subtle',
                )}
              >
                {item.dueDate ? (
                  <time dateTime={item.dueDate} title={formatDateTime(item.dueDate)}>
                    {formatDate(item.dueDate)}
                  </time>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-fg-subtle">
                <time dateTime={item.updatedAt} title={formatDateTime(item.updatedAt)}>
                  {timeAgo(item.updatedAt)}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  field,
  label,
  sort,
}: {
  field: SortField;
  label: string;
  sort?: SortProps | undefined;
}) {
  if (!sort) return <th className="px-3 py-2 font-semibold">{label}</th>;
  const active = sort.sortBy === field;
  const Arrow = sort.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className="px-3 py-2 font-semibold"
      aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => sort.onSort(field, active && sort.order === 'desc' ? 'asc' : 'desc')}
        className={cx(
          'inline-flex items-center gap-1 hover:text-fg-strong',
          active && 'text-fg-strong',
        )}
      >
        {label}
        {active && <Arrow className="size-3" aria-hidden />}
      </button>
    </th>
  );
}
