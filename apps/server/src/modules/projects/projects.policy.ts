import type { Prisma } from '../../generated/prisma/client.js';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/auth.js';

/** Read scope: the only place that decides which projects a user can see. Goes into every project query. */
export function projectScope(user: AuthUser): Prisma.ProjectWhereInput {
  switch (user.role) {
    case Role.ADMIN:
      return {};
    case Role.MANAGER:
      return { managerId: user.id };
    case Role.MEMBER:
      return { members: { some: { userId: user.id } } };
  }
}

/** Write access: Admin, or the Manager who owns the project. */
export const canManageProject = (user: AuthUser, project: { managerId: string }) =>
  user.role === Role.ADMIN || (user.role === Role.MANAGER && project.managerId === user.id);
