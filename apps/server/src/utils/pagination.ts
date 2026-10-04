import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/**
 * Shared list query params. Modules extend it with their own whitelisted
 * `sortBy` enum and filters, e.g. `paginationSchema.extend({ sortBy: z.enum([...]) })`.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  order: z.enum(['asc', 'desc']).default('desc'),
  // Empty search text means "no search".
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export const toSkipTake = ({ page, limit }: { page: number; limit: number }) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const buildMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});

export type PaginationMeta = ReturnType<typeof buildMeta>;
