import { beforeEach, describe, expect, it } from 'vitest';
import { Role } from '../src/generated/prisma/enums.js';
import { api } from './helpers/auth.js';
import { createUser, makeProject, type TestUser } from './helpers/factories.js';

let admin: TestUser;
let manager: TestUser;

beforeEach(async () => {
  [admin, manager] = await Promise.all([
    createUser({ role: Role.ADMIN, name: 'Ada Admin' }),
    createUser({ role: Role.MANAGER, name: 'Max Manager' }),
  ]);
  await createUser({ name: 'Mia Member', email: 'mia@example.com' });
});

describe('users (Admin)', () => {
  it('lists with role filter, search and pagination, never exposing password hashes', async () => {
    const managers = await api(admin.token).get('/api/users?role=MANAGER');
    expect(managers.body.data.map((u: { name: string }) => u.name)).toEqual(['Max Manager']);

    const search = await api(admin.token).get('/api/users?q=MIA');
    expect(search.body.data.map((u: { email: string }) => u.email)).toEqual(['mia@example.com']);

    const paged = await api(admin.token).get('/api/users?sortBy=name&order=asc&limit=2');
    expect(paged.body.data.map((u: { name: string }) => u.name)).toEqual([
      'Ada Admin',
      'Max Manager',
    ]);
    expect(paged.body.meta).toMatchObject({ total: 3, hasNext: true });
    expect(JSON.stringify(paged.body)).not.toMatch(/passwordHash/);
  });

  it('creates a user who can then log in', async () => {
    const body = {
      name: 'New Manager',
      email: 'new.manager@example.com',
      password: 'Password@123',
      role: 'MANAGER',
    };
    const created = await api(admin.token).post('/api/users').send(body);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ email: body.email, role: 'MANAGER' });

    const login = await api()
      .post('/api/auth/login')
      .send({ email: body.email, password: body.password });
    expect(login.body.data.user.role).toBe('MANAGER');
  });

  it('rejects a duplicate email', async () => {
    const res = await api(admin.token)
      .post('/api/users')
      .send({ name: 'Copy', email: 'MIA@example.com', password: 'Password@123', role: 'MEMBER' });
    expect(res.status).toBe(409);
  });

  it('will not demote a Manager who still owns projects', async () => {
    await makeProject({ manager });
    const res = await api(admin.token)
      .patch(`/api/users/${manager.id}/role`)
      .send({ role: 'MEMBER' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MANAGER_OWNS_PROJECTS');
  });

  it('treats setting the same role as a no-op and 404s unknown users', async () => {
    await api(admin.token)
      .patch(`/api/users/${manager.id}/role`)
      .send({ role: 'MANAGER' })
      .expect(200);
    await api(admin.token)
      .patch('/api/users/0190f000-0000-7000-8000-000000000000/role')
      .send({ role: 'MANAGER' })
      .expect(404);
  });
});
