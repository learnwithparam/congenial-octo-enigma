// src/errors/index.ts
import { GraphQLError } from 'graphql';

// Base class for all application errors
// These are "expected" errors that we deliberately throw
export class AppError extends GraphQLError {
  constructor(
    message: string,
    code: string,
    extensions?: Record<string, unknown>
  ) {
    super(message, {
      extensions: {
        code,
        ...extensions,
      },
    });
  }
}

// Resource not found (e.g., startup with given ID doesn't exist)
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(
      resource + ' not found: ' + id,
      'NOT_FOUND',
      { resource, resourceId: id }
    );
  }
}

// User is not authenticated (no valid session/token)
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'You must be logged in to perform this action'
  ) {
    super(message, 'UNAUTHENTICATED');
  }
}

// User is authenticated but not authorized for this action
export class ForbiddenError extends AppError {
  constructor(
    message: string = 'You do not have permission to perform this action'
  ) {
    super(message, 'FORBIDDEN');
  }
}

// Re-export from the validation module
export { UserInputError } from './validation-error.js';
