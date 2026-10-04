import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListTodo, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Params } from '../../api/client';
import { projectsApi } from '../../api/projects';
import type { Priority, SortOrder, Status, WorkItemType } from '../../api/types';
import { workItemsApi } from '../../api/workItems';
import { useListParams } from '../../hooks/useListParams';
import {
  ALL_STATUSES,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUSES_BY_TYPE,
} from '../../lib/labels';
import { Button } from '../ui/Button';
import { QueryError } from '../ui/ErrorState';
import { EmptyState, Pagination } from '../ui/feedback';
import { Checkbox, Select } from '../ui/form';
import { MultiSelect } from '../ui/MultiSelect';
import { SearchInput } from '../ui/SearchInput';
import { WorkItemTable, type SortField } from './WorkItemTable';
import { TableSkeleton } from '../ui/skeletons';

const PAGE_SIZE = 20;
const SORT_FIELDS: SortField[] = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title'];
const FILTER_KEYS = [
  'q',
  'type',
  'status',
  'priority',
  'projectId',
  'mine',
  'overdue',
  'dueFrom',
  'dueTo',
];

/**
 * Filterable, sortable, server-paginated work-item list. Every filter lives in the URL.
 * With `projectId` it shows one project's items (the project's List tab).
 */
export function WorkItemsView({ projectId }: { projectId?: string }) {
  const params = useListParams();
  const queryClient = useQueryClient();
  // Remounting the search box (new key) clears its text when filters are cleared.
  const [searchKey, setSearchKey] = useState(0);

  const query = useMemo(() => {
    const sortBy = params.get('sortBy') as SortField | undefined;
    const typeParam = params.get('type');
    const type: WorkItemType | undefined =
      typeParam === 'TASK' || typeParam === 'TICKET' ? typeParam : undefined;
    return {
      page: params.page,
      limit: PAGE_SIZE,
      sortBy: sortBy && SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt',
      order: (params.get('order') === 'asc' ? 'asc' : 'desc') as SortOrder,
      q: params.get('q'),
      type,
      status: params.getList('status'),
      priority: params.getList('priority'),
      projectId: projectId ?? params.get('projectId'),
      mine: params.get('mine'),
      overdue: params.get('overdue') === 'true' || undefined,
      dueFrom: params.get('dueFrom'),
      dueTo: params.get('dueTo'),
    } satisfies Params;
    // `search` is the whole query string, so it captures every param read above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.search, projectId]);

  const list = useQuery({
    queryKey: ['workItems', query],
    queryFn: ({ signal }) => workItemsApi.list(query, signal),
    placeholderData: keepPreviousData,
  });

  // Prefetch the next page so "Next" is instant.
  const hasNext = list.data?.meta.hasNext;
  useEffect(() => {
    if (!hasNext) return;
    const next = { ...query, page: query.page + 1 };
    void queryClient.prefetchQuery({
      queryKey: ['workItems', next],
      queryFn: ({ signal }) => workItemsApi.list(next, signal),
    });
  }, [hasNext, query, queryClient]);

  const filtersActive = FILTER_KEYS.some((key) =>
    key === 'projectId' ? !projectId && params.get(key) : params.get(key),
  );
  const clearFilters = () => {
    params.update(Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])));
    setSearchKey((key) => key + 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          key={searchKey}
          value={query.q ?? ''}
          onSearch={(q) => params.update({ q })}
          placeholder="Search title or description"
        />
        <FilterBar projectFixed={!!projectId} type={query.type} />
        {filtersActive && (
          <Button variant="subtle" icon={X} onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {list.isPending ? (
        <TableSkeleton rows={8} columns={8} />
      ) : list.isError ? (
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={filtersActive ? 'No matching work items' : 'No work items yet'}
        >
          {filtersActive
            ? 'Try different filters or clear them.'
            : 'Tasks and tickets you can see will appear here.'}
        </EmptyState>
      ) : (
        <>
          <WorkItemTable
            items={list.data.data}
            showProject={!projectId}
            stale={list.isPlaceholderData}
            sort={{
              sortBy: query.sortBy,
              order: query.order,
              onSort: (sortBy, order) => params.update({ sortBy, order }),
            }}
          />
          <Pagination
            meta={list.data.meta}
            busy={list.isFetching}
            onPage={(page) => params.update({ page })}
          />
        </>
      )}
    </div>
  );
}

function FilterBar({
  projectFixed,
  type,
}: {
  projectFixed: boolean;
  type: WorkItemType | undefined;
}) {
  const params = useListParams();
  const statuses = type ? STATUSES_BY_TYPE[type] : ALL_STATUSES;

  const projects = useQuery({
    queryKey: ['projects', { limit: 100, sortBy: 'name', order: 'asc' }],
    queryFn: ({ signal }) => projectsApi.list({ limit: 100, sortBy: 'name', order: 'asc' }, signal),
    enabled: !projectFixed,
  });

  return (
    <>
      <Select
        aria-label="Type"
        value={type ?? ''}
        onChange={(event) => params.update({ type: event.target.value, status: undefined })}
        className="w-auto"
      >
        <option value="">All types</option>
        <option value="TASK">Tasks</option>
        <option value="TICKET">Tickets</option>
      </Select>
      <MultiSelect<Status>
        label="Status"
        options={statuses.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
        values={params.getList('status') as Status[]}
        onChange={(status) => params.update({ status })}
      />
      <MultiSelect<Priority>
        label="Priority"
        options={PRIORITIES.map((priority) => ({
          value: priority,
          label: PRIORITY_LABELS[priority],
        }))}
        values={params.getList('priority') as Priority[]}
        onChange={(priority) => params.update({ priority })}
      />
      {!projectFixed && (
        <Select
          aria-label="Project"
          value={params.get('projectId') ?? ''}
          onChange={(event) => params.update({ projectId: event.target.value })}
          className="w-auto max-w-48"
        >
          <option value="">All projects</option>
          {projects.data?.data.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      )}
      <Select
        aria-label="Involvement"
        value={params.get('mine') ?? ''}
        onChange={(event) => params.update({ mine: event.target.value })}
        className="w-auto"
      >
        <option value="">Anyone</option>
        <option value="assigned">Assigned to me</option>
        <option value="raised">Raised by me</option>
      </Select>
      <Checkbox
        label="Overdue"
        checked={params.get('overdue') === 'true'}
        onChange={(event) => params.update({ overdue: event.target.checked ? 'true' : undefined })}
        className="px-1"
      />
      {(params.get('dueFrom') || params.get('dueTo')) && (
        <Button
          size="sm"
          icon={X}
          onClick={() => params.update({ dueFrom: undefined, dueTo: undefined })}
          aria-label="Remove due date filter"
        >
          Due date filter
        </Button>
      )}
    </>
  );
}
