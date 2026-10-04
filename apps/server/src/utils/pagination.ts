import { z } from 'zod';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

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

type PageQuery = Pick<z.infer<typeof paginationSchema>, 'page' | 'limit'>;
export type SortOrder = z.infer<typeof paginationSchema>['order'];

export const toSkipTake = ({ page, limit }: PageQuery) => ({
  skip: (page - 1) * limit,
  take: limit,
});

/**
 * `[{ [sortBy]: order }, { id: order }]`. The id tie-breaker keeps pages stable
 * when several rows share the same sort value. `sortBy` must come from a Zod enum.
 */
export const sortWithTieBreaker = <F extends string>(sortBy: F, order: SortOrder) => [
  { [sortBy]: order } as Partial<Record<F, SortOrder>>,
  { id: order },
];

export const buildMeta = ({ page, limit }: PageQuery, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});

export interface Paginated<T> {
  data: T[];
  meta: ReturnType<typeof buildMeta>;
}
