import { execSync } from 'node:child_process';
import pg from 'pg';
import { assertTestDatabase } from './helpers/testDatabase.js';

/** Runs once before the integration tests: guard, create the database if needed, migrate. */
export default async function globalSetup() {
  const url = process.env['DATABASE_URL'];
  // The tests empty every table, so never let them near a real database.
  assertTestDatabase(url);
  if (!url) throw new Error('DATABASE_URL is required');

  await createDatabaseIfMissing(url);

  try {
    // Applies every migration, including the CHECK constraints written in SQL.
    execSync('prisma migrate deploy', { stdio: 'pipe', env: process.env });
  } catch (err) {
    const { stdout, stderr } = err as { stdout?: Buffer; stderr?: Buffer };
    console.error(stdout?.toString(), stderr?.toString());
    throw new Error('prisma migrate deploy failed for the test database', { cause: err });
  }
}

async function createDatabaseIfMissing(url: string) {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  if (!/^\w+$/.test(name)) throw new Error(`Unexpected test database name "${name}"`);

  // Connect to the server's default database to create the test one.
  const admin = new URL(url);
  admin.pathname = '/postgres';
  admin.search = '';
  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Cannot reach Postgres at ${target.host}. Start it with "pnpm db:up". (${(err as Error).message})`,
      { cause: err },
    );
  }
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
}
