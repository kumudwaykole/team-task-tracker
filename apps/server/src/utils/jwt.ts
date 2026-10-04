import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '../generated/prisma/enums.js';
import { AppError, unauthorized } from './AppError.js';

const ALGORITHM = 'HS256';

export function signToken(user: { id: string; role: Role }): string {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    // Format is validated in env.ts.
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] & string,
  });
}

/**
 * Verifies the signature and expiry and returns the user id and expiry time (ms).
 * The role inside the token is deliberately ignored: callers reload the user
 * from the database, so role changes and deletions apply immediately.
 */
export function verifyToken(token: string): { userId: string; expiresAt: number } {
  try {
    // Pinning the algorithm blocks "alg: none" and algorithm-swap attacks.
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      throw unauthorized('Invalid token', 'INVALID_TOKEN');
    }
    return { userId: payload.sub, expiresAt: payload.exp * 1000 };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError)
      throw unauthorized('Token has expired', 'TOKEN_EXPIRED');
    throw unauthorized('Invalid token', 'INVALID_TOKEN');
  }
}
