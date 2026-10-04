import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import express, { type Express } from 'express';
import { env } from './config/env.js';

// apps/server, whether running from src/ (tsx) or dist/ (node).
const SERVER_ROOT = path.resolve(import.meta.dirname, '..');

/**
 * Serves the React app on the same port as the API and sockets. Mounted after the API.
 * - development: Vite in middleware mode, with HMR on the same HTTP server
 * - production: the built files from WEB_DIST_DIR, with an index.html fallback for client routes
 * Returns a cleanup function for graceful shutdown.
 */
export async function mountWeb(app: Express, httpServer: Server): Promise<() => Promise<void>> {
  if (env.NODE_ENV === 'production') {
    const dist = path.resolve(SERVER_ROOT, env.WEB_DIST_DIR);
    const indexHtml = path.join(dist, 'index.html');
    if (!existsSync(indexHtml)) {
      console.warn(`[web] ${indexHtml} not found. Run "pnpm --filter web build" first.`);
    }

    // Hashed file names never change, so cache them for a year. A missing asset is a real 404.
    app.use(
      '/assets',
      express.static(path.join(dist, 'assets'), {
        immutable: true,
        maxAge: '1y',
        fallthrough: false,
      }),
    );
    app.use(express.static(dist, { index: false }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
    return async () => {};
  }

  // Imported only in development; vite is a dev dependency.
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: path.resolve(SERVER_ROOT, env.WEB_DIR),
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server: httpServer } },
  });
  app.use(vite.middlewares);
  return () => vite.close();
}
