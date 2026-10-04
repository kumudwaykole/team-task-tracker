import type { Role } from '../generated/prisma/enums.js';

/** The authenticated user attached to `req.user`. Loaded from the DB on every request. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
