import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

// One client (and one connection pool) for the whole process.
export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/** Throws if the database cannot be reached. Used at startup and by the health check. */
export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
