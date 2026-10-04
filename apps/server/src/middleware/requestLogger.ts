import type { RequestHandler } from 'express';

/** Logs method, path, status and duration. Never logs query strings, headers or bodies. */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(
      `${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(1)}ms`,
    );
  });
  next();
};
