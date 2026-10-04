import { describe, expect, it } from 'vitest';
import { api } from './helpers/auth.js';
import { createUser } from './helpers/factories.js';

describe('API basics', () => {
  it('reports health with a database check', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok', database: 'up' } });
  });

  it('answers unknown API paths with a JSON 404', async () => {
    const res = await api().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route GET /api/nope not found' },
    });
  });

  it('rejects malformed JSON with 400 BAD_JSON', async () => {
    const res = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_JSON');
  });

  it('rejects an oversized body with 413', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'a@b.co', password: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
  });

  it('validates ids before they reach the database', async () => {
    const user = await createUser();
    const res = await api(user.token).get('/api/work-items/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ location: 'params', path: 'id' });
  });

  it('never sends stack traces', async () => {
    const res = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(JSON.stringify(res.body)).not.toMatch(/at .+\.(ts|js):\d+/);
  });

  it('marks API GET responses as revalidate-every-time', async () => {
    const res = await api().get('/api/health');
    expect(res.headers['cache-control']).toBe('private, no-cache');
  });
});
