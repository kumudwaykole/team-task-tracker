import type { Request, RequestHandler } from 'express';
import { findAuthUserById } from '../modules/users/users.repository.js';
import type { AuthUser } from '../types/auth.js';
import { unauthorized } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Layer 1 of RBAC: who are you?
 * Verifies the JWT, then reloads the user from the DB so the database (not the token) decides the role.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = BEARER.exec(req.headers.authorization ?? '')?.[1];
  if (!token) throw unauthorized();

  const { userId } = verifyToken(token);
  const user = await findAuthUserById(userId);
  if (!user) throw unauthorized('Invalid token', 'INVALID_TOKEN');

  req.user = user;
  next();
};

/** Returns the user set by `authenticate`. Use in controllers behind `authenticate`. */
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
