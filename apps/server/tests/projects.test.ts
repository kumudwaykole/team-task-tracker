import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { Role } from '../src/generated/prisma/enums.js';
import { api } from './helpers/auth.js';
import {
  createUser,
  makeProject,
  makeTask,
  makeTicket,
  type TestUser,
} from './helpers/factories.js';

let admin: TestUser;
let manager: TestUser;
let otherManager: TestUser;
let member: TestUser;

beforeEach(async () => {
  [admin, manager, otherManager, member] = await Promise.all([
    createUser({ role: Role.ADMIN }),
    createUser({ role: Role.MANAGER }),
    createUser({ role: Role.MANAGER }),
    createUser({ name: 'Zed Member' }),
  ]);
});

describe('creating and editing projects', () => {
  it('requires an Admin to name a MANAGER as the manager', async () => {
    const missing = await api(admin.token).post('/api/projects').send({ name: 'No manager' });
    const notAManager = await api(admin.token)
      .post('/api/projects')
      .send({ name: 'Bad', managerId: member.id });

    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('INVALID_MANAGER');
    expect(notAManager.body.error.code).toBe('INVALID_MANAGER');
  });

  it('rejects a duplicate name for the same manager, but not for another', async () => {
    await api(manager.token).post('/api/projects').send({ name: 'Website' }).expect(201);
    const duplicate = await api(manager.token).post('/api/projects').send({ name: 'Website' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('PROJECT_NAME_TAKEN');

    await api(otherManager.token).post('/api/projects').send({ name: 'Website' }).expect(201);
  });

  it('returns member and work item counts', async () => {
    const project = await makeProject({ manager, members: [member] });
    await makeTask({ project });
    const res = await api(manager.token).get(`/api/projects/${project.id}`);
    expect(res.body.data).toMatchObject({
      id: project.id,
      manager: { id: manager.id },
      _count: { members: 1, workItems: 1 },
    });
  });

  it('deletes an empty project', async () => {
    const project = await makeProject({ manager, members: [member] });
    await api(manager.token).delete(`/api/projects/${project.id}`).expect(204);
    expect(await prisma.project.count()).toBe(0);
  });
});

describe('listing projects', () => {
  beforeEach(async () => {
    for (const name of ['Charlie', 'alpha', 'Bravo']) await makeProject({ manager, name });
  });

  it('searches by name and sorts with pagination', async () => {
    const res = await api(manager.token).get('/api/projects?sortBy=name&order=asc&limit=2');
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(['alpha', 'Bravo']);
    expect(res.body.meta).toMatchObject({ total: 3, totalPages: 2, hasNext: true });

    const search = await api(manager.token).get('/api/projects?q=ALP');
    expect(search.body.data.map((p: { name: string }) => p.name)).toEqual(['alpha']);
  });
});

describe('members', () => {
  it('adds members idempotently and ignores duplicate ids', async () => {
    const project = await makeProject({ manager });
    const url = `/api/projects/${project.id}/members`;

    const first = await api(manager.token)
      .post(url)
      .send({ userIds: [member.id, member.id] });
    expect(first.body.data).toEqual({ added: 1 });
    const again = await api(manager.token)
      .post(url)
      .send({ userIds: [member.id] });
    expect(again.body.data).toEqual({ added: 0 });
  });

  it('rejects unknown user ids', async () => {
    const project = await makeProject({ manager });
    const res = await api(manager.token)
      .post(`/api/projects/${project.id}/members`)
      .send({ userIds: ['0190f000-0000-7000-8000-000000000000'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_MEMBER');
  });

  it('lists and searches members', async () => {
    const other = await createUser({ name: 'Amy Member' });
    const project = await makeProject({ manager, members: [member, other] });

    const res = await api(manager.token).get(
      `/api/projects/${project.id}/members?sortBy=name&order=asc`,
    );
    expect(res.body.data.map((m: { name: string }) => m.name)).toEqual([
      'Amy Member',
      'Zed Member',
    ]);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({ id: other.id, role: 'MEMBER', addedAt: expect.any(String) }),
    );

    const search = await api(manager.token).get(`/api/projects/${project.id}/members?q=zed`);
    expect(search.body.meta.total).toBe(1);
  });

  it('removes a member once their work is finished, and 404s a non-member', async () => {
    const project = await makeProject({ manager, members: [member] });
    await makeTask({ project, assignee: member, status: 'DONE' });

    await api(manager.token).delete(`/api/projects/${project.id}/members/${member.id}`).expect(204);
    await api(manager.token).delete(`/api/projects/${project.id}/members/${member.id}`).expect(404);
  });
});

describe('board', () => {
  it('returns every column of the chosen type in order, with totals and a per-column cap', async () => {
    const project = await makeProject({ manager, members: [member] });
    for (let i = 0; i < 3; i++) await makeTask({ project, status: 'TODO' });
    await makeTask({ project, status: 'DONE' });
    await makeTicket({ project, requester: member });

    const tasks = await api(member.token).get(`/api/projects/${project.id}/board?perColumn=2`);
    expect(tasks.status).toBe(200);
    expect(tasks.body.data.type).toBe('TASK');
    expect(
      tasks.body.data.columns.map((c: { status: string; total: number; items: unknown[] }) => [
        c.status,
        c.total,
        c.items.length,
      ]),
    ).toEqual([
      ['TODO', 3, 2],
      ['IN_PROGRESS', 0, 0],
      ['IN_REVIEW', 0, 0],
      ['DONE', 1, 1],
    ]);

    const tickets = await api(member.token).get(`/api/projects/${project.id}/board?type=TICKET`);
    expect(tickets.body.data.columns.map((c: { status: string }) => c.status)).toEqual([
      'OPEN',
      'IN_PROGRESS',
      'ESCALATED',
      'RESOLVED',
      'CLOSED',
    ]);
    expect(tickets.body.data.columns[0].total).toBe(1);
  });
});
