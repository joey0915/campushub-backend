import type { NextFunction, Request, Response } from 'express';

import { NotFoundError } from '../utils/app-error';

/**
 * Terminal 404 handler: converts an unmatched route into a typed error and
 * hands it to the single error middleware, so all error formatting stays in
 * one place (AGENTS.md §4).
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found.`));
}
