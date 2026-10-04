import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, runInTransaction } from '../src/config/prisma.js';
import { Role } from '../src/generated/prisma/enums.js';
import * as notificationsRepository from '../src/modules/notifications/notifications.repository.js';
import { api } from './helpers/auth.js';
import { notificationsFor } from './helpers/db.js';
import {
  createUser,
  hoursFromNow,
  makeNotification,
  makeProject,
  makeTask,
  makeTicket,
  type TestUser,
} from './helpers/factories.js';

let admin: TestUser;
let manager: TestUser;
let assignee: TestUser;
let requester: TestUser;
let project: Awaited<ReturnType<typeof makeProject>>;

beforeEach(async () => {
  [admin, manager, assignee, requester] = await Promise.all([
    createUser({ role: Role.ADMIN }),
    createUser({ role: Role.MANAGER }),
    createUser(),
    createUser(),
  ]);
  project = await makeProject({ manager, members: [assignee, requester] });
});

/** `{ userId: [types] }` for every notification in the database. */
async function inbox() {
  const rows = await prisma.notification.findMany({ orderBy: { createdAt: 'asc' } });
  const byUser: Record<string, string[]> = {};
  for (const row of rows) (byUser[row.userId] ??= []).push(row.type);
  return byUser;
}

describe('who gets notified', () => {
  it('notifies the assignee of an assignment, not the person assigning', async () => {
    await api(manager.token)
      .post('/api/work-items')
      .send({
        type: 'TASK',
        title: 'Ship it',
        description: 'x',
        projectId: project.id,
        assigneeId: assignee.id,
      })
      .expect(201);

    expect(await inbox()).toEqual({ [assignee.id]: ['ASSIGNED'] });
    expect((await notificationsFor(assignee.id))[0]?.message).toBe(
      `${manager.name} assigned you "Ship it"`,
    );
  });

  it('notifies requester, assignee and manager of a status change, minus the actor', async () => {
    const ticket = await makeTicket({ project, requester, assignee });

    await api(admin.token)
      .patch(`/api/work-items/${ticket.id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(await inbox()).toEqual({
      [requester.id]: ['STATUS_CHANGED'],
      [assignee.id]: ['STATUS_CHANGED'],
      [manager.id]: ['STATUS_CHANGED'],
    });

    await api(assignee.token)
      .patch(`/api/work-items/${ticket.id}`)
      .send({ status: 'RESOLVED' })
      .expect(200);
    const after = await inbox();
    expect(after[assignee.id]).toHaveLength(1); // the actor got nothing new
    expect(after[requester.id]).toHaveLength(2);
    expect(after[manager.id]).toHaveLength(2);
  });

  it('notifies a person once when they hold several roles', async () => {
    // Raised by the manager, so requester and manager are the same person.
    const task = await makeTask({ project, assignee });
    await api(assignee.token)
      .patch(`/api/work-items/${task.id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    expect(await inbox()).toEqual({ [manager.id]: ['STATUS_CHANGED'] });
  });

  it('notifies the same people of a comment, minus the commenter', async () => {
    const ticket = await makeTicket({ project, requester, assignee });
    await api(requester.token)
      .post(`/api/work-items/${ticket.id}/comments`)
      .send({ body: 'Any news?' })
      .expect(201);

    expect(await inbox()).toEqual({ [assignee.id]: ['COMMENTED'], [manager.id]: ['COMMENTED'] });
  });

  it('notifies both sides of a reassignment and status change in one request', async () => {
    const task = await makeTask({ project });
    await api(manager.token)
      .patch(`/api/work-items/${task.id}`)
      .send({ assigneeId: assignee.id, status: 'IN_PROGRESS' })
      .expect(200);

    expect((await inbox())[assignee.id]?.sort()).toEqual(['ASSIGNED', 'STATUS_CHANGED']);
  });

  it('announces a project ticket to the project manager only', async () => {
    await api(requester.token)
      .post('/api/work-items')
      .send({ type: 'TICKET', title: 'Broken', description: 'x', projectId: project.id })
      .expect(201);

    expect(await inbox()).toEqual({ [manager.id]: ['TICKET_CREATED'] });
  });

  it('announces a project-less ticket to every Admin, never to the requester', async () => {
    const secondAdmin = await createUser({ role: Role.ADMIN });
    await api(requester.token)
      .post('/api/work-items')
      .send({ type: 'TICKET', title: 'VPN', description: 'x' })
      .expect(201);
    expect(await inbox()).toEqual({
      [admin.id]: ['TICKET_CREATED'],
      [secondAdmin.id]: ['TICKET_CREATED'],
    });

    // An Admin raising one is not told about their own ticket.
    await api(admin.token)
      .post('/api/work-items')
      .send({ type: 'TICKET', title: 'Printer', description: 'x' })
      .expect(201);
    const after = await inbox();
    expect(after[admin.id]).toHaveLength(1);
    expect(after[secondAdmin.id]).toHaveLength(2);
  });

  it('leaves no notification behind when the transaction rolls back', async () => {
    const task = await makeTask({ project, assignee });
    await expect(
      runInTransaction(async (tx) => {
        await notificationsRepository.createMany(
          [{ userId: assignee.id, type: 'ASSIGNED', workItemId: task.id, message: 'never seen' }],
          tx,
        );
        throw new Error('the change failed after the insert');
      }),
    ).rejects.toThrow('the change failed');

    expect(await prisma.notification.count()).toBe(0);
  });

  it('writes nothing when the change itself is rejected', async () => {
    const task = await makeTask({ project, assignee });
    await api(assignee.token)
      .patch(`/api/work-items/${task.id}`)
      .send({ status: 'DONE' })
      .expect(409);
    expect(await prisma.notification.count()).toBe(0);
  });
});

describe('notifications API', () => {
  let ids: { oldUnread: string; read: string; newUnread: string };

  beforeEach(async () => {
    const task = await makeTask({ project, assignee, dueDate: hoursFromNow(4) });
    const oldUnread = await makeNotification({
      user: assignee,
      workItem: task,
      createdAt: hoursFromNow(-3),
    });
    const read = await makeNotification({
      user: assignee,
      type: 'COMMENTED',
      isRead: true,
      createdAt: hoursFromNow(-2),
    });
    const newUnread = await makeNotification({
      user: assignee,
      type: 'DUE_SOON',
      createdAt: hoursFromNow(-1),
    });
    await makeNotification({ user: requester });
    ids = { oldUnread: oldUnread.id, read: read.id, newUnread: newUnread.id };
  });

  const listIds = (body: { data: { id: string }[] }) => body.data.map((n) => n.id);

  it('lists my notifications newest first, with the unread count in meta', async () => {
    const res = await api(assignee.token).get('/api/notifications');
    expect(res.status).toBe(200);
    expect(listIds(res.body)).toEqual([ids.newUnread, ids.read, ids.oldUnread]);
    expect(res.body.meta).toMatchObject({ total: 3, unreadCount: 2 });
    expect(res.body.data[0]).not.toHaveProperty('userId');
  });

  it('filters unread=true and parses unread=false as false', async () => {
    const unread = await api(assignee.token).get('/api/notifications?unread=true');
    expect(listIds(unread.body)).toEqual([ids.newUnread, ids.oldUnread]);
    expect(unread.body.meta).toMatchObject({ total: 2, unreadCount: 2 });

    const readOnly = await api(assignee.token).get('/api/notifications?unread=false');
    expect(listIds(readOnly.body)).toEqual([ids.read]);
    expect(readOnly.body.meta.unreadCount).toBe(2);
  });

  it('filters by type and caps the page size at 50', async () => {
    const dueSoon = await api(assignee.token).get('/api/notifications?type=DUE_SOON');
    expect(listIds(dueSoon.body)).toEqual([ids.newUnread]);

    await api(assignee.token).get('/api/notifications?limit=51').expect(400);
  });

  it('returns the unread count', async () => {
    const res = await api(assignee.token).get('/api/notifications/unread-count');
    expect(res.body.data).toEqual({ count: 2 });
  });

  it('marks one read, and repeating it is harmless', async () => {
    const first = await api(assignee.token).patch(`/api/notifications/${ids.oldUnread}/read`);
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ id: ids.oldUnread, isRead: true, unreadCount: 1 });

    const again = await api(assignee.token).patch(`/api/notifications/${ids.oldUnread}/read`);
    expect(again.status).toBe(200);
    expect(again.body.data.unreadCount).toBe(1);
  });

  it("gives 404 for someone else's notification and leaves it unread", async () => {
    const res = await api(requester.token).patch(`/api/notifications/${ids.newUnread}/read`);
    expect(res.status).toBe(404);
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: ids.newUnread } })).isRead,
    ).toBe(false);
  });

  it('marks all of mine read, and only mine', async () => {
    const res = await api(assignee.token).patch('/api/notifications/read-all');
    expect(res.body.data).toEqual({ updated: 2, unreadCount: 0 });
    expect(await prisma.notification.count({ where: { isRead: false } })).toBe(1); // requester's

    const again = await api(assignee.token).patch('/api/notifications/read-all');
    expect(again.body.data).toEqual({ updated: 0, unreadCount: 0 });
  });

  it("lets an Admin list one user's notifications, with the owner attached", async () => {
    const res = await api(admin.token).get(`/api/notifications?scope=all&userId=${assignee.id}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.data[0].user).toMatchObject({ id: assignee.id });

    await api(admin.token).get(`/api/notifications?userId=${assignee.id}`).expect(400);
  });
});
