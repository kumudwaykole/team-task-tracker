import { prisma } from '../../src/config/prisma.js';
import { assertTestDatabase } from './testDatabase.js';

/** One statement clears fixtures without Prisma's short transaction deadline. */
export async function resetDatabase() {
  assertTestDatabase(process.env['DATABASE_URL']);
  await prisma.$executeRaw`
    TRUNCATE TABLE "Notification", "Comment", "WorkItem", "ProjectMember", "Project", "User"
    RESTART IDENTITY CASCADE
  `;
}

export const notificationsFor = (userId: string) =>
  prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
