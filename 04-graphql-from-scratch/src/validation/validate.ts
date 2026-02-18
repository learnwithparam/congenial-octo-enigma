// src/validation/validate.ts
import { ZodSchema, ZodError } from 'zod';
import { UserInputError } from '../errors/validation-error.js';
import type { FieldError } from '../errors/validation-error.js';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    // parse() throws ZodError on failure, returns typed data on success
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: FieldError[] = error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw new UserInputError('Validation failed', fieldErrors);
    }

    // Re-throw unexpected errors
    throw error;
  }
}
