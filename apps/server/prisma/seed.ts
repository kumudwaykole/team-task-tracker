/**
 * Development seed. Idempotent: users are upserted by email, projects by (manager, name),
 * and memberships skip duplicates, so running it twice changes nothing.
 */
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { Role } from '../src/generated/prisma/enums.js';
import { hashPassword } from '../src/utils/password.js';

const DEV_PASSWORD = 'Password@123';

const users: { name: string; email: string; role: Role }[] = [
  { name: 'Admin User', email: 'admin@tracker.dev', role: Role.ADMIN },
  { name: 'Manager One', email: 'manager1@tracker.dev', role: Role.MANAGER },
  { name: 'Manager Two', email: 'manager2@tracker.dev', role: Role.MANAGER },
  ...[1, 2, 3, 4, 5].map((n) => ({
    name: `Member ${n}`,
    email: `member${n}@tracker.dev`,
    role: Role.MEMBER,
  })),
];

// member3 belongs to both projects, which is handy for testing cross-project visibility.
const projects = [
  {
    name: 'Website Revamp',
    manager: 'manager1@tracker.dev',
    members: ['member1@tracker.dev', 'member2@tracker.dev', 'member3@tracker.dev'],
  },
  {
    name: 'Mobile App',
    manager: 'manager2@tracker.dev',
    members: ['member3@tracker.dev', 'member4@tracker.dev', 'member5@tracker.dev'],
  },
];

async function main() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production');
  }

  const passwordHash = await hashPassword(DEV_PASSWORD);
  const idByEmail = new Map<string, string>();

  for (const user of users) {
    const { id } = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, passwordHash },
      select: { id: true },
    });
    idByEmail.set(user.email, id);
  }

  const idOf = (email: string) => {
    const id = idByEmail.get(email);
    if (!id) throw new Error(`Seed data references unknown user ${email}`);
    return id;
  };

  for (const project of projects) {
    const managerId = idOf(project.manager);
    const { id: projectId } = await prisma.project.upsert({
      where: { managerId_name: { managerId, name: project.name } },
      update: {},
      create: { name: project.name, managerId },
      select: { id: true },
    });

    await prisma.projectMember.createMany({
      data: project.members.map((email) => ({ projectId, userId: idOf(email) })),
      skipDuplicates: true,
    });
  }

  const [userCount, projectCount, memberCount] = await prisma.$transaction([
    prisma.user.count(),
    prisma.project.count(),
    prisma.projectMember.count(),
  ]);
  console.log(
    `Seed complete: ${userCount} users, ${projectCount} projects, ${memberCount} memberships. ` +
      `Dev password for all seeded users: ${DEV_PASSWORD}`,
  );
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
