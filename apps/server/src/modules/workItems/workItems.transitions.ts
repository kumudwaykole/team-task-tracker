import { Role, Status, WorkItemType } from '../../generated/prisma/enums.js';
import { AppError, forbidden } from '../../utils/AppError.js';

const { TODO, OPEN, IN_PROGRESS, IN_REVIEW, ESCALATED, RESOLVED, CLOSED, DONE } = Status;

/** The single source of truth for status changes. Statuses missing for a type are invalid for it. */
const TRANSITIONS: Record<WorkItemType, Partial<Record<Status, readonly Status[]>>> = {
  [WorkItemType.TASK]: {
    [TODO]: [IN_PROGRESS],
    [IN_PROGRESS]: [TODO, IN_REVIEW],
    [IN_REVIEW]: [IN_PROGRESS, DONE],
    [DONE]: [IN_PROGRESS],
  },
  [WorkItemType.TICKET]: {
    [OPEN]: [IN_PROGRESS, ESCALATED, CLOSED],
    [IN_PROGRESS]: [OPEN, ESCALATED, RESOLVED],
    [ESCALATED]: [IN_PROGRESS, RESOLVED],
    [RESOLVED]: [IN_PROGRESS, CLOSED],
    [CLOSED]: [],
  },
};

export const INITIAL_STATUS: Record<WorkItemType, Status> = {
  [WorkItemType.TASK]: TODO,
  [WorkItemType.TICKET]: OPEN,
};

/** Work is finished in these statuses (used for "active" and "overdue"). */
export const FINAL_STATUSES: Status[] = [DONE, CLOSED];

const ESCALATE_ROLES: Role[] = [Role.ADMIN, Role.MANAGER];

/** Next statuses this role may move the item to. */
export function allowedNext(type: WorkItemType, from: Status, role: Role): Status[] {
  return (TRANSITIONS[type][from] ?? []).filter(
    (to) => to !== ESCALATED || ESCALATE_ROLES.includes(role),
  );
}

export function assertTransition(type: WorkItemType, from: Status, to: Status, role: Role) {
  if (!(TRANSITIONS[type][from] ?? []).includes(to)) {
    throw new AppError(409, 'INVALID_TRANSITION', `Cannot move a ${type} from ${from} to ${to}`, {
      allowed: allowedNext(type, from, role),
    });
  }
  if (to === ESCALATED && !ESCALATE_ROLES.includes(role)) {
    throw forbidden('Only a Manager or Admin can escalate a ticket');
  }
}
