import type { Response } from 'express';

interface SuccessOptions {
  status?: number;
  meta?: object;
}

/** Sends the standard success shape: `{ success: true, data, meta? }`. */
export function sendSuccess<T>(
  res: Response,
  data: T,
  { status = 200, meta }: SuccessOptions = {},
) {
  res.status(status).json(meta ? { success: true, data, meta } : { success: true, data });
}

export function sendNoContent(res: Response) {
  res.status(204).end();
}
