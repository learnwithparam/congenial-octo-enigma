import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors.js';
import type { FieldError } from '../errors.js';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fieldErrors = formatZodErrors(result.error);
      throw new ValidationError(fieldErrors);
    }

    // Replace req.body with the parsed (and trimmed/coerced) data
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const fieldErrors = formatZodErrors(result.error);
      throw new ValidationError(fieldErrors);
    }

    // Attach parsed query params for easy access in handlers
    (req as any).validatedQuery = result.data;
    next();
  };
}

function formatZodErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
