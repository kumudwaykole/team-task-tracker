import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env, isTest } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiRouter } from './routes.js';

/** Builds the Express app (API only) without listening, so tests can import it. */
export function createApp() {
  const app = express();

  app.use(
    helmet({
      // In development Vite injects inline scripts, so the CSP is off. In production it stays on,
      // allowing same-origin WebSocket connections for Socket.IO.
      contentSecurityPolicy:
        env.NODE_ENV === 'production'
          ? { directives: { connectSrc: ["'self'", 'ws:', 'wss:'] } }
          : false,
    }),
  );
  app.use(cors({ origin: env.CLIENT_URL }));
  app.use(compression({ threshold: 1024 }));

  if (!isTest) app.use('/api', requestLogger);
  app.use('/api', apiRouter);

  return app;
}
