// Pino-based request logging middleware

import type { Request, Response, NextFunction } from "express";
import type { Logger } from "pino";

export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        correlationId: req.correlationId,
      };

      if (res.statusCode >= 500) {
        logger.error(logData, "Request failed");
      } else if (res.statusCode >= 400) {
        logger.warn(logData, "Request client error");
      } else {
        logger.info(logData, "Request completed");
      }
    });

    next();
  };
}
