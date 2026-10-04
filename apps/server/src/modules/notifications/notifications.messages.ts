import type { Status } from '../../generated/prisma/enums.js';

const STATUS_LABELS: Record<Status, string> = {
  TODO: 'To Do',
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  DONE: 'Done',
};

const TITLE_MAX = 80;

const truncate = (text: string) =>
  text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text;

// Messages are stored as plain text so the list needs no joins. They never contain relative
// times ("tomorrow"), which would go stale; the UI shows the created time separately.
export const messages = {
  assigned: (actor: string, title: string) => `${actor} assigned you "${truncate(title)}"`,
  statusChanged: (actor: string, title: string, from: Status, to: Status) =>
    `${actor} moved "${truncate(title)}" from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to]}`,
  commented: (actor: string, title: string) => `${actor} commented on "${truncate(title)}"`,
  ticketCreated: (actor: string, title: string) =>
    `${actor} raised a new ticket: "${truncate(title)}"`,
  dueSoon: (title: string, overdue: boolean, windowHours: number) =>
    overdue
      ? `"${truncate(title)}" is overdue`
      : `"${truncate(title)}" is due within ${windowHours} hours`,
};
