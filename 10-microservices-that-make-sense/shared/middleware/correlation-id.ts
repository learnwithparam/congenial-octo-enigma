// Correlation ID middleware — propagates or generates a unique request ID

import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const id =
    (req.headers["x-correlation-id"] as string) || crypto.randomUUID();

  req.correlationId = id;
  res.setHeader("x-correlation-id", id);
  next();
}
