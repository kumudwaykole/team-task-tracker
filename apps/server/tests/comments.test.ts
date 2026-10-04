import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Role } from '../src/generated/prisma/enums.js';
import { api } from './helpers/auth.js';
import { createUser, makeProject, makeTask, type TestUser } from './helpers/factories.js';

let manager: TestUser;
let member: TestUser;
let url: string;

beforeEach(async () => {
  [manager, member] = await Promise.all([
    createUser({ role: Role.MANAGER }),
    createUser({ name: 'Member Ann' }),
  ]);
  const project = await makeProject({ manager, members: [member] });
  const task = await makeTask({ project, assignee: member });
  url = `/api/work-items/${task.id}/comments`;
});

describe('comments', () => {
  it('adds a trimmed comment with its author', async () => {
    const res = await api(member.token).post(url).send({ body: '  On it  ' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      body: 'On it',
      user: { id: member.id, name: 'Member Ann' },
    });
  });

  it('lists oldest first by default, newest first on request, with pagination', async () => {
    for (const body of ['first', 'second', 'third']) {
      await api(member.token).post(url).send({ body }).expect(201);
    }

    const asc = await api(manager.token).get(`${url}?limit=2`);
    expect(asc.body.data.map((c: { body: string }) => c.body)).toEqual(['first', 'second']);
    expect(asc.body.meta).toMatchObject({ total: 3, totalPages: 2, hasNext: true });

    const desc = await api(manager.token).get(`${url}?order=desc`);
    expect(desc.body.data.map((c: { body: string }) => c.body)).toEqual([
      'third',
      'second',
      'first',
    ]);
  });

  it.each([
    ['an empty body', { body: '   ' }],
    ['a body over 2000 characters', { body: 'x'.repeat(2001) }],
    ['an unknown field', { body: 'Hi', userId: 'someone' }],
  ])('rejects %s', async (_name, payload) => {
    const res = await api(member.token).post(url).send(payload);
    expect(res.status).toBe(400);
  });

  it('gives 404 for an unknown work item', async () => {
    const res = await api(manager.token).get(
      '/api/work-items/0190f000-0000-7000-8000-000000000000/comments',
    );
    expect(res.status).toBe(404);
  });

  it('limits each user to 30 comments a minute', async () => {
    const limited = createApp({ rateLimit: true });
    for (let i = 0; i < 30; i++) {
      await api(member.token, limited)
        .post(url)
        .send({ body: `#${i}` })
        .expect(201);
    }
    const res = await api(member.token, limited).post(url).send({ body: 'one too many' });
    expect(res.status).toBe(429);

    // The limit is per user, so someone else can still comment.
    await api(manager.token, limited).post(url).send({ body: 'Manager here' }).expect(201);
  }, 60_000);
});
