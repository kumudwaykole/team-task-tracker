import { prisma } from '../../src/config/prisma.js';
import {
  Priority,
  Role,
  Status,
  WorkItemType,
  type NotificationType,
} from '../../src/generated/prisma/enums.js';
import { hashPassword } from '../../src/utils/password.js';
import { loginAs } from './auth.js';

export const PASSWORD = 'Password@123';
const HOUR = 60 * 60 * 1000;
export const hoursFromNow = (hours: number) => new Date(Date.now() + hours * HOUR);

let sequence = 0;
const next = () => ++sequence;

// One hash for every test user (BCRYPT_ROUNDS=4 in tests makes it cheap anyway).
let passwordHash: Promise<string> | undefined;

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Plain-text password, for login tests. */
  password: string;
  /** A valid JWT for this user. */
  token: string;
}

export async function createUser(
  options: { role?: Role; email?: string; name?: string } = {},
): Promise<TestUser> {
  const role = options.role ?? Role.MEMBER;
  const n = next();
  const user = await prisma.user.create({
    data: {
      name: options.name ?? `${role.toLowerCase()} ${n}`,
      email: options.email ?? `${role.toLowerCase()}${n}@test.dev`,
      role,
      passwordHash: await (passwordHash ??= hashPassword(PASSWORD)),
    },
    select: { id: true, name: true, email: true, role: true },
  });
  return { ...user, password: PASSWORD, token: loginAs(user) };
}

export async function makeProject(options: {
  manager: { id: string };
  members?: { id: string }[];
  name?: string;
}) {
  return prisma.project.create({
    data: {
      name: options.name ?? `Project ${next()}`,
      managerId: options.manager.id,
      members: { create: (options.members ?? []).map((member) => ({ userId: member.id })) },
    },
  });
}

interface ItemOptions {
  title?: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  assignee?: { id: string } | null;
  dueDate?: Date | null;
  remindedAt?: Date | null;
  createdAt?: Date;
}

const itemData = (options: ItemOptions) => ({
  title: options.title ?? `Item ${next()}`,
  description: options.description ?? 'Created by a test',
  priority: options.priority ?? Priority.MEDIUM,
  assigneeId: options.assignee?.id ?? null,
  dueDate: options.dueDate ?? null,
  remindedAt: options.remindedAt ?? null,
  ...(options.createdAt && { createdAt: options.createdAt }),
});

/** A TASK in `project`, raised by its manager unless `requester` is given. */
export function makeTask(
  options: ItemOptions & { project: { id: string; managerId: string }; requester?: { id: string } },
) {
  return prisma.workItem.create({
    data: {
      ...itemData(options),
      type: WorkItemType.TASK,
      status: options.status ?? Status.TODO,
      projectId: options.project.id,
      requesterId: options.requester?.id ?? options.project.managerId,
    },
  });
}

/** A TICKET, with or without a project. */
export function makeTicket(
  options: ItemOptions & { requester: { id: string }; project?: { id: string } | null },
) {
  return prisma.workItem.create({
    data: {
      ...itemData(options),
      type: WorkItemType.TICKET,
      status: options.status ?? Status.OPEN,
      projectId: options.project?.id ?? null,
      requesterId: options.requester.id,
    },
  });
}

export function makeNotification(options: {
  user: { id: string };
  type?: NotificationType;
  isRead?: boolean;
  createdAt?: Date;
  workItem?: { id: string } | null;
}) {
  return prisma.notification.create({
    data: {
      userId: options.user.id,
      type: options.type ?? 'ASSIGNED',
      message: 'Test notification',
      isRead: options.isRead ?? false,
      workItemId: options.workItem?.id ?? null,
      ...(options.createdAt && { createdAt: options.createdAt }),
    },
  });
}

/**
 * The shared cast for permission tests:
 * - projectA: manager1, members member1 + member2
 * - projectB: manager2, member member3
 * - member4 belongs to no project
 * - taskA (projectA): assigned to member1, raised by manager1
 * - ticketA (projectA): raised by member2, assigned to member1
 * - taskB (projectB): assigned to member3
 * - looseTicket (no project): raised by member4
 * - a notification for member2
 */
export async function buildWorld() {
  const [admin, manager1, manager2, member1, member2, member3, member4] = await Promise.all([
    createUser({ role: Role.ADMIN, name: 'Admin' }),
    createUser({ role: Role.MANAGER, name: 'Manager One' }),
    createUser({ role: Role.MANAGER, name: 'Manager Two' }),
    createUser({ name: 'Member One' }),
    createUser({ name: 'Member Two' }),
    createUser({ name: 'Member Three' }),
    createUser({ name: 'Member Four' }),
  ]);
  const projectA = await makeProject({ manager: manager1, members: [member1, member2] });
  const projectB = await makeProject({ manager: manager2, members: [member3] });
  const taskA = await makeTask({ project: projectA, assignee: member1 });
  const ticketA = await makeTicket({ project: projectA, requester: member2, assignee: member1 });
  const taskB = await makeTask({ project: projectB, assignee: member3 });
  const looseTicket = await makeTicket({ requester: member4 });
  const member2Notification = await makeNotification({ user: member2, workItem: ticketA });

  return {
    users: { admin, manager1, manager2, member1, member2, member3, member4 },
    projectA,
    projectB,
    taskA,
    ticketA,
    taskB,
    looseTicket,
    member2Notification,
  };
}

export type World = Awaited<ReturnType<typeof buildWorld>>;
