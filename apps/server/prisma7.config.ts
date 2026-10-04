// Prisma 7.10 looks for `prisma7.config.ts` by default, so keep this file name.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl = process.env['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Optional so `prisma generate` also works without a database (e.g. in a Docker build).
  ...(databaseUrl && { datasource: { url: databaseUrl } }),
});
