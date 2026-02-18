// Centralized error handling middleware

import type { Request, Response, NextFunction } from "express";
import type { Logger } from "pino";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(logger: Logger) {
  return (
    err: AppError,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    const statusCode = err.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal Server Error" : err.message;

    logger.error(
      {
        err: {
          message: err.message,
          stack: err.stack,
          code: err.code,
        },
        method: req.method,
        url: req.originalUrl,
        correlationId: req.correlationId,
      },
      "Unhandled error"
    );

    res.status(statusCode).json({
      error: message,
      correlationId: req.correlationId,
    });
  };
}
