/** The only error type thrown on purpose. The error handler turns it into the standard error response. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message = 'Bad request', details?: unknown, code = 'BAD_REQUEST') =>
  new AppError(400, code, message, details);

export const unauthorized = (message = 'Authentication required', code = 'UNAUTHENTICATED') =>
  new AppError(401, code, message);

export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);

export const conflict = (message = 'Conflict', code = 'CONFLICT') =>
  new AppError(409, code, message);
