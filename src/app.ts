import express, { type Application } from 'express';

import { env } from './config/env';
import { errorHandler } from './middleware/error-handler.middleware';
import { notFoundHandler } from './middleware/not-found.middleware';
import { apiRouter } from './routes';

/**
 * Builds the Express application: body parsing, router mounting, then the
 * 404 and error middleware last. Assembly only — no route logic and no
 * `listen()` call, which belongs to `server.ts` so the app stays importable
 * by tests (AGENTS.md §3).
 */
export function createApp(): Application {
  const app: Application = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(`/api/${env.apiVersion}`, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
