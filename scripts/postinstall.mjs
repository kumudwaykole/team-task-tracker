// Runs after `pnpm install` at the repo root, so `pnpm dev` works straight after a fresh clone:
// creates missing .env files (with a new JWT secret) and generates the Prisma client.
// The database is started, migrated and seeded by `pnpm dev`, not here.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

// CI sets up its own environment, and the Docker build installs before the source is copied.
if (process.env.CI || !existsSync('apps/server/prisma/schema.prisma')) process.exit(0);

const PLACEHOLDER = 'replace-with-at-least-32-random-characters';

/** Copies the example file if the real one is missing, with a freshly generated JWT secret. */
function ensureEnv(target, example) {
  if (existsSync(target) || !existsSync(example)) return;
  copyFileSync(example, target);
  const secret = randomBytes(48).toString('hex');
  writeFileSync(target, readFileSync(target, 'utf8').replaceAll(PLACEHOLDER, secret));
  console.log(`Created ${target} from ${example} (with a new JWT_SECRET)`);
}

ensureEnv('.env', '.env.example');
ensureEnv('apps/server/.env', 'apps/server/.env.example');

const { status } = spawnSync('pnpm --filter server db:generate', { stdio: 'inherit', shell: true });
process.exit(status ?? 1);
