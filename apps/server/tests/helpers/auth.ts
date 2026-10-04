import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Role } from '../../src/generated/prisma/enums.js';
import { signToken } from '../../src/utils/jwt.js';

// One app for the whole file. Rate limiting is off (NODE_ENV=test), except in the test that
// builds its own app with `createApp({ rateLimit: true })`.
const app = createApp();

/** A valid JWT for the user, without going through the login endpoint. */
export const loginAs = (user: { id: string; role: Role }) => signToken(user);

/** Supertest client that sends `Authorization: Bearer <token>` when a token is given. */
export function api(token?: string, target = app) {
  const call = (method: 'get' | 'post' | 'patch' | 'delete') => (url: string) => {
    const req = request(target)[method](url);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  return { get: call('get'), post: call('post'), patch: call('patch'), delete: call('delete') };
}
