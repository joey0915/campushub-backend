/**
 * Typed domain error. Services throw these instead of touching `res`, and the
 * central error middleware maps `statusCode` onto the HTTP response — so no
 * string matching on error messages anywhere (AGENTS.md §4).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  public constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, new.target);
  }
}

export class NotFoundError extends AppError {
  public constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ServiceUnavailableError extends AppError {
  public constructor(message: string) {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
