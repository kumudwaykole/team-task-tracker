import { prisma } from '../../config/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { FINAL_STATUSES } from './workItems.transitions.js';

/**
 * List rows leave out `description` to keep the payload small.
 * `project.managerId` is only for the permission hints and is stripped from responses.
 */
const listSelect = {
  id: true,
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

/** Fields the update flow needs for its checks. */
const accessSelect = {
  id: true,
  type: true,
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

export const findForUpdate = (where: Prisma.WorkItemWhereInput) =>
  prisma.workItem.findFirst({ where, select: accessSelect });

export const create = (data: Prisma.WorkItemUncheckedCreateInput) =>
  prisma.workItem.create({ data, select: detailSelect });

/**
 * Optimistic update: `where` can pin the current status so a concurrent change makes it match nothing.
 * Returns the number of rows updated (0 or 1).
 */
export const updateGuarded = async (
  where: Prisma.WorkItemWhereInput,
  data: Prisma.WorkItemUncheckedUpdateManyInput,
) => (await prisma.workItem.updateMany({ where, data })).count;

/** Returns false when no item had this id. Comments and notifications cascade. */
export const remove = async (id: string) =>
  (await prisma.workItem.deleteMany({ where: { id } })).count > 0;

export const countByProject = (projectId: string) =>
  prisma.workItem.count({ where: { projectId } });

/** Items assigned to the user in the project that are not finished yet. */
export const countActiveAssigned = (projectId: string, assigneeId: string) =>
  prisma.workItem.count({ where: { projectId, assigneeId, status: { notIn: FINAL_STATUSES } } });
