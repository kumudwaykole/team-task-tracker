import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { api } from './helpers/auth.js';
import { createUser } from './helpers/factories.js';

const valid = { name: 'Asha Rao', email: 'asha@example.com', password: 'Password@123' };

describe('POST /api/auth/register', () => {
  it('creates a MEMBER and returns a token without the password hash', async () => {
    const res = await api().post('/api/auth/register').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      name: 'Asha Rao',
      email: 'asha@example.com',
      role: 'MEMBER',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('rejects a "role" field (strict schema) and creates nobody', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ ...valid, role: 'ADMIN' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects a duplicate email in different casing with 409', async () => {
    await api().post('/api/auth/register').send(valid).expect(201);
    const res = await api()
      .post('/api/auth/register')
      .send({ ...valid, email: ' ASHA@Example.COM ' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('reports every invalid field in details[]', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'weak' });

    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((issue: { path: string }) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('stores a bcrypt hash, never the password', async () => {
    await api().post('/api/auth/register').send(valid).expect(201);
    const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { email: valid.email } });

    expect(passwordHash).not.toBe(valid.password);
    expect(await bcrypt.compare(valid.password, passwordHash)).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token and the user', async () => {
    const user = await createUser({ email: 'lee@example.com' });
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'LEE@example.com', password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'MEMBER',
    });
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const user = await createUser();
    const wrongPassword = await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Wrong@1234' });
    const unknownEmail = await api()
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Wrong@1234' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /api/auth/me and token checks', () => {
  it('returns the current user', async () => {
    const user = await createUser();
    const res = await api(user.token).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: user.id, role: 'MEMBER' });
  });

  it.each([
    ['no Authorization header', undefined],
    ['a non-Bearer scheme', 'Token abc'],
    ['"Bearer" without a token', 'Bearer'],
    ['a garbage token', 'Bearer not.a.jwt'],
  ])('rejects %s with 401', async (_case, header) => {
    const req = api().get('/api/auth/me');
    const res = await (header ? req.set('Authorization', header) : req);
    expect(res.status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const user = await createUser();
    const [header, , signature] = user.token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: user.id, role: 'ADMIN', exp: 9999999999 }),
    ).toString('base64url');

    const res = await api(`${header}.${forgedPayload}.${signature}`).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token with TOKEN_EXPIRED', async () => {
    const user = await createUser();
    const expired = jwt.sign(
      { sub: user.id, exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_SECRET,
    );

    const res = await api(expired).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects "alg: none" and tokens signed with another secret', async () => {
    const user = await createUser();
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: user.id, exp: 9999999999 })}.`;
    const otherSecret = jwt.sign({ sub: user.id }, 'some-other-secret-some-other-secret-1234', {
      expiresIn: '1h',
    });

    for (const token of [none, otherSecret]) {
      const res = await api(token).get('/api/auth/me');
      expect(res.status).toBe(401);
    }
  });

  it('rejects a valid token once the user is deleted', async () => {
    const user = await createUser();
    await prisma.user.delete({ where: { id: user.id } });

    const res = await api(user.token).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('applies a role change on the next request, with the same token', async () => {
    const user = await createUser();
    await api(user.token).get('/api/users').expect(403);

    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });

    await api(user.token).get('/api/users').expect(200);
  });
});

// The limiters keep their counts in memory for the whole file, so the test that uses up the
// failed-login budget runs last.
describe('rate limiting', () => {
  const limitedApp = createApp({ rateLimit: true });

  it('does not count successful logins', async () => {
    const user = await createUser();
    for (let i = 0; i < 12; i++) {
      await api(undefined, limitedApp)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);
    }
  });

  it('allows 10 registrations per window, then answers 429', async () => {
    const register = (n: number) =>
      api(undefined, limitedApp)
        .post('/api/auth/register')
        .send({ ...valid, email: `person${n}@example.com` });

    for (let i = 0; i < 10; i++) expect((await register(i)).status).toBe(201);
    expect((await register(10)).status).toBe(429);
  });

  it('blocks the 11th failed login within the window with 429', async () => {
    const attempt = () =>
      api(undefined, limitedApp)
        .post('/api/auth/login')
        .send({ email: 'x@example.com', password: 'Wrong@1234' });

    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(401);
    const res = await attempt();

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});
