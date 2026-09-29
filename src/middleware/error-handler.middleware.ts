import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';
import type { ErrorResponseBody } from '../types/error.types';
import { isAppError, ValidationError } from '../utils/app-error';

/**
 * body-parser and the router reject malformed input themselves, throwing a
 * native `SyntaxError` (unparseable JSON body) or `URIError` (undecodable URL
 * parameter) tagged `status: 400`. That is the client's mistake, so it becomes
 * a 400 instead of a logged 500 whose stack trace would echo the raw body.
 */
function toMalformedRequestError(error: unknown): ValidationError | undefined {
  const isParserError = error instanceof SyntaxError || error instanceof URIError;
  if (!isParserError || !('status' in error) || error.status !== 400) {
    return undefined;
  }
  return new ValidationError(
    error instanceof SyntaxError
      ? 'Request body must be a valid JSON object.'
      : 'Request URL contains an invalid percent-encoded parameter.',
  );
}

/**
 * The one and only error-formatting middleware, registered last in `app.ts`
 * (AGENTS.md §4). `thrown` arrives as `unknown` and is narrowed before use;
 * unexpected errors become a generic 500 so internals are never leaked.
 */
export function errorHandler(
  thrown: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const error = toMalformedRequestError(thrown) ?? thrown;
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
