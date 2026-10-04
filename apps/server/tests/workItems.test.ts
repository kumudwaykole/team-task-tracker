import type { Response } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { Role, type Status, WorkItemType } from '../src/generated/prisma/enums.js';
import { api } from './helpers/auth.js';
import { sleep } from './helpers/db.js';
import {
  createUser,
  hoursFromNow,
  makeProject,
  makeTask,
  makeTicket,
  type TestUser,
} from './helpers/factories.js';
import {
  ALL_STATUSES,
  isValidTransition,
  STATUSES,
  VALID_TRANSITIONS,
} from './helpers/workflow.js';

const titles = (res: Response) =>
  (res.body.data as { title: string }[]).map((item) => item.title).sort();

let admin: TestUser;
let manager: TestUser;
let member: TestUser;
let project: Awaited<ReturnType<typeof makeProject>>;

beforeEach(async () => {
  [admin, manager, member] = await Promise.all([
    createUser({ role: Role.ADMIN }),
    createUser({ role: Role.MANAGER }),
    createUser(),
  ]);
  project = await makeProject({ manager, members: [member] });
});

const makeItem = (type: WorkItemType, status: Status) =>
  type === WorkItemType.TASK
    ? makeTask({ project, status, assignee: member })
    : makeTicket({ project, requester: member, status });

describe('creating work items', () => {
  it('starts a TASK in TODO and a TICKET in OPEN, with the caller as requester', async () => {
    const task = await api(manager.token)
      .post('/api/work-items')
      .send({ type: 'TASK', title: 'Build it', description: 'Details', projectId: project.id });
    const ticket = await api(member.token)
      .post('/api/work-items')
      .send({ type: 'TICKET', title: 'It broke', description: 'Details' });

    expect(task.status).toBe(201);
    expect(task.body.data).toMatchObject({
      status: 'TODO',
      priority: 'MEDIUM',
      requester: { id: manager.id },
    });
    expect(ticket.status).toBe(201);
    expect(ticket.body.data).toMatchObject({
      status: 'OPEN',
      project: null,
      requester: { id: member.id },
    });
  });

  it('does not let the client set the status', async () => {
    const res = await api(manager.token).post('/api/work-items').send({
      type: 'TASK',
      title: 'Build it',
      description: 'Details',
      projectId: project.id,
      status: 'DONE',
    });
    expect(res.status).toBe(400);
  });

  it('requires a project for a TASK', async () => {
    const res = await api(manager.token)
      .post('/api/work-items')
      .send({ type: 'TASK', title: 'Orphan', description: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'projectId' })]),
    );
  });

  it('also enforces the rules in the database (CHECK constraints)', async () => {
    const base = { title: 'Direct insert', description: 'x', requesterId: manager.id };
    // A TASK without a project
    await expect(
      prisma.workItem.create({ data: { ...base, type: 'TASK', status: 'TODO' } }),
    ).rejects.toThrow();
    // A status that does not belong to the type
    await expect(
      prisma.workItem.create({
        data: { ...base, type: 'TASK', status: 'OPEN', projectId: project.id },
      }),
    ).rejects.toThrow();
  });

  it('rejects a due date in the past', async () => {
    const res = await api(manager.token)
      .post('/api/work-items')
      .send({
        type: 'TASK',
        title: 'Late',
        description: 'x',
        projectId: project.id,
        dueDate: hoursFromNow(-1).toISOString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({
      path: 'dueDate',
      message: 'Due date must be in the future',
    });
  });
});

describe('status transitions over the API', () => {
  const validCases = Object.values(WorkItemType).flatMap((type) =>
    VALID_TRANSITIONS[type].map(([from, to]) => [type, from, to] as const),
  );
  const invalidCases = Object.values(WorkItemType).flatMap((type) =>
    STATUSES[type].flatMap((from) =>
      ALL_STATUSES.filter((to) => to !== from && !isValidTransition(type, from, to)).map(
        (to) => [type, from, to] as const,
      ),
    ),
  );

  it.each(validCases)('%s: %s -> %s is allowed', async (type, from, to) => {
    const item = await makeItem(type, from);
    const res = await api(admin.token).patch(`/api/work-items/${item.id}`).send({ status: to });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.status).toBe(to);
  });

  it.each(invalidCases)('%s: %s -> %s is rejected with 409', async (type, from, to) => {
    const item = await makeItem(type, from);
    const res = await api(admin.token).patch(`/api/work-items/${item.id}`).send({ status: to });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect((await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(from);
  });

  it('treats sending the current status as a no-op', async () => {
    const item = await makeItem(WorkItemType.TASK, 'TODO');
    const res = await api(member.token)
      .patch(`/api/work-items/${item.id}`)
      .send({ status: 'TODO' });

    expect(res.status).toBe(200);
    expect(await prisma.notification.count()).toBe(0);
  });
});

describe('concurrent updates', () => {
  it('lets only one of two simultaneous status changes win', async () => {
    const ticket = await makeTicket({ project, requester: member });
    const url = `/api/work-items/${ticket.id}`;

    const [a, b] = await Promise.all([
      api(manager.token).patch(url).send({ status: 'IN_PROGRESS' }),
      api(manager.token).patch(url).send({ status: 'CLOSED' }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const [winner, loser] = a.status === 200 ? [a, b] : [b, a];
    expect(['STALE_STATE', 'INVALID_TRANSITION']).toContain(loser.body.error.code);
    expect((await prisma.workItem.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
      winner.body.data.status,
    );
  });

  it('answers STALE_STATE when the status changes between the check and the write', async () => {
    const task = await makeTask({ project, assignee: member });

    // Hold an uncommitted status change on the row, so the API reads the old status but
    // has to wait on the row lock to write.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let rowLocked!: () => void;
    const locked = new Promise<void>((resolve) => (rowLocked = resolve));
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.workItem.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS' } });
        rowLocked();
        await gate;
      },
      { timeout: 20_000 },
    );
    await locked;

    const pending = api(manager.token)
      .patch(`/api/work-items/${task.id}`)
      .send({ status: 'IN_PROGRESS' })
      .then((res) => res);

    // Wait until the API's UPDATE is blocked on our lock, then commit.
    for (let tries = 0; ; tries++) {
      const [{ waiting }] = await prisma.$queryRaw<[{ waiting: number }]>`
        SELECT count(*)::int AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (waiting > 0) break;
      if (tries > 100) throw new Error('The API request never waited on the row lock');
      await sleep(50);
    }
    release();
    await holder;

    const res = await pending;
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STALE_STATE');
    expect(await prisma.notification.count()).toBe(0);
  });
});

describe('due dates', () => {
  it('resets remindedAt when the due date changes, and keeps it otherwise', async () => {
    const dueDate = hoursFromNow(5);
    const task = await makeTask({ project, assignee: member, dueDate, remindedAt: new Date() });
    const url = `/api/work-items/${task.id}`;

    await api(manager.token)
      .patch(url)
      .send({ dueDate: dueDate.toISOString(), title: 'Same date' })
      .expect(200);
    expect(
      (await prisma.workItem.findUniqueOrThrow({ where: { id: task.id } })).remindedAt,
    ).not.toBeNull();

    await api(manager.token)
      .patch(url)
      .send({ dueDate: hoursFromNow(48).toISOString() })
      .expect(200);
    expect(
      (await prisma.workItem.findUniqueOrThrow({ where: { id: task.id } })).remindedAt,
    ).toBeNull();
  });

  it('clears the due date with null', async () => {
    const task = await makeTask({ project, dueDate: hoursFromNow(5) });
    const res = await api(manager.token)
      .patch(`/api/work-items/${task.id}`)
      .send({ dueDate: null });
    expect(res.status).toBe(200);
    expect(res.body.data.dueDate).toBeNull();
  });
});

describe('delete', () => {
  it('cascades to comments and notifications, and keeps the people', async () => {
    const task = await makeTask({ project, assignee: member });
    await prisma.comment.create({ data: { workItemId: task.id, userId: member.id, body: 'Hi' } });
    await prisma.notification.create({
      data: { userId: member.id, type: 'ASSIGNED', workItemId: task.id, message: 'x' },
    });

    await api(admin.token).delete(`/api/work-items/${task.id}`).expect(204);

    expect(await prisma.workItem.count()).toBe(0);
    expect(await prisma.comment.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.user.count()).toBe(3);
    await api(admin.token).delete(`/api/work-items/${task.id}`).expect(404);
  });
});

describe('listing', () => {
  it('pages without overlaps or gaps when many rows share createdAt', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    await prisma.workItem.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        type: WorkItemType.TASK,
        status: 'TODO' as const,
        title: `Same time ${i}`,
        description: 'x',
        projectId: project.id,
        requesterId: manager.id,
        createdAt,
      })),
    });

    for (const order of ['desc', 'asc']) {
      const seen: string[] = [];
      for (const page of [1, 2, 3]) {
        const res = await api(admin.token).get(
          `/api/work-items?sortBy=createdAt&order=${order}&limit=10&page=${page}`,
        );
        expect(res.body.meta).toMatchObject({ total: 25, totalPages: 3, hasNext: page < 3 });
        seen.push(...res.body.data.map((item: { id: string }) => item.id));
      }
      expect(seen).toHaveLength(25);
      expect(new Set(seen).size).toBe(25);
    }
  });

  describe('filters', () => {
    beforeEach(async () => {
      const other = await makeProject({ manager, name: 'Other' });
      const overdue = await makeTask({
        project,
        title: 'Login loop',
        status: 'TODO',
        priority: 'LOW',
        assignee: member,
        dueDate: hoursFromNow(1),
      });
      // The API refuses past dates, so make it overdue directly.
      await prisma.workItem.update({
        where: { id: overdue.id },
        data: { dueDate: hoursFromNow(-2) },
      });
      await makeTask({
        project,
        title: 'Dashboard charts',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        assignee: member,
        dueDate: hoursFromNow(48),
      });
      const done = await makeTask({
        project,
        title: 'Old release',
        status: 'DONE',
        priority: 'URGENT',
        dueDate: hoursFromNow(1),
      });
      await prisma.workItem.update({
        where: { id: done.id },
        data: { dueDate: hoursFromNow(-48) },
      });
      await makeTicket({
        project,
        requester: member,
        title: 'Password reset',
        description: 'The LOGIN email never arrives',
      });
      await makeTicket({
        project: other,
        requester: manager,
        title: 'Other ticket',
        priority: 'HIGH',
      });
    });

    it.each([
      ['status list', '?status=TODO,IN_PROGRESS', ['Dashboard charts', 'Login loop']],
      [
        'priority list',
        '?priority=HIGH,URGENT',
        ['Dashboard charts', 'Old release', 'Other ticket'],
      ],
      ['type', '?type=TICKET', ['Other ticket', 'Password reset']],
      ['overdue (unfinished only)', '?overdue=true', ['Login loop']],
      ['search in title and description, any case', '?q=login', ['Login loop', 'Password reset']],
      ['combined filters', '?type=TASK&priority=LOW,HIGH&status=IN_PROGRESS', ['Dashboard charts']],
    ])('%s', async (_name, query, expected) => {
      const res = await api(admin.token).get(`/api/work-items${query}`);
      expect(res.status).toBe(200);
      expect(titles(res)).toEqual(expected);
      expect(res.body.meta.total).toBe(expected.length);
    });

    it('filters by project', async () => {
      const res = await api(admin.token).get(`/api/work-items?projectId=${project.id}`);
      expect(res.body.meta.total).toBe(4);
    });

    it('filters "mine" by assigned and raised', async () => {
      const assigned = await api(member.token).get('/api/work-items?mine=assigned');
      const raised = await api(member.token).get('/api/work-items?mine=raised');
      expect(titles(assigned)).toEqual(['Dashboard charts', 'Login loop']);
      expect(titles(raised)).toEqual(['Password reset']);
    });

    it('sorts by priority and by due date (no due date last)', async () => {
      const byPriority = await api(admin.token).get('/api/work-items?sortBy=priority&order=desc');
      expect(byPriority.body.data.map((item: { priority: string }) => item.priority)).toEqual([
        'URGENT',
        'HIGH',
        'HIGH',
        'MEDIUM',
        'LOW',
      ]);

      const byDue = await api(admin.token).get('/api/work-items?sortBy=dueDate&order=asc');
      expect(byDue.body.data.map((item: { title: string }) => item.title).slice(0, 3)).toEqual([
        'Old release',
        'Login loop',
        'Dashboard charts',
      ]);
      expect(byDue.body.data.at(-1).dueDate).toBeNull();
    });

    it.each([
      ['limit over 100', '?limit=101'],
      ['unknown status', '?status=TODO,BOGUS'],
      ['unknown sort field', '?sortBy=passwordHash'],
      ['dueFrom after dueTo', '?dueFrom=2026-12-01&dueTo=2026-11-01'],
      ['malformed project id', '?projectId=abc'],
    ])('rejects %s with 400', async (_name, query) => {
      const res = await api(admin.token).get(`/api/work-items${query}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('dashboard summary', () => {
  it('counts the caller’s own work', async () => {
    const overdue = await makeTask({ project, assignee: member, dueDate: hoursFromNow(1) });
    await prisma.workItem.update({
      where: { id: overdue.id },
      data: { dueDate: hoursFromNow(-1) },
    });
    await makeTask({ project, assignee: member, status: 'IN_PROGRESS', dueDate: hoursFromNow(3) });
    await makeTicket({ requester: member });
    await makeTicket({ requester: member, status: 'CLOSED' });

    const res = await api(member.token).get('/api/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      assignedToMe: { TODO: 1, IN_PROGRESS: 1 },
      overdue: 1,
      dueSoon: 1,
      raisedByMe: { open: 1, closed: 1 },
      unreadNotifications: 0,
      projects: 1,
    });
  });
});
