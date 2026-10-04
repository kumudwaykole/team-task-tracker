import { Router } from 'express';
import { checkDatabaseConnection } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await checkDatabaseConnection();
  } catch (err) {
    console.error('[health] database check failed', err);
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Database is unreachable');
  }
  sendSuccess(res, { status: 'ok', database: 'up' });
});
