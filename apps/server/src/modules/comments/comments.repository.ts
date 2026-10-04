import { prisma, type Db } from '../../config/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { SortOrder } from '../../utils/pagination.js';

// The author's id and name only: never their email.
const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
} satisfies Prisma.CommentSelect;

/** Served by the (workItemId, createdAt) index. */
export const findPage = (args: {
  workItemId: string;
  order: SortOrder;
  skip: number;
  take: number;
}) =>
  prisma.$transaction([
    prisma.comment.findMany({
      where: { workItemId: args.workItemId },
      orderBy: [{ createdAt: args.order }, { id: args.order }],
      skip: args.skip,
      take: args.take,
      select: commentSelect,
    }),
    prisma.comment.count({ where: { workItemId: args.workItemId } }),
  ]);

export const create = (
  data: { workItemId: string; userId: string; body: string },
  db: Db = prisma,
) => db.comment.create({ data, select: commentSelect });
