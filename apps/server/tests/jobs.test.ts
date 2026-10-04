import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, runInTransaction } from '../src/config/prisma.js';
import { Role } from '../src/generated/prisma/enums.js';
import { runCleanupJob } from '../src/jobs/cleanup.job.js';
import { runDueSoonJob } from '../src/jobs/dueSoon.job.js';
import { claimDueSoon } from '../src/modules/workItems/workItems.repository.js';
import { api } from './helpers/auth.js';
import { notificationsFor, sleep } from './helpers/db.js';
import {
  createUser,
  hoursFromNow,
  makeNotification,
  makeProject,
  makeTask,
  makeTicket,
  type TestUser,
} from './helpers/factories.js';

let manager: TestUser;
let member: TestUser;
let project: Awaited<ReturnType<typeof makeProject>>;

beforeEach(async () => {
  [manager, member] = await Promise.all([createUser({ role: Role.MANAGER }), createUser()]);
  project = await makeProject({ manager, members: [member] });
});

const dueSoonRows = () => prisma.notification.findMany({ where: { type: 'DUE_SOON' } });

describe('due-soon reminder job', () => {
  it('reminds the assignee of an item due in 2 hours and marks it reminded', async () => {
    const task = await makeTask({
      project,
      assignee: member,
      title: 'Ship it',
      dueDate: hoursFromNow(2),
    });

    expect(await runDueSoonJob()).toBe(1);

    const [row] = await notificationsFor(member.id);
    expect(row).toMatchObject({
      type: 'DUE_SOON',
      workItemId: task.id,
      message: '"Ship it" is due within 24 hours',
    });
    expect(
      (await prisma.workItem.findUniqueOrThrow({ where: { id: task.id } })).remindedAt,
    ).not.toBeNull();
  });

  it('does not remind twice', async () => {
    await makeTask({ project, assignee: member, dueDate: hoursFromNow(2) });

    expect(await runDueSoonJob()).toBe(1);
    expect(await runDueSoonJob()).toBe(0);
    expect(await dueSoonRows()).toHaveLength(1);
  });

  it('sends one reminder when two runs overlap', async () => {
    await makeTask({ project, assignee: member, dueDate: hoursFromNow(2) });

    await Promise.all([runDueSoonJob(), runDueSoonJob()]);

    expect(await dueSoonRows()).toHaveLength(1);
  });

  it('claims each item once across parallel transactions (SKIP LOCKED)', async () => {
    await makeTask({ project, assignee: member, dueDate: hoursFromNow(2) });
    // Two claims at once, each holding its transaction open for a moment, as two instances would.
    const claim = () =>
      runInTransaction(async (tx) => {
        const rows = await claimDueSoon(tx, 24, 10);
        await sleep(200);
        return rows;
      });

    const [first, second] = await Promise.all([claim(), claim()]);

    expect(first.length + second.length).toBe(1);
  });

  it('skips finished, unassigned, undated and far-off items', async () => {
    await makeTask({ project, assignee: member, status: 'DONE', dueDate: hoursFromNow(2) });
    await makeTicket({
      project,
      requester: member,
      assignee: manager,
      status: 'CLOSED',
      dueDate: hoursFromNow(2),
    });
    await makeTask({ project, dueDate: hoursFromNow(2) }); // unassigned
    await makeTask({ project, assignee: member }); // no due date
    await makeTask({ project, assignee: member, dueDate: hoursFromNow(72) });

    expect(await runDueSoonJob()).toBe(0);
    expect(await dueSoonRows()).toHaveLength(0);
  });

  it('reminds again after the due date changes', async () => {
    const task = await makeTask({ project, assignee: member, dueDate: hoursFromNow(2) });
    await runDueSoonJob();

    await api(manager.token)
      .patch(`/api/work-items/${task.id}`)
      .send({ dueDate: hoursFromNow(10).toISOString() })
      .expect(200);

    expect(await runDueSoonJob()).toBe(1);
    expect(await dueSoonRows()).toHaveLength(2);
  });

  it('tells the assignee when an item is already overdue', async () => {
    const task = await makeTask({
      project,
      assignee: member,
      title: 'Late one',
      dueDate: hoursFromNow(1),
    });
    await prisma.workItem.update({ where: { id: task.id }, data: { dueDate: hoursFromNow(-5) } });

    await runDueSoonJob();

    expect((await notificationsFor(member.id))[0]?.message).toBe('"Late one" is overdue');
  });
});

describe('notification cleanup job', () => {
  it('deletes read notifications past the retention period and keeps the rest', async () => {
    const daysAgo = (days: number) => hoursFromNow(-24 * days);
    await makeNotification({ user: member, isRead: true, createdAt: daysAgo(100) }); // deleted
    const recentRead = await makeNotification({
      user: member,
      isRead: true,
      createdAt: daysAgo(10),
    });
    const oldUnread = await makeNotification({
      user: member,
      isRead: false,
      createdAt: daysAgo(100),
    });

    expect(await runCleanupJob()).toBe(1);

    const left = (await prisma.notification.findMany()).map((n) => n.id).sort();
    expect(left).toEqual([recentRead.id, oldUnread.id].sort());
  });
});
