import { runInTransaction } from '../../config/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { Role, WorkItemType } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/auth.js';
import {
  AppError,
  badRequest,
  forbidden,
  forbiddenFields,
  notFound,
} from '../../utils/AppError.js';
import { buildMeta, sortWithTieBreaker, toSkipTake } from '../../utils/pagination.js';
import { publishNotifications } from '../notifications/notifications.publisher.js';
import * as recipients from '../notifications/notifications.recipients.js';
import * as notificationsRepository from '../notifications/notifications.repository.js';
import { canManageProject } from '../projects/projects.policy.js';
import * as projectsRepository from '../projects/projects.repository.js';
import { getAccessibleProject } from '../projects/projects.service.js';
import * as usersRepository from '../users/users.repository.js';
import { capabilityFor, managesItem, permissionsFor, workItemScope } from './workItems.policy.js';
import * as workItemsRepository from './workItems.repository.js';
import type {
  BoardQuery,
  CreateWorkItemInput,
  ListWorkItemsQuery,
  UpdateWorkItemInput,
} from './workItems.schema.js';
import {
  assertTransition,
  FINAL_STATUSES,
  INITIAL_STATUS,
  statusesFor,
} from './workItems.transitions.js';

type ProjectRef = { id: string; managerId: string } | null;

const scoped = (user: AuthUser, id: string): Prisma.WorkItemWhereInput => ({
  AND: [{ id }, workItemScope(user)],
});

const searchFilter = (q: string): Prisma.WorkItemWhereInput => ({
  OR: [
    { title: { contains: q, mode: 'insensitive' } },
    { description: { contains: q, mode: 'insensitive' } },
  ],
});

/** Adds the permission hints and drops `project.managerId`, which is only needed to compute them. */
function present<T extends workItemsRepository.WorkItemRow>(user: AuthUser, row: T) {
  const hints = permissionsFor(user, {
    type: row.type,
    status: row.status,
    requesterId: row.requester.id,
    assigneeId: row.assignee?.id ?? null,
    project: row.project,
  });
  return {
    ...row,
    project: row.project && { id: row.project.id, name: row.project.name },
    ...hints,
  };
}

/** A work item the user can see, with the fields needed for checks. 404 otherwise. */
export async function getAccessibleItem(user: AuthUser, id: string) {
  const item = await workItemsRepository.findForAccess(scoped(user, id));
  if (!item) throw notFound('Work item not found');
  return item;
}

/**
 * Assignee eligibility:
 * - project item: a project member, or (tickets only) the project's manager
 * - project-less ticket: assigned by an Admin, to an Admin or Manager
 */
async function assertAssignable(
  user: AuthUser,
  item: { type: WorkItemType; project: ProjectRef },
  assigneeId: string,
) {
  const { project } = item;
  if (project) {
    const isTicketManager = item.type === WorkItemType.TICKET && assigneeId === project.managerId;
    if (isTicketManager || (await projectsRepository.isMember(project.id, assigneeId))) return;
    throw badRequest(
      item.type === WorkItemType.TICKET
        ? 'The assignee must be a member or the manager of the project'
        : 'The assignee must be a member of the project',
      { assigneeId },
      'ASSIGNEE_NOT_IN_PROJECT',
    );
  }

  const assignee = user.role === Role.ADMIN ? await usersRepository.findById(assigneeId) : null;
  if (assignee?.role === Role.ADMIN || assignee?.role === Role.MANAGER) return;
  throw badRequest(
    'A ticket without a project can only be assigned to an Admin or Manager',
    { assigneeId },
    'ASSIGNEE_NOT_IN_PROJECT',
  );
}

export async function create(user: AuthUser, input: CreateWorkItemInput) {
  const isTask = input.type === WorkItemType.TASK;
  if (isTask && user.role === Role.MEMBER) throw forbidden('Members cannot create tasks');

  // Outside the user's project scope -> 404.
  const project = input.projectId ? await getAccessibleProject(user, input.projectId) : null;
  if (isTask && project && !canManageProject(user, project)) {
    throw forbidden('Only the project manager or an Admin can create tasks');
  }

  if (input.assigneeId) {
    if (!managesItem(user, { project })) throw forbiddenFields(['assigneeId']);
    await assertAssignable(user, { type: input.type, project }, input.assigneeId);
  }

  // A ticket without a project is announced to every Admin.
  const adminIds = !isTask && !project ? await usersRepository.findIdsByRole(Role.ADMIN) : [];

  // The item and its notifications commit together; they are pushed only after the commit.
  const { row, notifications } = await runInTransaction(async (tx) => {
    const row = await workItemsRepository.create(
      {
        type: input.type,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: INITIAL_STATUS[input.type],
        projectId: project?.id ?? null,
        requesterId: user.id,
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ?? null,
      },
      tx,
    );
    const target: recipients.NotifiableItem = {
      id: row.id,
      title: row.title,
      requesterId: user.id,
      assigneeId: row.assignee?.id ?? null,
      project: row.project,
    };
    const notifications = await notificationsRepository.createMany(
      [
        ...recipients.assigned(target, user),
        ...(isTask ? [] : recipients.ticketCreated(target, user, adminIds)),
      ],
      tx,
    );
    return { row, notifications };
  });
  publishNotifications(notifications);

  return present(user, row);
}

export async function list(user: AuthUser, query: ListWorkItemsQuery) {
  // Each filter is its own AND clause, so filters on the same column (e.g. status + overdue) combine.
  const filters: Prisma.WorkItemWhereInput[] = [];
  if (query.type) filters.push({ type: query.type });
  if (query.status) filters.push({ status: { in: query.status } });
  if (query.priority) filters.push({ priority: { in: query.priority } });
  if (query.projectId) filters.push({ projectId: query.projectId });
  if (query.assigneeId) filters.push({ assigneeId: query.assigneeId });
  if (query.requesterId) filters.push({ requesterId: query.requesterId });
  if (query.mine === 'assigned') filters.push({ assigneeId: user.id });
  if (query.mine === 'raised') filters.push({ requesterId: user.id });
  if (query.overdue) {
    filters.push({ dueDate: { lt: new Date() }, status: { notIn: FINAL_STATUSES } });
  }
  if (query.dueFrom || query.dueTo) {
    filters.push({
      dueDate: {
        ...(query.dueFrom && { gte: query.dueFrom }),
        ...(query.dueTo && { lte: query.dueTo }),
      },
    });
  }
  if (query.q) filters.push(searchFilter(query.q));

  // Priority sorts by enum declaration order (LOW < ... < URGENT). Items without a due date go last.
  const orderBy: Prisma.WorkItemOrderByWithRelationInput[] =
    query.sortBy === 'dueDate'
      ? [{ dueDate: { sort: query.order, nulls: 'last' } }, { id: query.order }]
      : sortWithTieBreaker(query.sortBy, query.order);

  const [rows, total] = await workItemsRepository.findManyAndCount({
    // The RBAC scope is part of the WHERE, so `total` only counts rows the user may see.
    where: { AND: [workItemScope(user), ...filters] },
    orderBy,
    ...toSkipTake(query),
  });
  return { data: rows.map((row) => present(user, row)), meta: buildMeta(query, total) };
}

/** Every column of a project board in one request. */
export async function board(user: AuthUser, projectId: string, query: BoardQuery) {
  const project = await getAccessibleProject(user, projectId);
  const where: Prisma.WorkItemWhereInput = {
    AND: [
      workItemScope(user),
      { projectId: project.id, type: query.type },
      ...(query.assigneeId ? [{ assigneeId: query.assigneeId }] : []),
      ...(query.q ? [searchFilter(query.q)] : []),
    ],
  };
  const statuses = statusesFor(query.type);
  const { columns, totals } = await workItemsRepository.findBoard(where, statuses, query.perColumn);
  return {
    type: query.type,
    columns: statuses.map((status, index) => ({
      status,
      total: totals.get(status) ?? 0,
      items: (columns[index] ?? []).map((row) => present(user, row)),
    })),
  };
}

export async function getById(user: AuthUser, id: string) {
  const row = await workItemsRepository.findDetail(scoped(user, id));
  if (!row) throw notFound('Work item not found');
  return present(user, row);
}

export async function update(user: AuthUser, id: string, input: UpdateWorkItemInput) {
  const item = await getAccessibleItem(user, id);

  const capability = capabilityFor(user, item);
  if (capability === 'NONE') throw forbidden('You cannot modify this work item');
  if (capability === 'STATUS_ONLY') {
    const blocked = Object.keys(input).filter((field) => field !== 'status');
    if (blocked.length > 0) throw forbiddenFields(blocked);
  }

  const data: Prisma.WorkItemUncheckedUpdateManyInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.priority !== undefined) data.priority = input.priority;

  // Sending the current status is a no-op.
  const newStatus = input.status !== item.status ? input.status : undefined;
  if (newStatus) {
    assertTransition(item.type, item.status, newStatus, user.role);
    data.status = newStatus;
  }

  const assigneeChanged = input.assigneeId !== undefined && input.assigneeId !== item.assigneeId;
  if (assigneeChanged && input.assigneeId) {
    await assertAssignable(user, item, input.assigneeId);
  }
  if (assigneeChanged) data.assigneeId = input.assigneeId ?? null;

  if (input.dueDate !== undefined && input.dueDate?.getTime() !== item.dueDate?.getTime()) {
    if (input.dueDate && input.dueDate <= new Date()) {
      throw badRequest(
        'Invalid request data',
        [{ location: 'body', path: 'dueDate', message: 'Due date must be in the future' }],
        'VALIDATION_ERROR',
      );
    }
    data.dueDate = input.dueDate;
    data.remindedAt = null; // so the due-date reminder fires again for the new date
  }

  if (Object.keys(data).length > 0) {
    const target: recipients.NotifiableItem = {
      id: item.id,
      title: input.title ?? item.title,
      requesterId: item.requesterId,
      assigneeId: assigneeChanged ? (input.assigneeId ?? null) : item.assigneeId,
      project: item.project,
    };

    const notifications = await runInTransaction(async (tx) => {
      // If the status changes, only update while it is still the one we validated against.
      const updated = await workItemsRepository.updateGuarded(
        { id: item.id, ...(newStatus && { status: item.status }) },
        data,
        tx,
      );
      if (updated === 0) {
        throw new AppError(
          409,
          'STALE_STATE',
          'This item was changed by someone else. Reload and try again.',
        );
      }
      return notificationsRepository.createMany(
        [
          ...(assigneeChanged ? recipients.assigned(target, user) : []),
          ...(newStatus ? recipients.statusChanged(target, user, item.status, newStatus) : []),
        ],
        tx,
      );
    });
    publishNotifications(notifications);
  }

  return getById(user, id);
}

export async function remove(id: string) {
  if (!(await workItemsRepository.remove(id))) throw notFound('Work item not found');
}
