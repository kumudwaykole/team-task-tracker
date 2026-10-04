/**
 * Development seed. Idempotent: users are upserted by email, projects by (manager, name),
 * memberships skip duplicates, and work items are skipped when one with the same title and
 * requester exists. Running it twice changes nothing.
 */
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { Role, WorkItemType, type Priority, type Status } from '../src/generated/prisma/enums.js';
import { hashPassword } from '../src/utils/password.js';

const DEV_PASSWORD = 'Password@123';
const HOUR = 60 * 60 * 1000;

// Users are referred to by key; the email is `<key>@tracker.dev`.
const users: { key: string; name: string; role: Role }[] = [
  { key: 'admin', name: 'Admin User', role: Role.ADMIN },
  { key: 'manager1', name: 'Manager One', role: Role.MANAGER },
  { key: 'manager2', name: 'Manager Two', role: Role.MANAGER },
  ...[1, 2, 3, 4, 5].map((n) => ({ key: `member${n}`, name: `Member ${n}`, role: Role.MEMBER })),
];

// member3 belongs to both projects on purpose, to test overlapping access.
const projects = [
  { name: 'Project Alpha', manager: 'manager1', members: ['member1', 'member2', 'member3'] },
  { name: 'Project Beta', manager: 'manager2', members: ['member3', 'member4', 'member5'] },
];

// Assignees follow the API rules: tasks go to project members, project tickets to a member or
// the project's manager, project-less tickets to an Admin or Manager.
// Due dates are hours from now: negative = overdue, under 24 = due soon, null = none.

// [title, status, priority, assignee, dueInHours]
type TaskRow = [string, Status, Priority, string | null, number | null];
const tasks: Record<string, TaskRow[]> = {
  'Project Alpha': [
    ['Design new landing page', 'IN_PROGRESS', 'HIGH', 'member1', 120],
    ['Fix login redirect loop', 'TODO', 'URGENT', 'member2', 12],
    ['Write API docs for auth endpoints', 'IN_REVIEW', 'MEDIUM', 'member3', 72],
    ['Set up CI pipeline', 'DONE', 'MEDIUM', 'member1', null],
    ['Migrate blog to new CMS', 'TODO', 'LOW', 'member2', -48],
    ['Optimize image loading', 'IN_PROGRESS', 'MEDIUM', 'member3', -24],
    ['Add dark mode toggle', 'TODO', 'LOW', null, null],
    ['Accessibility audit', 'IN_REVIEW', 'HIGH', 'member1', 18],
    ['Update footer links', 'DONE', 'LOW', 'member2', -120],
    ['Contact form validation', 'TODO', 'MEDIUM', 'member3', 240],
    ['SEO metadata for product pages', 'IN_PROGRESS', 'HIGH', 'member1', null],
  ],
  'Project Beta': [
    ['Push notification service', 'IN_PROGRESS', 'URGENT', 'member4', 48],
    ['Offline mode for task list', 'TODO', 'HIGH', 'member5', 336],
    ['Biometric login support', 'IN_REVIEW', 'HIGH', 'member3', 10],
    ['Crash on Android 12 startup', 'IN_PROGRESS', 'URGENT', 'member4', -12],
    ['App store screenshots', 'DONE', 'LOW', 'member5', null],
    ['Reduce bundle size', 'TODO', 'MEDIUM', 'member3', null],
    ['Deep link handling', 'TODO', 'MEDIUM', null, 168],
    ['Release 2.1 checklist', 'IN_REVIEW', 'MEDIUM', 'member5', 20],
    ['Analytics events audit', 'DONE', 'LOW', 'member4', null],
  ],
};

// [title, status, priority, requester, assignee, dueInHours]
type TicketRow = [string, Status, Priority, string, string | null, number | null];
const tickets: Record<string, TicketRow[]> = {
  'Project Alpha': [
    ['Cannot reset password', 'OPEN', 'HIGH', 'member1', null, null],
    ['Broken image on pricing page', 'IN_PROGRESS', 'MEDIUM', 'member2', 'member3', 36],
    ['Staging server is down', 'ESCALATED', 'URGENT', 'member3', 'manager1', 6],
    ['Typo on About page', 'RESOLVED', 'LOW', 'member1', 'member2', null],
    ['Request access to analytics', 'CLOSED', 'LOW', 'member2', 'manager1', null],
  ],
  'Project Beta': [
    ['App crashes when uploading a photo', 'OPEN', 'URGENT', 'member4', null, null],
    ['Login button unresponsive on iOS', 'IN_PROGRESS', 'HIGH', 'member5', 'member4', 22],
    ['Sync conflicts after offline edits', 'ESCALATED', 'HIGH', 'member3', 'manager2', -6],
    ['Wrong currency symbol in checkout', 'RESOLVED', 'MEDIUM', 'member5', 'member3', null],
    ['Duplicate push notifications', 'CLOSED', 'MEDIUM', 'member4', 'member4', null],
  ],
  // Tickets without a project
  '': [
    ['Laptop will not connect to VPN', 'OPEN', 'HIGH', 'member1', null, null],
    ['Need a license for design software', 'OPEN', 'LOW', 'member4', null, 96],
    ['Email signature not updating', 'IN_PROGRESS', 'MEDIUM', 'member5', 'manager1', null],
    ['Printer on second floor is jammed', 'RESOLVED', 'LOW', 'member2', 'admin', null],
    ['Request a second monitor', 'CLOSED', 'LOW', 'member3', 'admin', null],
  ],
};

async function main() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production');
  }

  // `pnpm dev` passes --if-empty: seed a brand-new database only, never re-add deleted demo data.
  if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) {
    console.log('Database already has data; skipping the demo seed.');
    return;
  }

  // Users
  const passwordHash = await hashPassword(DEV_PASSWORD);
  const idByKey = new Map<string, string>();
  for (const { key, name, role } of users) {
    const email = `${key}@tracker.dev`;
    const { id } = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name, email, role, passwordHash },
      select: { id: true },
    });
    idByKey.set(key, id);
  }
  const idOf = (key: string) => {
    const id = idByKey.get(key);
    if (!id) throw new Error(`Seed data references unknown user "${key}"`);
    return id;
  };

  // Projects and members
  const projectIdByName = new Map<string, string>();
  for (const project of projects) {
    const managerId = idOf(project.manager);
    const { id: projectId } = await prisma.project.upsert({
      where: { managerId_name: { managerId, name: project.name } },
      update: {},
      create: { name: project.name, managerId },
      select: { id: true },
    });
    projectIdByName.set(project.name, projectId);
    await prisma.projectMember.createMany({
      data: project.members.map((key) => ({ projectId, userId: idOf(key) })),
      skipDuplicates: true,
    });
  }

  // Work items. createdAt is spread over the past week so sorting and paging look realistic.
  const now = Date.now();
  let position = 0;
  let createdCount = 0;
  const seedItem = async (item: {
    type: WorkItemType;
    title: string;
    status: Status;
    priority: Priority;
    projectName: string;
    requester: string;
    assignee: string | null;
    dueInHours: number | null;
  }) => {
    const createdAt = new Date(now - ++position * 5 * HOUR);
    const requesterId = idOf(item.requester);
    const exists = await prisma.workItem.findFirst({
      where: { title: item.title, requesterId },
      select: { id: true },
    });
    if (exists) return;

    await prisma.workItem.create({
      data: {
        type: item.type,
        title: item.title,
        description: `${item.title}. Demo ${item.type.toLowerCase()} created by the seed script.`,
        status: item.status,
        priority: item.priority,
        projectId: projectIdByName.get(item.projectName) ?? null,
        requesterId,
        assigneeId: item.assignee ? idOf(item.assignee) : null,
        dueDate: item.dueInHours === null ? null : new Date(now + item.dueInHours * HOUR),
        createdAt,
      },
    });
    createdCount++;
  };

  for (const project of projects) {
    for (const [title, status, priority, assignee, dueInHours] of tasks[project.name] ?? []) {
      await seedItem({
        type: WorkItemType.TASK,
        title,
        status,
        priority,
        projectName: project.name,
        requester: project.manager,
        assignee,
        dueInHours,
      });
    }
  }
  for (const [projectName, rows] of Object.entries(tickets)) {
    for (const [title, status, priority, requester, assignee, dueInHours] of rows) {
      await seedItem({
        type: WorkItemType.TICKET,
        title,
        status,
        priority,
        projectName,
        requester,
        assignee,
        dueInHours,
      });
    }
  }

  const [userCount, projectCount, memberCount, itemCount] = await prisma.$transaction([
    prisma.user.count(),
    prisma.project.count(),
    prisma.projectMember.count(),
    prisma.workItem.count(),
  ]);
  console.log(
    `Seed complete: ${userCount} users, ${projectCount} projects, ${memberCount} memberships, ` +
      `${itemCount} work items (${createdCount} new). Dev password: ${DEV_PASSWORD}`,
  );
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
