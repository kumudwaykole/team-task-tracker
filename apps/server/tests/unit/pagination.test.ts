import { describe, expect, it } from 'vitest';
import {
  buildMeta,
  paginationSchema,
  sortWithTieBreaker,
  toSkipTake,
} from '../../src/utils/pagination.js';

describe('buildMeta', () => {
  it('describes the first page', () => {
    expect(buildMeta({ page: 1, limit: 10 }, 25)).toEqual({
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
    });
  });

  it('describes the last page', () => {
    expect(buildMeta({ page: 3, limit: 10 }, 25)).toMatchObject({
      totalPages: 3,
      hasNext: false,
      hasPrev: true,
    });
  });

  it('describes an empty list', () => {
    expect(buildMeta({ page: 1, limit: 10 }, 0)).toMatchObject({
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('has no next page when the total is an exact multiple of the limit', () => {
    expect(buildMeta({ page: 2, limit: 10 }, 20)).toMatchObject({ totalPages: 2, hasNext: false });
  });
});

describe('paginationSchema', () => {
  it('applies defaults', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 10, order: 'desc' });
  });

  it('coerces query strings and treats blank search as none', () => {
    expect(paginationSchema.parse({ page: '2', limit: '50', q: '   ' })).toEqual({
      page: 2,
      limit: 50,
      order: 'desc',
    });
  });

  it.each([
    { limit: '101' },
    { limit: '0' },
    { page: '0' },
    { page: '1.5' },
    { order: 'sideways' },
  ])('rejects %o', (query) => {
    expect(paginationSchema.safeParse(query).success).toBe(false);
  });
});

describe('skip/take and sorting', () => {
  it('turns a page into an offset', () => {
    expect(toSkipTake({ page: 3, limit: 20 })).toEqual({ skip: 40, take: 20 });
  });

  it('always adds id as the tie-breaker', () => {
    expect(sortWithTieBreaker('createdAt', 'asc')).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
  });
});
