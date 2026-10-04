import { rateLimit, type Options } from 'express-rate-limit';
import { isTest } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Route the rejection through the error handler so 429s use the standard error shape.
const handler: Options['handler'] = (_req, _res, next) => {
  next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later'));
};

const baseOptions = {
  windowMs: FIFTEEN_MINUTES,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  handler,
} satisfies Partial<Options>;

/** Relaxed limit for the whole API. */
export const globalLimiter = rateLimit({ ...baseOptions, limit: 1000 });

/** Strict limit for login and register: 10 requests per 15 minutes per IP. */
export const authLimiter = rateLimit({ ...baseOptions, limit: 10 });
