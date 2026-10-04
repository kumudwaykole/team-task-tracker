import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarClock, CircleAlert, FolderKanban, ListTodo, Ticket } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/dashboard';
import type { Status } from '../api/types';
import { workItemsApi } from '../api/workItems';
import { StatusLozenge } from '../components/ui/badges';
import { QueryError } from '../components/ui/ErrorState';
import { EmptyState, SkeletonRows } from '../components/ui/feedback';
import { WorkItemTable } from '../components/workItems/WorkItemTable';
import { useCurrentUser } from '../context/AuthContext';
import { cx } from '../lib/cx';
import { ALL_STATUSES, FINAL_STATUSES } from '../lib/labels';

const ACTIVE_STATUSES = ALL_STATUSES.filter((status) => !FINAL_STATUSES.includes(status));
const MY_WORK = {
  mine: 'assigned',
  status: ACTIVE_STATUSES,
  sortBy: 'priority',
  order: 'desc',
  limit: 10,
};

/** "Your work": every number comes from one summary request. */
export function DashboardPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: ({ signal }) => dashboardApi.summary(signal),
  });
  const myWork = useQuery({
    queryKey: ['workItems', MY_WORK],
    queryFn: ({ signal }) => workItemsApi.list(MY_WORK, signal),
  });

  const openDueSoon = () => {
    const now = new Date();
    const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    navigate(`/work-items?mine=assigned&dueFrom=${now.toISOString()}&dueTo=${until.toISOString()}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-xl font-semibold text-fg-strong">Hi, {user.name.split(' ')[0]}</h1>

      {summary.isPending ? (
        <SkeletonRows rows={2} />
      ) : summary.isError ? (
        <QueryError error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={ListTodo} title="Assigned to me" className="sm:col-span-2 lg:row-span-2">
            {Object.keys(summary.data.assignedToMe).length === 0 ? (
              <p className="text-fg-subtle">Nothing open is assigned to you.</p>
            ) : (
              <ul className="space-y-1">
                {ACTIVE_STATUSES.filter((status) => summary.data.assignedToMe[status]).map(
                  (status: Status) => (
                    <li key={status}>
                      <Link
                        to={`/work-items?mine=assigned&status=${status}`}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-hover"
                      >
                        <StatusLozenge status={status} />
                        <span className="text-lg font-semibold text-fg-strong">
                          {summary.data.assignedToMe[status]}
                        </span>
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            )}
          </Card>
          <StatCard
            icon={CircleAlert}
            label="Overdue"
            value={summary.data.overdue}
            to="/work-items?mine=assigned&overdue=true"
            alert={summary.data.overdue > 0}
          />
          <StatCard
            icon={CalendarClock}
            label="Due in 24 hours"
            value={summary.data.dueSoon}
            onClick={openDueSoon}
          />
          <StatCard
            icon={Bell}
            label="Unread notifications"
            value={summary.data.unreadNotifications}
            to="/notifications?tab=unread"
          />
          <StatCard
            icon={FolderKanban}
            label="Projects"
            value={summary.data.projects}
            to="/projects"
          />
          <StatCard
            icon={Ticket}
            label="Raised by me (open / done)"
            value={`${summary.data.raisedByMe.open} / ${summary.data.raisedByMe.closed}`}
            to="/work-items?mine=raised"
          />
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-fg-strong">My open work</h2>
          <Link to="/work-items?mine=assigned" className="text-primary hover:underline">
            View all
          </Link>
        </div>
        {myWork.isPending ? (
          <SkeletonRows rows={5} />
        ) : myWork.isError ? (
          <QueryError error={myWork.error} onRetry={() => void myWork.refetch()} />
        ) : myWork.data.data.length === 0 ? (
          <EmptyState icon={ListTodo} title="You are all caught up">
            Work assigned to you shows up here.
          </EmptyState>
        ) : (
          <WorkItemTable items={myWork.data.data} />
        )}
      </section>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: typeof ListTodo;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('rounded-lg border border-border bg-surface p-4', className)}>
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-fg-strong">
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

interface StatCardProps {
  icon: typeof ListTodo;
  label: string;
  value: number | string;
  to?: string;
  onClick?: () => void;
  alert?: boolean;
}

/** A number that opens the matching filtered list. */
function StatCard({ icon: Icon, label, value, to, onClick, alert }: StatCardProps) {
  const content = (
    <>
      <span className="flex items-center gap-2 text-fg-subtle">
        <Icon className={cx('size-4', alert ? 'text-danger' : 'text-fg-subtle')} aria-hidden />
        {label}
      </span>
      <span
        className={cx(
          'mt-2 block text-2xl font-semibold',
          alert ? 'text-danger' : 'text-fg-strong',
        )}
      >
        {value}
      </span>
    </>
  );
  const className =
    'block rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-hover';
  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
