// src/errors/validation-error.ts
import { GraphQLError } from 'graphql';

export interface FieldError {
  field: string;
  message: string;
}

export class UserInputError extends GraphQLError {
  constructor(message: string, fieldErrors: FieldError[] = []) {
    super(message, {
      extensions: {
        code: 'BAD_USER_INPUT',
        fieldErrors,
      },
    });
  }
}
