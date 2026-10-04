import { prisma } from '../../config/prisma.js';
import type { Prisma, Role } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../types/auth.js';

/** Fields that are safe to return to clients. Never includes `passwordHash`. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const satisfies Prisma.UserSelect;

export const findAuthUserById = (id: string): Promise<AuthUser | null> =>
  prisma.user.findUnique({ where: { id }, select: publicUserSelect });

/** Includes `passwordHash`. Only for credential checks; strip the hash before returning. */
export const findByEmailWithPassword = (email: string) =>
  prisma.user.findUnique({ where: { email }, select: { ...publicUserSelect, passwordHash: true } });

export const create = (data: {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}): Promise<AuthUser> => prisma.user.create({ data, select: publicUserSelect });
