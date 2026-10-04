import { prisma } from '../../config/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

const projectSelect = {
  id: true,
  name: true,
  createdAt: true,
  manager: { select: { id: true, name: true } },
} satisfies Prisma.ProjectSelect;

const projectWithCountsSelect = {
  ...projectSelect,
  _count: { select: { members: true, workItems: true } },
} satisfies Prisma.ProjectSelect;

const memberSelect = {
  addedAt: true,
  user: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.ProjectMemberSelect;

/** Minimal fields needed for access checks. */
export const findForAccess = (where: Prisma.ProjectWhereInput) =>
  prisma.project.findFirst({ where, select: { id: true, managerId: true } });

export const findDetail = (where: Prisma.ProjectWhereInput) =>
  prisma.project.findFirst({ where, select: projectWithCountsSelect });

export const findManyAndCount = (args: {
  where: Prisma.ProjectWhereInput;
  orderBy: Prisma.ProjectOrderByWithRelationInput[];
  skip: number;
  take: number;
}) =>
  prisma.$transaction([
    prisma.project.findMany({ ...args, select: projectWithCountsSelect }),
    prisma.project.count({ where: args.where }),
  ]);

export const create = (data: { name: string; managerId: string }) =>
  prisma.project.create({ data, select: projectSelect });

export const update = (id: string, data: { name?: string; managerId?: string }) =>
  prisma.project.update({ where: { id }, data, select: projectSelect });

export const remove = (id: string) => prisma.project.delete({ where: { id } });

export const countByManager = (managerId: string) => prisma.project.count({ where: { managerId } });

export const findMembersAndCount = (args: {
  where: Prisma.ProjectMemberWhereInput;
  orderBy: Prisma.ProjectMemberOrderByWithRelationInput[];
  skip: number;
  take: number;
}) =>
  prisma.$transaction([
    prisma.projectMember.findMany({ ...args, select: memberSelect }),
    prisma.projectMember.count({ where: args.where }),
  ]);

export const isMember = async (projectId: string, userId: string) =>
  (await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { userId: true },
  })) !== null;

/** Returns how many were actually added; existing members are skipped. */
export const addMembers = async (projectId: string, userIds: string[]) =>
  (
    await prisma.projectMember.createMany({
      data: userIds.map((userId) => ({ projectId, userId })),
      skipDuplicates: true,
    })
  ).count;

/** Returns false when the user was not a member. */
export const removeMember = async (projectId: string, userId: string) =>
  (await prisma.projectMember.deleteMany({ where: { projectId, userId } })).count > 0;
