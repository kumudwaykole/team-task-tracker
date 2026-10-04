import type { Priority, Role, Status, WorkItem, WorkItemType } from '../api/types';

export const STATUS_LABELS: Record<Status, string> = {
  TODO: 'To Do',
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  DONE: 'Done',
};

/** Workflow order per type; also the board's columns. Mirrors the server's transition map. */
export const STATUSES_BY_TYPE: Record<WorkItemType, Status[]> = {
  TASK: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'],
  TICKET: ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'],
};

export const ALL_STATUSES: Status[] = [
  'TODO',
  'OPEN',
  'IN_PROGRESS',
  'IN_REVIEW',
  'ESCALATED',
  'RESOLVED',
  'DONE',
  'CLOSED',
];

/** Work is finished in these statuses. */
export const FINAL_STATUSES: Status[] = ['DONE', 'CLOSED'];

export const PRIORITY_LABELS: Record<Priority, string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const PRIORITIES: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

export const TYPE_LABELS: Record<WorkItemType, string> = { TASK: 'Task', TICKET: 'Ticket' };

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MEMBER: 'Member',
};

export const ROLES: Role[] = ['ADMIN', 'MANAGER', 'MEMBER'];

/** Jira-style key: TASK-12, TKT-7. */
export const itemKey = (item: Pick<WorkItem, 'type' | 'number'>) =>
  `${item.type === 'TASK' ? 'TASK' : 'TKT'}-${item.number}`;
