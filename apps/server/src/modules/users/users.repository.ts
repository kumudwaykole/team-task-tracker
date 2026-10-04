import { prisma } from '../../config/prisma.js';
import type { Prisma, Role } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../types/auth.js';

/** What `req.user` holds. Never includes `passwordHash`. */
const authUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

/** Public user shape returned by the API. */
const userSelect = { ...authUserSelect, createdAt: true } satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export const findAuthUserById = (id: string): Promise<AuthUser | null> =>
  prisma.user.findUnique({ where: { id }, select: authUserSelect });

export const findById = (id: string) =>
  prisma.user.findUnique({ where: { id }, select: userSelect });

/** Includes `passwordHash`. Only for credential checks; strip the hash before returning. */
export const findByEmailWithPassword = (email: string) =>
  prisma.user.findUnique({ where: { email }, select: { ...authUserSelect, passwordHash: true } });

export const findRolesByIds = (ids: string[]) =>
  prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true } });

export const findManyAndCount = (args: {
  where: Prisma.UserWhereInput;
  orderBy: Prisma.UserOrderByWithRelationInput[];
  skip: number;
  take: number;
}) =>
  prisma.$transaction([
    prisma.user.findMany({ ...args, select: userSelect }),
    prisma.user.count({ where: args.where }),
  ]);

export const create = (data: { name: string; email: string; passwordHash: string; role: Role }) =>
  prisma.user.create({ data, select: userSelect });

export const updateRole = (id: string, role: Role) =>
  prisma.user.update({ where: { id }, data: { role }, select: userSelect });

export const findIdsByRole = async (role: Role) =>
  (await prisma.user.findMany({ where: { role }, select: { id: true } })).map((user) => user.id);
