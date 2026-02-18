// src/errors/format-error.ts
import { GraphQLFormattedError, GraphQLError } from 'graphql';
import { AppError } from './index.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export function formatError(
  formattedError: GraphQLFormattedError,
  error: unknown
): GraphQLFormattedError {
  // Unwrap the original error from GraphQL's wrapper
  const originalError = error instanceof GraphQLError ? error : null;

  // Log all errors for monitoring
  logError(formattedError, originalError);

  // In development, return the full error with stack trace
  if (!IS_PRODUCTION) {
    return formattedError;
  }

  // In production, check if this is an expected application error
  if (originalError instanceof AppError) {
    // Expected errors: return the message and code, strip the stack trace
    return {
      message: formattedError.message,
      locations: formattedError.locations,
      path: formattedError.path,
      extensions: {
        code: formattedError.extensions?.code,
        // Include field errors for validation errors
        ...(formattedError.extensions?.fieldErrors
          ? { fieldErrors: formattedError.extensions.fieldErrors }
          : {}),
        // Include resource info for not-found errors
        ...(formattedError.extensions?.resource
          ? {
              resource: formattedError.extensions.resource,
              resourceId: formattedError.extensions.resourceId,
            }
          : {}),
      },
    };
  }

  // Unexpected errors: mask the message to avoid leaking internals
  return {
    message: 'An unexpected error occurred. Please try again later.',
    locations: formattedError.locations,
    path: formattedError.path,
    extensions: {
      code: 'INTERNAL_SERVER_ERROR',
    },
  };
}

function logError(
  formattedError: GraphQLFormattedError,
  originalError: GraphQLError | null
): void {
  const isExpected = originalError instanceof AppError;

  if (isExpected) {
    console.info('[GraphQL] Expected error:', {
      message: formattedError.message,
      code: formattedError.extensions?.code,
      path: formattedError.path,
    });
  } else {
    console.error('[GraphQL] Unexpected error:', {
      message: formattedError.message,
      path: formattedError.path,
      extensions: formattedError.extensions,
    });
  }
}
