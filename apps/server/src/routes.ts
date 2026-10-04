import express, { Router } from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { projectsRouter } from './modules/projects/projects.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { workItemsRouter } from './modules/workItems/workItems.routes.js';

/**
 * The whole API, mounted under /api. It has its own 404 and error handler, so unknown API
 * paths get JSON errors and never fall through to the web app.
 */
export const apiRouter = Router();

apiRouter.use(express.json({ limit: '100kb' }));

// Let the browser keep GET responses but revalidate them every time: Express's ETag then
// turns unchanged responses into cheap 304s.
apiRouter.use((req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'private, no-cache');
  next();
});

// Health check sits outside the rate limiter so monitoring never gets a 429.
apiRouter.use('/health', healthRouter);
apiRouter.use(globalLimiter);

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/work-items', workItemsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/dashboard', dashboardRouter);

apiRouter.use(notFound);
apiRouter.use(errorHandler);
