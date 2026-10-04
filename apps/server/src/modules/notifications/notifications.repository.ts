import { prisma, type Db } from '../../config/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { NewNotification } from './notifications.recipients.js';

/** What the API and the socket send for a notification. */
const notificationSelect = {
  id: true,
  type: true,
  message: true,
  workItemId: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationDto = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;
export type CreatedNotification = NotificationDto & { userId: string };

/** Bulk insert; returns the rows so they can be pushed after the transaction commits. */
export const createMany = async (
  data: NewNotification[],
  db: Db = prisma,
): Promise<CreatedNotification[]> =>
  data.length === 0
    ? []
    : db.notification.createManyAndReturn({
        data,
        select: { ...notificationSelect, userId: true },
      });

/**
 * One page plus totals in one transaction. `unreadOwnerId` adds that user's unread count
 * (skipped by the caller when the page itself is "my unread").
 */
export async function findPage(args: {
  where: Prisma.NotificationWhereInput;
  skip: number;
  take: number;
  unreadOwnerId?: string;
}) {
  const findRows = prisma.notification.findMany({
    where: args.where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: args.skip,
    take: args.take,
    select: { ...notificationSelect, user: { select: { id: true, name: true } } },
  });
  const countRows = prisma.notification.count({ where: args.where });

  if (!args.unreadOwnerId) {
    const [rows, total] = await prisma.$transaction([findRows, countRows]);
    return { rows, total, unreadCount: undefined };
  }
  const [rows, total, unreadCount] = await prisma.$transaction([
    findRows,
    countRows,
    prisma.notification.count({ where: { userId: args.unreadOwnerId, isRead: false } }),
  ]);
  return { rows, total, unreadCount };
}

export const countUnread = (userId: string) =>
  prisma.notification.count({ where: { userId, isRead: false } });

/** Unread counts for many users with one grouped query. */
export async function countUnreadByUsers(userIds: string[]) {
  const groups = await prisma.notification.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, isRead: false },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.userId, group._count._all]));
}

/** Returns false when the notification does not exist or belongs to someone else. */
export const markRead = async (id: string, userId: string) =>
  (await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } })).count >
  0;

/** One UPDATE; returns how many were marked. */
export const markAllRead = async (userId: string) =>
  (
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
  ).count;

/** Deletes up to `batchSize` read notifications older than `days`. Unread ones are never deleted. */
export const deleteReadOlderThan = (days: number, batchSize: number) =>
  prisma.$executeRaw`
    DELETE FROM "Notification" WHERE id IN (
      SELECT id FROM "Notification"
      WHERE "isRead" AND "createdAt" < NOW() - make_interval(days => ${days}::int)
      LIMIT ${batchSize}::int
    )`;
