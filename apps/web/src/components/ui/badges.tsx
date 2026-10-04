import type { Priority, Status, UserRef, WorkItemType } from '../../api/types';
import { cx } from '../../lib/cx';
import { PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from '../../lib/labels';
import { AVATAR_STYLES, PRIORITY_STYLES, STATUS_STYLES, TYPE_STYLES } from './badgeStyles';

export function StatusLozenge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cx(
        'inline-block rounded-sm px-1.5 py-0.5 text-[11px] leading-4 font-bold tracking-wide whitespace-nowrap uppercase',
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityIcon({ priority, withLabel }: { priority: Priority; withLabel?: boolean }) {
  const { icon: Icon, className } = PRIORITY_STYLES[priority];
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`Priority: ${PRIORITY_LABELS[priority]}`}
    >
      <Icon className={cx('size-4 shrink-0', className)} aria-hidden />
      {withLabel ? (
        PRIORITY_LABELS[priority]
      ) : (
        <span className="sr-only">{PRIORITY_LABELS[priority]}</span>
      )}
    </span>
  );
}

export function TypeIcon({ type }: { type: WorkItemType }) {
  const { icon: Icon, className } = TYPE_STYLES[type];
  return <Icon className={cx('size-4 shrink-0', className)} aria-label={TYPE_LABELS[type]} />;
}

const hash = (text: string) =>
  [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);

export function Avatar({ user, small }: { user: UserRef | null; small?: boolean }) {
  const size = small ? 'size-5 text-[9px]' : 'size-6 text-[10px]';
  if (!user) {
    return (
      <span
        title="Unassigned"
        className={cx(
          'inline-block shrink-0 rounded-full border border-dashed border-border-strong',
          size,
        )}
      />
    );
  }
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      title={user.name}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
        size,
        AVATAR_STYLES[hash(user.id) % AVATAR_STYLES.length],
      )}
    >
      {initials}
    </span>
  );
}

/** Avatar plus name, or "Unassigned". */
export function UserLabel({ user }: { user: UserRef | null }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar user={user} />
      <span className={cx('truncate', !user && 'text-fg-subtle')}>
        {user?.name ?? 'Unassigned'}
      </span>
    </span>
  );
}
