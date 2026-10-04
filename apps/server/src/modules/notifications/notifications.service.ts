import type { Prisma } from '../../generated/prisma/client.js';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/auth.js';
import { forbidden, notFound } from '../../utils/AppError.js';
import { buildMeta, toSkipTake } from '../../utils/pagination.js';
import { publishReadUpdate } from './notifications.publisher.js';
import * as notificationsRepository from './notifications.repository.js';
import type { ListNotificationsQuery } from './notifications.schema.js';

export async function list(user: AuthUser, query: ListNotificationsQuery) {
  const all = query.scope === 'all';
  if (all && user.role !== Role.ADMIN) {
    throw forbidden('Only an Admin can list everyone’s notifications');
  }

  const where: Prisma.NotificationWhereInput = {
    ...(all ? (query.userId ? { userId: query.userId } : {}) : { userId: user.id }),
    ...(query.unread !== undefined && { isRead: !query.unread }),
    ...(query.type && { type: query.type }),
  };
  // When the page is "my unread" its total already is the unread count.
  const totalIsUnread = !all && query.unread === true && !query.type;

  const { rows, total, unreadCount } = await notificationsRepository.findPage({
    where,
    ...toSkipTake(query),
    ...(!totalIsUnread && { unreadOwnerId: user.id }),
  });

  return {
    // `user` is only useful in the Admin's all-users view.
    data: rows.map(({ user: owner, ...notification }) =>
      all ? { ...notification, user: owner } : notification,
    ),
    // The bell badge reads `unreadCount` from here, so it needs no separate request.
    meta: { ...buildMeta(query, total), unreadCount: unreadCount ?? total },
  };
}

export const unreadCount = async (user: AuthUser) => ({
  count: await notificationsRepository.countUnread(user.id),
});

/** Idempotent. Someone else's notification gives the same 404 as a missing one. */
export async function markRead(user: AuthUser, id: string) {
  if (!(await notificationsRepository.markRead(id, user.id))) {
    throw notFound('Notification not found');
  }
  const unread = await notificationsRepository.countUnread(user.id);
  publishReadUpdate(user.id, [id], unread);
  return { id, isRead: true, unreadCount: unread };
}

export async function markAllRead(user: AuthUser) {
  const updated = await notificationsRepository.markAllRead(user.id);
  const unread = await notificationsRepository.countUnread(user.id);
  publishReadUpdate(user.id, 'all', unread);
  return { updated, unreadCount: unread };
}
