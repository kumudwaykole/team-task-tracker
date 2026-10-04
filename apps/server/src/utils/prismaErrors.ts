import { Prisma } from '../generated/prisma/client.js';

type KnownError = Prisma.PrismaClientKnownRequestError;

const PG_CHECK_VIOLATION = '23514';

export const isPrismaError = (err: unknown, code: string): err is KnownError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

/** Unique constraint violation. */
export const isUniqueViolation = (err: unknown) => isPrismaError(err, 'P2002');

/** The Postgres SQLSTATE behind a Prisma error, when it came through the driver adapter. */
export function getPostgresCode(err: KnownError): string | undefined {
  const adapterError = err.meta?.['driverAdapterError'] as
    { cause?: { originalCode?: unknown } } | undefined;
  const code = adapterError?.cause?.originalCode;
  return typeof code === 'string' ? code : undefined;
}

/**
 * A CHECK constraint failed (e.g. `task_requires_project`, `status_matches_type`).
 * With the pg adapter these arrive as the generic P2039, so match on the SQLSTATE too.
 */
export const isCheckViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  (err.code === 'P2004' || getPostgresCode(err) === PG_CHECK_VIOLATION);
