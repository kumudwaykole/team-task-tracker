// First-time local setup, run by `pnpm bootstrap` after `pnpm install`:
// env files, Prisma client, Postgres in Docker, migrations, demo data. Safe to run again.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const PLACEHOLDER = 'replace-with-at-least-32-random-characters';

function run(command) {
  console.log(`\n> ${command}`);
  const { status } = spawnSync(command, { stdio: 'inherit', shell: true });
  if (status !== 0) {
    console.error(`\nFailed: ${command}`);
    process.exit(status ?? 1);
  }
}

/** Copies the example file if the real one is missing, with a freshly generated JWT secret. */
function ensureEnv(target, example) {
  if (existsSync(target)) {
    console.log(`${target} exists, leaving it as is`);
    return;
  }
  copyFileSync(example, target);
  const secret = randomBytes(48).toString('hex');
  writeFileSync(target, readFileSync(target, 'utf8').replaceAll(PLACEHOLDER, secret));
  console.log(`Created ${target} from ${example} (with a new JWT_SECRET)`);
}

ensureEnv('.env', '.env.example');
ensureEnv('apps/server/.env', 'apps/server/.env.example');

run('pnpm --filter server db:generate');
run('docker compose up -d --wait db');
run('pnpm --filter server db:deploy');
run('pnpm --filter server db:seed');

console.log('\nReady. Start the app with: pnpm dev   (then open http://localhost:3000)');
