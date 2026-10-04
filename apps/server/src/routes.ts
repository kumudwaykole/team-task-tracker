import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { projectsRouter } from './modules/projects/projects.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { workItemsRouter } from './modules/workItems/workItems.routes.js';

/** Every feature router, mounted under /api. */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/work-items', workItemsRouter);
