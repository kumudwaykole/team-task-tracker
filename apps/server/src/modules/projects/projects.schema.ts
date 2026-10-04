import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination.js';

const name = z.string().trim().min(2).max(100);

export const memberParams = z.object({ id: z.uuid('Invalid id'), userId: z.uuid('Invalid id') });

export const createProjectSchema = z
  .object({
    name,
    // Required when an Admin creates the project; ignored for Managers (they become the manager).
    managerId: z.uuid().optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    name: name.optional(),
    // Only an Admin may change it; enforced in the service.
    managerId: z.uuid().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field');

export const addMembersSchema = z.object({ userIds: z.array(z.uuid()).min(1).max(50) }).strict();

export const listProjectsQuery = paginationSchema.extend({
  sortBy: z.enum(['createdAt', 'name']).default('createdAt'),
});

export const listMembersQuery = paginationSchema.extend({
  sortBy: z.enum(['addedAt', 'name']).default('addedAt'),
});

export type MemberParams = z.infer<typeof memberParams>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddMembersInput = z.infer<typeof addMembersSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuery>;
export type ListMembersQuery = z.infer<typeof listMembersQuery>;
