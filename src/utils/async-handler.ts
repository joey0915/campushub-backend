import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Wraps an async controller so a rejected promise reaches the central error
 * middleware instead of becoming an unhandled rejection (AGENTS.md §4).
 * Every async route handler must be registered through this.
 */
export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
