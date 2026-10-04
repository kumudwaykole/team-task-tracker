import type { ErrorRequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError, badRequest, conflict, notFound, unauthorized } from '../utils/AppError.js';
import { isCheckViolation } from '../utils/prismaErrors.js';
import { formatZodIssues } from './validate.js';

/** Shape of errors thrown by body-parser (`express.json`). */
interface HttpError {
  status: number;
  type?: string;
  expose?: boolean;
}

const isHttpError = (err: unknown): err is HttpError =>
  typeof err === 'object' && err !== null && typeof (err as HttpError).status === 'number';

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new AppError(
      400,
      'VALIDATION_ERROR',
      'Invalid request data',
      formatZodIssues(err.issues),
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (isCheckViolation(err)) {
      return new AppError(409, 'CONSTRAINT_VIOLATION', 'The operation violates a data constraint');
    }
    switch (err.code) {
      case 'P2002':
        return conflict('A record with this value already exists');
      case 'P2025':
        return notFound();
      case 'P2003':
        return new AppError(
          409,
          'RELATION_CONSTRAINT',
          'The operation conflicts with related records',
        );
      case 'P2007': // e.g. a malformed UUID reached the database
        return badRequest('Invalid input value', undefined, 'INVALID_INPUT');
    }
  }

  // TokenExpiredError extends JsonWebTokenError, so check it first.
  if (err instanceof jwt.TokenExpiredError)
    return unauthorized('Token has expired', 'TOKEN_EXPIRED');
  if (err instanceof jwt.JsonWebTokenError) return unauthorized('Invalid token', 'INVALID_TOKEN');

  if (isHttpError(err)) {
    if (err.type === 'entity.parse.failed') {
      return new AppError(400, 'BAD_JSON', 'Request body is not valid JSON');
    }
    if (err.type === 'entity.too.large') {
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    }
    if (err.expose && err.status >= 400 && err.status < 500) {
      return new AppError(err.status, 'BAD_REQUEST', 'Malformed request');
    }
  }

  return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');
}

/** Last middleware: maps every error to `{ success: false, error: { code, message, details? } }`. */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const appError = toAppError(err);

  // Full details stay in the server log; clients only ever see the generic message.
  if (appError.statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.path}`, err);
  }

  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined && { details: appError.details }),
    },
  });
};
