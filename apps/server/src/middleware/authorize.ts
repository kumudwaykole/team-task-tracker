import type { RequestHandler } from 'express';
import type { Role } from '../generated/prisma/enums.js';
import { forbidden, unauthorized } from '../utils/AppError.js';

/**
 * Layer 2 of RBAC: is your role allowed on this route?
 * Coarse check only. "Is this YOUR project / item?" belongs to the module policy and scope functions.
 *
 * @example router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), validate({ body }), controller.create)
 */
export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
