import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env, isTest } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiRouter } from './routes.js';

interface AppOptions {
  /** Defaults to on, except under NODE_ENV=test. The rate-limit test turns it on explicitly. */
  rateLimit?: boolean;
}

/** Builds the Express app (API only) without listening, so tests can import it. */
export function createApp({ rateLimit = !isTest }: AppOptions = {}) {
  const app = express();
  // Read by the limiters in middleware/rateLimit.ts.
  app.locals['rateLimit'] = rateLimit;
  // Behind a reverse proxy, use the client's IP (X-Forwarded-For) for rate limiting and logs.
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      // In development Vite injects inline scripts, so the CSP is off. In production it stays on,
      // allowing same-origin WebSocket connections for Socket.IO. HTTPS is the proxy's job, so
      // the CSP does not force it (that would break plain-HTTP access such as a LAN IP).
      contentSecurityPolicy:
        env.NODE_ENV === 'production'
          ? { directives: { connectSrc: ["'self'", 'ws:', 'wss:'], upgradeInsecureRequests: null } }
          : false,
    }),
  );
  app.use(cors({ origin: env.CLIENT_URL }));
  app.use(compression({ threshold: 1024 }));

  if (!isTest) app.use('/api', requestLogger);
  app.use('/api', apiRouter);

  return app;
}
