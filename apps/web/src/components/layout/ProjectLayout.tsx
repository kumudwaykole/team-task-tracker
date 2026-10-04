import { useQuery } from '@tanstack/react-query';
import { Kanban, List, Users } from 'lucide-react';
import { Suspense } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { projectsApi } from '../../api/projects';
import { cx } from '../../lib/cx';
import { QueryError } from '../ui/ErrorState';
import { SkeletonRows } from '../ui/feedback';

const SECTIONS = [
  { to: 'board', label: 'Board', icon: Kanban },
  { to: 'list', label: 'List', icon: List },
  { to: 'members', label: 'Members', icon: Users },
];

/** Project sidebar (a tab strip below 1024px) around the board, list and members pages. */
export function ProjectLayout() {
  const { projectId = '' } = useParams();
  const query = useQuery({
    queryKey: ['project', projectId],
    queryFn: ({ signal }) => projectsApi.get(projectId, signal),
  });

  if (query.isPending) return <SkeletonRows className="p-6" />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const project = query.data;
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-border bg-canvas p-3 lg:w-60 lg:border-r lg:border-b-0">
        <div className="px-2 py-1">
          <Link to="/projects" className="text-xs text-fg-subtle hover:underline">
            Projects
          </Link>
          <p className="truncate font-semibold text-fg-strong" title={project.name}>
            {project.name}
          </p>
          <p className="truncate text-xs text-fg-subtle">Manager: {project.manager.name}</p>
        </div>
        <nav aria-label="Project" className="mt-2 flex gap-1 overflow-x-auto lg:flex-col">
          {SECTIONS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 font-medium whitespace-nowrap transition-colors',
                  isActive ? 'bg-selected text-primary' : 'text-fg hover:bg-secondary',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 flex-1 p-6">
        <Suspense fallback={<SkeletonRows />}>
          <Outlet context={project} />
        </Suspense>
      </section>
    </div>
  );
}
