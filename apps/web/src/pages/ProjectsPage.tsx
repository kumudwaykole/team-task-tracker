import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, FolderKanban, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';
import { UserLabel } from '../components/ui/badges';
import { Button } from '../components/ui/Button';
import { QueryError } from '../components/ui/ErrorState';
import { EmptyState, PageHeader, Pagination, SkeletonRows } from '../components/ui/feedback';
import { SearchInput } from '../components/ui/SearchInput';
import { useCurrentUser } from '../context/AuthContext';
import { useListParams } from '../hooks/useListParams';
import { cx } from '../lib/cx';
import { formatDate } from '../lib/format';

export function ProjectsPage() {
  const user = useCurrentUser();
  const params = useListParams();
  const [creating, setCreating] = useState(false);

  const sortBy = params.get('sortBy') === 'name' ? 'name' : 'createdAt';
  const order = params.get('order') === 'asc' ? 'asc' : 'desc';
  const query = { page: params.page, limit: 20, q: params.get('q'), sortBy, order };

  const projects = useQuery({
    queryKey: ['projects', query],
    queryFn: ({ signal }) => projectsApi.list(query, signal),
    placeholderData: keepPreviousData,
  });

  const sortButton = (field: 'name' | 'createdAt', label: string) => {
    const active = sortBy === field;
    const Arrow = order === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() =>
          params.update({ sortBy: field, order: active && order === 'desc' ? 'asc' : 'desc' })
        }
        className={cx(
          'inline-flex items-center gap-1 hover:text-fg-strong',
          active && 'text-fg-strong',
        )}
      >
        {label}
        {active && <Arrow className="size-3" aria-hidden />}
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title="Projects">
        {user.role !== 'MEMBER' && (
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            Create project
          </Button>
        )}
      </PageHeader>

      <SearchInput
        value={query.q ?? ''}
        onSearch={(q) => params.update({ q })}
        placeholder="Search projects"
        className="mb-3"
      />

      {projects.isPending ? (
        <SkeletonRows />
      ) : projects.isError ? (
        <QueryError error={projects.error} onRetry={() => void projects.refetch()} />
      ) : projects.data.data.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={query.q ? 'No matching projects' : 'No projects yet'}
          {...(user.role !== 'MEMBER' &&
            !query.q && {
              action: (
                <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                  Create project
                </Button>
              ),
            })}
        >
          {user.role === 'MEMBER' && !query.q && 'Projects you are added to will appear here.'}
        </EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table
              className={cx(
                'w-full min-w-[640px] text-left transition-opacity',
                projects.isPlaceholderData && 'opacity-60',
              )}
            >
              <thead className="bg-surface text-xs text-fg-subtle">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-semibold">{sortButton('name', 'Name')}</th>
                  <th className="px-3 py-2 font-semibold">Manager</th>
                  <th className="px-3 py-2 font-semibold">Members</th>
                  <th className="px-3 py-2 font-semibold">Work items</th>
                  <th className="px-3 py-2 font-semibold">{sortButton('createdAt', 'Created')}</th>
                </tr>
              </thead>
              <tbody>
                {projects.data.data.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-border last:border-b-0 hover:bg-hover"
                  >
                    <td className="px-3 py-2">
                      <Link
                        to={`/projects/${project.id}/board`}
                        className="font-medium text-fg-strong hover:text-primary hover:underline"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <UserLabel user={project.manager} />
                    </td>
                    <td className="px-3 py-2 text-fg-subtle">{project._count.members}</td>
                    <td className="px-3 py-2 text-fg-subtle">{project._count.workItems}</td>
                    <td className="px-3 py-2 text-fg-subtle">{formatDate(project.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={projects.data.meta}
            busy={projects.isFetching}
            onPage={(page) => params.update({ page })}
          />
        </>
      )}

      <CreateProjectModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
