import { emitToUser } from '../../sockets/index.js';
import * as notificationsRepository from './notifications.repository.js';

/**
 * Pushes saved notifications to their recipients. Call it only AFTER the transaction that
 * created them has committed. Never throws: the rows are already stored, so a failed push
 * only means the user sees them on the next load.
 */
export function publishNotifications(rows: notificationsRepository.CreatedNotification[]) {
  if (rows.length === 0) return;
  void deliver(rows).catch((err: unknown) => console.error('[notifications] push failed', err));
}

async function deliver(rows: notificationsRepository.CreatedNotification[]) {
  // One grouped query for every recipient's badge count.
  const counts = await notificationsRepository.countUnreadByUsers([
    ...new Set(rows.map((row) => row.userId)),
  ]);
  for (const { userId, ...notification } of rows) {
    emitToUser(userId, 'notification:new', {
      notification,
      unreadCount: counts.get(userId) ?? 0,
    });
  }
}

/** Keeps the user's other tabs in sync after they read notifications. */
export const publishReadUpdate = (userId: string, ids: string[] | 'all', unreadCount: number) =>
  emitToUser(userId, 'notification:updated', { ids, unreadCount });
