import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';
import { env } from './env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: 10 });

// One client (and one connection pool) for the whole process.
export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/** The client or a transaction client. Repositories that write take it as an optional last argument. */
export type Db = Prisma.TransactionClient;

/** Runs `fn` in one database transaction; everything it does commits or rolls back together. */
export const runInTransaction = <T>(fn: (tx: Db) => Promise<T>) => prisma.$transaction(fn);

/** Throws if the database cannot be reached. Used at startup and by the health check. */
export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
