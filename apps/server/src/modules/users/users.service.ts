import type { Prisma } from '../../generated/prisma/client.js';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/auth.js';
import { conflict, notFound } from '../../utils/AppError.js';
import {
  buildMeta,
  sortWithTieBreaker,
  toSkipTake,
  type Paginated,
} from '../../utils/pagination.js';
import { hashPassword } from '../../utils/password.js';
import { isUniqueViolation } from '../../utils/prismaErrors.js';
import * as projectsRepository from '../projects/projects.repository.js';
import type { CreateUserInput, ListUsersQuery } from './users.schema.js';
import * as usersRepository from './users.repository.js';

export async function list(
  user: AuthUser,
  query: ListUsersQuery,
): Promise<Paginated<usersRepository.PublicUser>> {
  // Managers use this as the "add member" picker, so they only ever get MEMBER users.
  const role = user.role === Role.MANAGER ? Role.MEMBER : query.role;

  const where: Prisma.UserWhereInput = {
    ...(role && { role }),
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ],
    }),
  };

  const [data, total] = await usersRepository.findManyAndCount({
    where,
    orderBy: sortWithTieBreaker(query.sortBy, query.order),
    ...toSkipTake(query),
  });
  return { data, meta: buildMeta(query, total) };
}

/** Used by public register (always MEMBER) and by Admin user creation (any role). */
export async function createUser({ name, email, password, role }: CreateUserInput) {
  const passwordHash = await hashPassword(password);
  try {
    return await usersRepository.create({ name, email, passwordHash, role });
  } catch (err) {
    // Rely on the unique index instead of "find then insert", which has a race condition.
    if (isUniqueViolation(err)) {
      throw conflict('An account with this email already exists', 'EMAIL_TAKEN');
    }
    throw err;
  }
}

export async function changeRole(actor: AuthUser, targetId: string, role: Role) {
  // Stops an Admin from locking everyone out by demoting themselves.
  if (targetId === actor.id) {
    throw conflict('You cannot change your own role', 'CANNOT_CHANGE_OWN_ROLE');
  }

  const target = await usersRepository.findById(targetId);
  if (!target) throw notFound('User not found');
  if (target.role === role) return target;

  if (target.role === Role.MANAGER) {
    const owned = await projectsRepository.countByManager(targetId);
    if (owned > 0) {
      throw conflict(
        `This manager still owns ${owned} project(s). Reassign or delete them first.`,
        'MANAGER_OWNS_PROJECTS',
      );
    }
  }

  return usersRepository.updateRole(targetId, role);
}
