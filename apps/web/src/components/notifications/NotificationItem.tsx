import { useNavigate } from 'react-router-dom';
import type { Notification } from '../../api/types';
import { useMarkRead } from '../../hooks/useNotifications';
import { cx } from '../../lib/cx';
import { formatDateTime, timeAgo } from '../../lib/format';

interface NotificationItemProps {
  notification: Notification;
  /** Called after the click is handled (e.g. to close the bell). */
  onOpened?: () => void;
  /** Admin "all users" view: show whose notification it is, and do not mark it read. */
  showOwner?: boolean;
}

/** Click: mark read (optimistically) and go to the item. */
export function NotificationItem({ notification, onOpened, showOwner }: NotificationItemProps) {
  const navigate = useNavigate();
  const markRead = useMarkRead();

  const open = () => {
    if (!showOwner && !notification.isRead) markRead.mutate(notification.id);
    if (notification.workItemId) navigate(`/work-items/${notification.workItemId}`);
    onOpened?.();
  };

  return (
    <button
      type="button"
      onClick={open}
      className={cx(
        'flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-hover',
        !notification.isRead && 'bg-selected',
      )}
    >
      <span
        aria-label={notification.isRead ? 'Read' : 'Unread'}
        className={cx(
          'mt-1.5 size-2 shrink-0 rounded-full',
          notification.isRead ? 'bg-transparent' : 'bg-primary',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className={cx('block', notification.isRead ? 'text-fg' : 'text-fg-strong')}>
          {notification.message}
        </span>
        {showOwner && notification.user && (
          <span className="block text-xs text-fg-subtle">To {notification.user.name}</span>
        )}
      </span>
      <time
        dateTime={notification.createdAt}
        title={formatDateTime(notification.createdAt)}
        className="shrink-0 text-xs text-fg-subtle"
      >
        {timeAgo(notification.createdAt)}
      </time>
    </button>
  );
}
