import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import type { WorkItemType } from '../api/types';
import { Board, PER_COLUMN } from '../components/board/Board';
import { CreateInProjectButton } from '../components/workItems/CreateInProjectButton';
import { QueryError } from '../components/ui/ErrorState';
import { PageHeader, SkeletonRows, Tabs } from '../components/ui/feedback';
import { Select } from '../components/ui/form';
import { SearchInput } from '../components/ui/SearchInput';
import { useListParams } from '../hooks/useListParams';
import { useProject } from '../hooks/useProject';

export function ProjectBoardPage() {
  const { project } = useProject();
  const params = useListParams();

  const type: WorkItemType = params.get('type') === 'TICKET' ? 'TICKET' : 'TASK';
  const filters = { type, assigneeId: params.get('assigneeId'), q: params.get('q') };
  // One request returns every column.
  const queryKey = ['board', project.id, filters];
  const board = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      projectsApi.board(project.id, { ...filters, perColumn: PER_COLUMN }, signal),
    placeholderData: keepPreviousData,
  });

  const members = useQuery({
    queryKey: ['projectMembers', project.id, { limit: 100, sortBy: 'name', order: 'asc' }],
    queryFn: ({ signal }) =>
      projectsApi.members(project.id, { limit: 100, sortBy: 'name', order: 'asc' }, signal),
  });

  return (
    <>
      <PageHeader title="Board">
        <Tabs
          label="Item type"
          value={type}
          onChange={(value) => params.update({ type: value === 'TASK' ? undefined : value })}
          options={[
            { value: 'TASK', label: 'Tasks' },
            { value: 'TICKET', label: 'Tickets' },
          ]}
        />
        <CreateInProjectButton projectId={project.id} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={filters.q ?? ''}
          onSearch={(q) => params.update({ q })}
          placeholder="Search board"
        />
        <Select
          aria-label="Assignee"
          value={filters.assigneeId ?? ''}
          onChange={(event) => params.update({ assigneeId: event.target.value })}
          className="w-auto"
        >
          <option value="">All assignees</option>
          {type === 'TICKET' && (
            <option value={project.manager.id}>{project.manager.name} (manager)</option>
          )}
          {members.data?.data.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </Select>
        <p className="text-xs text-fg-subtle">Drag a card to change its status.</p>
      </div>

      {board.isPending ? (
        <SkeletonRows rows={4} />
      ) : board.isError ? (
        <QueryError error={board.error} onRetry={() => void board.refetch()} />
      ) : (
        <Board
          board={board.data}
          queryKey={queryKey}
          listParams={{ projectId: project.id, ...filters }}
          version={board.dataUpdatedAt}
        />
      )}
    </>
  );
}
