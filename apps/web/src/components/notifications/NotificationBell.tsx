import { Bell, Inbox } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarkAllRead, useNotificationList, useUnreadCount } from '../../hooks/useNotifications';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/form';
import { Menu } from '../ui/Menu';
import { NotificationItem } from './NotificationItem';
import { ListSkeleton } from '../ui/skeletons';

export function NotificationBell() {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  return (
    <Menu
      align="right"
      className="w-[400px] max-w-[calc(100vw-2rem)] py-0"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={`Notifications, ${count} unread`}
          className="relative grid size-8 place-items-center rounded-md text-fg-subtle hover:bg-secondary hover:text-fg-strong"
        >
          <Bell className="size-5" aria-hidden />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-on-primary">
              {count > 99 ? '99+' : count}
            </span>
          )}
          <span className="sr-only" aria-live="polite">
            {count} unread notifications
          </span>
        </button>
      )}
    >
      {(close) => <BellPanel onClose={close} />}
    </Menu>
  );
}

/** Mounted only while the dropdown is open, so the list loads on demand. */
function BellPanel({ onClose }: { onClose: () => void }) {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const list = useNotificationList({ limit: 10, unread: onlyUnread || undefined });
  const markAll = useMarkAllRead();

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="font-semibold text-fg-strong">Notifications</h2>
        <div className="flex items-center gap-3">
          <Checkbox
            label={<span className="text-xs">Only unread</span>}
            checked={onlyUnread}
            onChange={(event) => setOnlyUnread(event.target.checked)}
          />
          <Button
            size="sm"
            variant="subtle"
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </Button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {list.isPending ? (
          <ListSkeleton rows={4} className="p-1" />
        ) : list.data?.data.length ? (
          list.data.data.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onOpened={onClose}
            />
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-fg-subtle">
            <Inbox className="size-6" aria-hidden />
            {onlyUnread ? 'No unread notifications' : 'No notifications yet'}
          </div>
        )}
      </div>

      <Link
        to="/notifications"
        onClick={onClose}
        className="block border-t border-border px-4 py-2.5 text-center text-primary hover:underline"
      >
        View all notifications
      </Link>
    </div>
  );
}
