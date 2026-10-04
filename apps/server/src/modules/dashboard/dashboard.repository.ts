import { prisma } from '../../config/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { FINAL_STATUSES } from '../workItems/workItems.transitions.js';

/** Small indexed queries for the "Your work" page, in one transaction. */
export function summaryCounts(args: {
  userId: string;
  projectScope: Prisma.ProjectWhereInput;
  now: Date;
  dueSoonUntil: Date;
}) {
  const { userId, now } = args;
  const active = { notIn: FINAL_STATUSES };
  return prisma.$transaction([
    prisma.workItem.groupBy({
      by: ['status'],
      where: { assigneeId: userId, status: active },
      _count: { _all: true },
      orderBy: { status: 'asc' },
    }),
    prisma.workItem.count({ where: { assigneeId: userId, status: active, dueDate: { lt: now } } }),
    prisma.workItem.count({
      where: { assigneeId: userId, status: active, dueDate: { gte: now, lte: args.dueSoonUntil } },
    }),
    prisma.workItem.groupBy({
      by: ['status'],
      where: { requesterId: userId },
      _count: { _all: true },
      orderBy: { status: 'asc' },
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.project.count({ where: args.projectScope }),
  ]);
}
