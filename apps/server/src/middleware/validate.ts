import type { Request, RequestHandler } from 'express';
import type { ZodType, z } from 'zod';
import { badRequest } from '../utils/AppError.js';

type Location = 'body' | 'query' | 'params';
type Schemas = Partial<Record<Location, ZodType>>;

interface ValidationIssue {
  location?: Location;
  path: string;
  message: string;
}

export const formatZodIssues = (
  issues: z.core.$ZodIssue[],
  location?: Location,
): ValidationIssue[] =>
  issues.map((issue) => ({
    ...(location && { location }),
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));

/**
 * Validates and normalizes `params`, `query` and `body`, and stores the parsed values on `req.validated`.
 * All parts are checked, so the client gets every field error in one response.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    const validated: NonNullable<Request['validated']> = {};
    const issues: ValidationIssue[] = [];

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = schemas[location];
      if (!schema) continue;

      // A missing JSON body arrives as undefined; validate it as {} so field errors are reported.
      const input = location === 'body' ? (req.body ?? {}) : req[location];
      const result = schema.safeParse(input);
      if (result.success) validated[location] = result.data;
      else issues.push(...formatZodIssues(result.error.issues, location));
    }

    if (issues.length > 0) throw badRequest('Invalid request data', issues, 'VALIDATION_ERROR');

    req.validated = validated;
    next();
  };

/**
 * Typed access to data parsed by `validate`.
 * @example const input = getValidated<LoginInput>(req, 'body');
 */
export function getValidated<T>(req: Request, location: Location): T {
  const value = req.validated?.[location];
  if (value === undefined) {
    throw new Error(`validate() did not run for req.${location} on ${req.method} ${req.path}`);
  }
  return value as T;
}
