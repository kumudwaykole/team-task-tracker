import type { RequestHandler } from 'express';
import { notFound as notFoundError } from '../utils/AppError.js';

/** Catches unknown API routes. Mounted after all routers, before the error handler. */
export const notFound: RequestHandler = (req) => {
  throw notFoundError(`Route ${req.method} ${req.baseUrl}${req.path} not found`);
};
