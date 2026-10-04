import { NotificationType, type Status } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/auth.js';
import { messages } from './notifications.messages.js';

/** A notification row to insert. */
export interface NewNotification {
  userId: string;
  type: NotificationType;
  workItemId: string;
  message: string;
}

/** The work-item fields needed to decide who hears about a change. */
export interface NotifiableItem {
  id: string;
  title: string;
  requesterId: string;
  assigneeId: string | null;
  project: { managerId: string } | null;
}

/** De-duplicates and removes `exclude` (the person who caused the event). */
const usersExcept = (ids: (string | null | undefined)[], exclude: string) => [
  ...new Set(ids.filter((id): id is string => !!id && id !== exclude)),
];

const rows = (
  userIds: string[],
  type: NotificationType,
  item: { id: string },
  message: string,
): NewNotification[] => userIds.map((userId) => ({ userId, type, workItemId: item.id, message }));

/** Requester, assignee and project manager: everyone involved in the item. */
const involved = (item: NotifiableItem) => [
  item.requesterId,
  item.assigneeId,
  item.project?.managerId,
];

export const assigned = (item: NotifiableItem, actor: AuthUser) =>
  rows(
    usersExcept([item.assigneeId], actor.id),
    NotificationType.ASSIGNED,
    item,
    messages.assigned(actor.name, item.title),
  );

export const statusChanged = (item: NotifiableItem, actor: AuthUser, from: Status, to: Status) =>
  rows(
    usersExcept(involved(item), actor.id),
    NotificationType.STATUS_CHANGED,
    item,
    messages.statusChanged(actor.name, item.title, from, to),
  );

export const commented = (item: NotifiableItem, actor: AuthUser) =>
  rows(
    usersExcept(involved(item), actor.id),
    NotificationType.COMMENTED,
    item,
    messages.commented(actor.name, item.title),
  );

/** The project's manager, or every Admin when the ticket has no project. Never the requester. */
export const ticketCreated = (item: NotifiableItem, actor: AuthUser, adminIds: string[]) =>
  rows(
    usersExcept(item.project ? [item.project.managerId] : adminIds, item.requesterId),
    NotificationType.TICKET_CREATED,
    item,
    messages.ticketCreated(actor.name, item.title),
  );

export const dueSoon = (
  item: { id: string; title: string; assigneeId: string },
  overdue: boolean,
  windowHours: number,
) =>
  rows(
    [item.assigneeId],
    NotificationType.DUE_SOON,
    item,
    messages.dueSoon(item.title, overdue, windowHours),
  );
