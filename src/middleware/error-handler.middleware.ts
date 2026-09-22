import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';
import type { ErrorResponseBody } from '../types/error.types';
import { isAppError } from '../utils/app-error';

/**
 * The one and only error-formatting middleware, registered last in `app.ts`
 * (AGENTS.md §4). `error` arrives as `unknown` and is narrowed before use;
 * unexpected errors become a generic 500 so internals are never leaked.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isKnown = isAppError(error);
  const statusCode = isKnown ? error.statusCode : 500;
  const code = isKnown ? error.code : 'INTERNAL_SERVER_ERROR';
  const message = isKnown ? error.message : 'An unexpected error occurred.';

  if (!isKnown || !error.isOperational) {
    // Log the real cause server-side only; never in the response body.
    console.error('[error]', error instanceof Error ? error.stack : String(error));
  }

  const body: ErrorResponseBody = {
    status: 'error',
    message,
    code,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  };

  if (env.nodeEnv === 'development' && !isKnown) {
    console.error('[error] returning generic 500 to client for the error above.');
  }

  res.status(statusCode).json(body);
}
