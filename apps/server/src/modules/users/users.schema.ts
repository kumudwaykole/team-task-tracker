import { z } from 'zod';
import { Role } from '../../generated/prisma/enums.js';
import { paginationSchema } from '../../utils/pagination.js';
import { registerSchema } from '../auth/auth.schema.js';

const role = z.enum(Role);

export const createUserSchema = registerSchema.extend({ role }).strict();

export const changeRoleSchema = z.object({ role }).strict();

export const listUsersQuery = paginationSchema.extend({
  role: role.optional(),
  sortBy: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuery>;
