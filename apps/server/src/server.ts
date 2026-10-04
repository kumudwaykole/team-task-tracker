import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { checkDatabaseConnection, prisma } from './config/prisma.js';
import { startJobs, stopJobs } from './jobs/index.js';
import { closeSocket, initSocket } from './sockets/index.js';
import { mountWeb } from './web.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main() {
  // Fail fast if the database is unreachable.
  await checkDatabaseConnection();

  // One HTTP server and one port for the API, Socket.IO and the React app.
  const app = createApp();
  const httpServer = createServer(app);
  initSocket(httpServer);
  const closeWeb = await mountWeb(app, httpServer);

  httpServer.on('error', (err) => {
    console.error('HTTP server error', err);
    process.exit(1);
  });

  httpServer.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    startJobs();
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

    // Socket.IO's close also closes the HTTP server it is attached to.
    Promise.all([stopJobs(), closeWeb(), closeSocket()])
      .then(() => prisma.$disconnect())
      .catch((err: unknown) => console.error('Error during shutdown', err))
      .finally(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(async (err: unknown) => {
  console.error('Failed to start server', err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
