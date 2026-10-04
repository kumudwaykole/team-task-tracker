import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { checkDatabaseConnection, prisma } from './config/prisma.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main() {
  // Fail fast if the database is unreachable.
  await checkDatabaseConnection();

  // A plain HTTP server, so Socket.IO can attach to it in Phase 5.
  const server = createServer(createApp());

  server.on('error', (err) => {
    console.error('HTTP server error', err);
    process.exit(1);
  });

  server.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);

    setTimeout(() => {
      console.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close(() => {
      prisma
        .$disconnect()
        .catch((err: unknown) => console.error('Error disconnecting Prisma', err))
        .finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(async (err: unknown) => {
  console.error('Failed to start server', err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
