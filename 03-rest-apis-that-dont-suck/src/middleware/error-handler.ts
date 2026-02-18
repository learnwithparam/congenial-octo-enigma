import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../errors.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log the error for debugging
  console.error(`[Error] ${err.message}`, {
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });

  // Handle our custom validation errors
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.errors,
    });
    return;
  }

  // Handle other custom app errors (NotFoundError, etc.)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Handle unexpected errors -- never expose internals
  res.status(500).json({
    error: 'Internal server error',
  });
}
