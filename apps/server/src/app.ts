import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env, isTest } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/requestLogger.js';
import { healthRouter } from './modules/health/health.routes.js';
import { apiRouter } from './routes.js';

/** Builds the Express app without listening, so tests can import it. */
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL }));
  if (!isTest) app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

  // Health check sits outside the rate limiter so monitoring never gets a 429.
  app.use('/api/health', healthRouter);
  app.use('/api', globalLimiter, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
