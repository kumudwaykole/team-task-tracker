import { prisma, type Db } from '../../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { Status } from '../../generated/prisma/enums.js';
import { FINAL_STATUSES } from './workItems.transitions.js';

/**
 * List rows leave out `description` to keep the payload small.
 * `project.managerId` is only for the permission hints and is stripped from responses.
 */
const listSelect = {
  id: true,
  number: true,
  type: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true, managerId: true } },
  requester: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.WorkItemSelect;

const detailSelect = {
  ...listSelect,
  description: true,
  _count: { select: { comments: true } },
} satisfies Prisma.WorkItemSelect;

/** Fields needed for access checks and notification recipients. */
const accessSelect = {
  id: true,
  type: true,
  title: true,
  status: true,
  requesterId: true,
  assigneeId: true,
  dueDate: true,
  project: { select: { id: true, managerId: true } },
} satisfies Prisma.WorkItemSelect;

export type WorkItemRow = Prisma.WorkItemGetPayload<{ select: typeof listSelect }>;

export const findManyAndCount = (args: {
  where: Prisma.WorkItemWhereInput;
  orderBy: Prisma.WorkItemOrderByWithRelationInput[];
  skip: number;
  take: number;
}) =>
  prisma.$transaction([
    prisma.workItem.findMany({ ...args, select: listSelect }),
    prisma.workItem.count({ where: args.where }),
  ]);

export const findDetail = (where: Prisma.WorkItemWhereInput) =>
  prisma.workItem.findFirst({ where, select: detailSelect });

export const findForAccess = (where: Prisma.WorkItemWhereInput) =>
  prisma.workItem.findFirst({ where, select: accessSelect });

/**
 * Board columns: the first `perColumn` cards of each status, plus each status's total.
 * The card order matches the list's `sortBy=priority&order=desc`, so "load more" can page through it.
 */
export async function findBoard(
  where: Prisma.WorkItemWhereInput,
  statuses: Status[],
  perColumn: number,
) {
  const [columns, totals] = await Promise.all([
    prisma.$transaction(
      statuses.map((status) =>
        prisma.workItem.findMany({
          where: { AND: [where, { status }] },
          orderBy: [{ priority: 'desc' }, { id: 'desc' }],
          take: perColumn,
          select: listSelect,
        }),
      ),
    ),
    prisma.workItem.groupBy({ by: ['status'], where, _count: { _all: true } }),
  ]);
  return { columns, totals: new Map(totals.map((group) => [group.status, group._count._all])) };
}

export const create = (data: Prisma.WorkItemUncheckedCreateInput, db: Db = prisma) =>
  db.workItem.create({ data, select: detailSelect });

/**
 * Optimistic update: `where` can pin the current status so a concurrent change makes it match nothing.
 * Returns the number of rows updated (0 or 1).
 */
export const updateGuarded = async (
  where: Prisma.WorkItemWhereInput,
  data: Prisma.WorkItemUncheckedUpdateManyInput,
  db: Db = prisma,
) => (await db.workItem.updateMany({ where, data })).count;

/** Returns false when no item had this id. Comments and notifications cascade. */
export const remove = async (id: string) =>
  (await prisma.workItem.deleteMany({ where: { id } })).count > 0;

export const countByProject = (projectId: string) =>
  prisma.workItem.count({ where: { projectId } });

/** Items assigned to the user in the project that are not finished yet. */
export const countActiveAssigned = (projectId: string, assigneeId: string) =>
  prisma.workItem.count({ where: { projectId, assigneeId, status: { notIn: FINAL_STATUSES } } });

/**
 * Atomically claims up to `batchSize` assigned, unfinished items that are due within the window
 * and not yet reminded, by setting `remindedAt`. SKIP LOCKED lets parallel runs take different rows,
 * so an item is never reminded twice.
 */
export const claimDueSoon = (tx: Db, windowHours: number, batchSize: number) =>
  tx.$queryRaw<{ id: string; title: string; assigneeId: string; dueDate: Date }[]>`
    UPDATE "WorkItem" SET "remindedAt" = NOW()
    WHERE id IN (
      SELECT id FROM "WorkItem"
      WHERE "assigneeId" IS NOT NULL
        AND "dueDate" IS NOT NULL
        AND "remindedAt" IS NULL
        AND "dueDate" <= NOW() + make_interval(hours => ${windowHours}::int)
        AND status::text NOT IN (${Prisma.join(FINAL_STATUSES)})
      ORDER BY "dueDate"
      LIMIT ${batchSize}::int
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, title, "assigneeId", "dueDate"`;
