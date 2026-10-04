import type { Prisma } from '../../generated/prisma/client.js';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/AppError.js';
import { buildMeta, sortWithTieBreaker, toSkipTake } from '../../utils/pagination.js';
import { isUniqueViolation } from '../../utils/prismaErrors.js';
import * as usersRepository from '../users/users.repository.js';
import * as workItemsRepository from '../workItems/workItems.repository.js';
import { canManageProject, projectScope } from './projects.policy.js';
import * as projectsRepository from './projects.repository.js';
import type {
  CreateProjectInput,
  ListMembersQuery,
  ListProjectsQuery,
  UpdateProjectInput,
} from './projects.schema.js';

const scoped = (user: AuthUser, id: string): Prisma.ProjectWhereInput => ({
  AND: [{ id }, projectScope(user)],
});

/** A project the user can see. 404 otherwise, so ids outside the scope are not revealed. */
export async function getAccessibleProject(user: AuthUser, id: string) {
  const project = await projectsRepository.findForAccess(scoped(user, id));
  if (!project) throw notFound('Project not found');
  return project;
}

/** A project the user can see (404) and manage (403). */
async function getManageableProject(user: AuthUser, id: string) {
  const project = await getAccessibleProject(user, id);
  if (!canManageProject(user, project)) throw forbidden();
  return project;
}

/** The given user must exist and have role MANAGER. */
async function assertManager(managerId: string | undefined): Promise<string> {
  const manager = managerId ? await usersRepository.findById(managerId) : null;
  if (!managerId || manager?.role !== Role.MANAGER) {
    throw badRequest(
      'managerId must be the id of a user with role MANAGER',
      undefined,
      'INVALID_MANAGER',
    );
  }
  return managerId;
}

const nameTaken = () =>
  conflict('This manager already has a project with that name', 'PROJECT_NAME_TAKEN');

export async function create(user: AuthUser, input: CreateProjectInput) {
  // A Manager always becomes the manager of their own project; any managerId in the body is ignored.
  const managerId = user.role === Role.MANAGER ? user.id : await assertManager(input.managerId);
  try {
    return await projectsRepository.create({ name: input.name, managerId });
  } catch (err) {
    if (isUniqueViolation(err)) throw nameTaken();
    throw err;
  }
}

export async function list(user: AuthUser, query: ListProjectsQuery) {
  const where: Prisma.ProjectWhereInput = {
    AND: [
      projectScope(user),
      ...(query.q ? [{ name: { contains: query.q, mode: 'insensitive' as const } }] : []),
    ],
  };
  const [data, total] = await projectsRepository.findManyAndCount({
    where,
    orderBy: sortWithTieBreaker(query.sortBy, query.order),
    ...toSkipTake(query),
  });
  return { data, meta: buildMeta(query, total) };
}

export async function getById(user: AuthUser, id: string) {
  const project = await projectsRepository.findDetail(scoped(user, id));
  if (!project) throw notFound('Project not found');
  return project;
}

export async function update(user: AuthUser, id: string, input: UpdateProjectInput) {
  const project = await getManageableProject(user, id);
  if (input.managerId !== undefined && user.role !== Role.ADMIN) {
    throw forbidden('Only an Admin can change the project manager');
  }

  const data = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.managerId !== undefined && { managerId: await assertManager(input.managerId) }),
  };
  try {
    return await projectsRepository.update(project.id, data);
  } catch (err) {
    if (isUniqueViolation(err)) throw nameTaken();
    throw err;
  }
}

export async function remove(user: AuthUser, id: string) {
  const project = await getManageableProject(user, id);
  // The DB also blocks this (onDelete: Restrict); checking first gives a clear error.
  const items = await workItemsRepository.countByProject(project.id);
  if (items > 0) {
    throw conflict(
      `The project still has ${items} work item(s) and cannot be deleted`,
      'PROJECT_HAS_WORK_ITEMS',
    );
  }
  await projectsRepository.remove(project.id);
}

export async function listMembers(user: AuthUser, id: string, query: ListMembersQuery) {
  const project = await getAccessibleProject(user, id);

  const where: Prisma.ProjectMemberWhereInput = {
    projectId: project.id,
    ...(query.q && {
      user: {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      },
    }),
  };
  const orderBy: Prisma.ProjectMemberOrderByWithRelationInput[] = [
    query.sortBy === 'name' ? { user: { name: query.order } } : { addedAt: query.order },
    { userId: query.order },
  ];

  const [rows, total] = await projectsRepository.findMembersAndCount({
    where,
    orderBy,
    ...toSkipTake(query),
  });
  return {
    data: rows.map(({ user: member, addedAt }) => ({ ...member, addedAt })),
    meta: buildMeta(query, total),
  };
}

export async function addMembers(user: AuthUser, id: string, userIds: string[]) {
  const project = await getManageableProject(user, id);

  // Only MEMBER users can join a project; unknown ids are rejected too.
  const uniqueIds = [...new Set(userIds)];
  const roleById = new Map(
    (await usersRepository.findRolesByIds(uniqueIds)).map((u) => [u.id, u.role]),
  );
  const invalidIds = uniqueIds.filter((userId) => roleById.get(userId) !== Role.MEMBER);
  if (invalidIds.length > 0) {
    throw badRequest(
      'Only existing users with role MEMBER can be added to a project',
      { invalidIds },
      'INVALID_MEMBER',
    );
  }

  return { added: await projectsRepository.addMembers(project.id, uniqueIds) };
}

export async function removeMember(user: AuthUser, id: string, userId: string) {
  const project = await getManageableProject(user, id);

  const active = await workItemsRepository.countActiveAssigned(project.id, userId);
  if (active > 0) {
    throw conflict(
      `This member still has ${active} active work item(s) in the project. Reassign them first.`,
      'MEMBER_HAS_ACTIVE_WORK',
      { activeItems: active },
    );
  }

  if (!(await projectsRepository.removeMember(project.id, userId))) {
    throw notFound('This user is not a member of the project');
  }
}
