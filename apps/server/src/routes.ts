import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';

/** Every feature router, mounted under /api. */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
// Phase 3+: projects, work-items, notifications
