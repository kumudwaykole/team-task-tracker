import { rateLimit, type Options } from 'express-rate-limit';
import { getAuthUser } from './authenticate.js';
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
  // Off for apps built with `createApp({ rateLimit: false })` (the default under NODE_ENV=test).
  skip: (req) => req.app.locals['rateLimit'] !== true,
  handler,
} satisfies Partial<Options>;

/** Relaxed limit for the whole API. */
export const globalLimiter = rateLimit({ ...baseOptions, limit: 1000 });

/**
 * Brute-force guard for login: 10 failed attempts per 15 minutes per IP. Successful logins do
 * not count, so people who share an IP (an office, a demo run) are not locked out.
 */
export const loginLimiter = rateLimit({ ...baseOptions, limit: 10, skipSuccessfulRequests: true });

/** Sign-up spam guard: 10 registrations per 15 minutes per IP, successful or not. */
export const registerLimiter = rateLimit({ ...baseOptions, limit: 10 });

/** 30 comments per minute per user (runs after `authenticate`). */
export const commentLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => getAuthUser(req).id,
});
