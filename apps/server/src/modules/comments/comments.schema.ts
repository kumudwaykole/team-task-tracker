import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination.js';

export const createCommentSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();

export const listCommentsQuery = paginationSchema.pick({ page: true }).extend({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuery>;
