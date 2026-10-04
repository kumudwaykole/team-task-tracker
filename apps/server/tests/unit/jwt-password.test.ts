import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { signToken, verifyToken } from '../../src/utils/jwt.js';
import { hashPassword, verifyPassword } from '../../src/utils/password.js';

const user = { id: '0190f000-0000-7000-8000-000000000001', role: 'MEMBER' as const };
const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

const rejectionOf = (token: string) => {
  try {
    verifyToken(token);
  } catch (err) {
    return err;
  }
  return undefined;
};

describe('password hashing', () => {
  it('round-trips and rejects a wrong password', async () => {
    const hash = await hashPassword('Password@123');
    expect(hash).not.toBe('Password@123');
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(verifyPassword('Password@123', hash)).resolves.toBe(true);
    await expect(verifyPassword('password@123', hash)).resolves.toBe(false);
  });
});

describe('JWT', () => {
  it('round-trips the user id and expiry', () => {
    const { userId, expiresAt } = verifyToken(signToken(user));
    expect(userId).toBe(user.id);
    expect(expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects a token signed with another secret', () => {
    const token = jwt.sign({ sub: user.id }, 'another-secret-another-secret-another-secret', {
      algorithm: 'HS256',
    });
    expect(rejectionOf(token)).toMatchObject({ statusCode: 401, code: 'INVALID_TOKEN' });
  });

  it('rejects an expired token with TOKEN_EXPIRED', () => {
    const token = jwt.sign(
      { sub: user.id, exp: Math.floor(Date.now() / 1000) - 60 },
      env.JWT_SECRET,
    );
    expect(rejectionOf(token)).toMatchObject({ statusCode: 401, code: 'TOKEN_EXPIRED' });
  });

  it('rejects "alg: none"', () => {
    const token = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub: user.id, exp: 9999999999 })}.`;
    expect(rejectionOf(token)).toMatchObject({ statusCode: 401, code: 'INVALID_TOKEN' });
  });

  it('accepts only the pinned algorithm (HS256), even with the right secret', () => {
    const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, {
      algorithm: 'HS512',
      expiresIn: '1h',
    });
    expect(rejectionOf(token)).toMatchObject({ statusCode: 401, code: 'INVALID_TOKEN' });
  });

  it('rejects a token without a subject', () => {
    const token = jwt.sign({ role: 'ADMIN' }, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
    expect(rejectionOf(token)).toMatchObject({ statusCode: 401, code: 'INVALID_TOKEN' });
  });
});
