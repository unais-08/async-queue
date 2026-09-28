/**
 * A custom error class for application-specific errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Preserve correct stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}