import type { AuthUser } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware. */
      user?: AuthUser;
      /** Parsed and normalized input, set by the `validate` middleware (Express 5 `req.query` is read-only). */
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
