import type { Prisma } from '../../generated/prisma/client.js';
import { Role, type Status, type WorkItemType } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/auth.js';
import { canManageProject } from '../projects/projects.policy.js';
import { allowedNext } from './workItems.transitions.js';

interface PolicyItem {
  type: WorkItemType;
  status: Status;
  requesterId: string;
  assigneeId: string | null;
  project: { managerId: string } | null;
}

type Capability = 'FULL' | 'STATUS_ONLY' | 'NONE';

/** Read scope: goes into the SQL `WHERE` of every work-item read, update, delete and comment lookup. */
export function workItemScope(user: AuthUser): Prisma.WorkItemWhereInput {
  switch (user.role) {
    case Role.ADMIN:
      return {};
    case Role.MANAGER:
      return {
        OR: [
          { project: { managerId: user.id } },
          { requesterId: user.id },
          { assigneeId: user.id },
        ],
      };
    case Role.MEMBER:
      return {
        OR: [
          { assigneeId: user.id },
          { requesterId: user.id },
          { project: { members: { some: { userId: user.id } } } },
        ],
      };
  }
}

/** Admin, or the Manager of the item's project. Project-less tickets are managed by Admins only. */
export const managesItem = (user: AuthUser, item: Pick<PolicyItem, 'project'>) =>
  user.role === Role.ADMIN || (item.project !== null && canManageProject(user, item.project));

/**
 * What this user may change on this item:
 * FULL = every editable field, STATUS_ONLY = status only (the assignee), NONE = nothing.
 */
export function capabilityFor(
  user: AuthUser,
  item: Pick<PolicyItem, 'assigneeId' | 'project'>,
): Capability {
  if (managesItem(user, item)) return 'FULL';
  if (item.assigneeId === user.id) return 'STATUS_ONLY';
  return 'NONE';
}

const canDelete = (user: AuthUser) => user.role === Role.ADMIN;

export const canComment = (user: AuthUser, item: PolicyItem) =>
  managesItem(user, item) || item.requesterId === user.id || item.assigneeId === user.id;

/**
 * UI hints computed by the same rules the backend enforces. Hints only:
 * every request is checked again on the server.
 */
export function permissionsFor(user: AuthUser, item: PolicyItem) {
  const capability = capabilityFor(user, item);
  const allowedTransitions =
    capability === 'NONE' ? [] : allowedNext(item.type, item.status, user.role);

  return {
    permissions: {
      canEdit: capability === 'FULL',
      canChangeStatus: allowedTransitions.length > 0,
      canAssign: capability === 'FULL',
      canDelete: canDelete(user),
      canComment: canComment(user, item),
    },
    allowedTransitions,
  };
}
