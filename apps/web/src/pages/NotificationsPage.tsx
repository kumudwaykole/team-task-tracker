import { Inbox } from 'lucide-react';
import { NotificationItem } from '../components/notifications/NotificationItem';
import { Button } from '../components/ui/Button';
import { QueryError } from '../components/ui/ErrorState';
import { EmptyState, PageHeader, Pagination, SkeletonRows, Tabs } from '../components/ui/feedback';
import { useCurrentUser } from '../context/AuthContext';
import { useListParams } from '../hooks/useListParams';
import { useMarkAllRead, useNotificationList } from '../hooks/useNotifications';
import { cx } from '../lib/cx';

type Tab = 'all' | 'unread' | 'everyone';

/** Full history, paginated. An Admin also gets an "All users" view. */
export function NotificationsPage() {
  const user = useCurrentUser();
  const params = useListParams();
  const isAdmin = user.role === 'ADMIN';

  const requested = params.get('tab');
  const tab: Tab =
    requested === 'unread' || (requested === 'everyone' && isAdmin) ? requested : 'all';
  const list = useNotificationList({
    page: params.page,
    limit: 20,
    ...(tab === 'unread' && { unread: true }),
    ...(tab === 'everyone' && { scope: 'all' }),
  });
  const markAll = useMarkAllRead();

  const tabs: { value: Tab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'Unread' },
    ...(isAdmin ? [{ value: 'everyone' as const, label: 'All users' }] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader title="Notifications">
        <Button loading={markAll.isPending} onClick={() => markAll.mutate()}>
          Mark all read
        </Button>
      </PageHeader>

      <Tabs
        label="Notifications"
        value={tab}
        onChange={(value) => params.update({ tab: value === 'all' ? undefined : value })}
        options={tabs}
      />

      <div className="mt-3">
        {list.isPending ? (
          <SkeletonRows />
        ) : list.isError ? (
          <QueryError error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.data.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          >
            You are notified when work is assigned to you, its status changes, someone comments, or
            it is due soon.
          </EmptyState>
        ) : (
          <>
            <div
              className={cx(
                'overflow-hidden rounded-lg border border-border divide-y divide-border',
                list.isPlaceholderData && 'opacity-60',
              )}
            >
              {list.data.data.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  showOwner={tab === 'everyone'}
                />
              ))}
            </div>
            <Pagination
              meta={list.data.meta}
              busy={list.isFetching}
              onPage={(page) => params.update({ page })}
            />
          </>
        )}
      </div>
    </div>
  );
}
