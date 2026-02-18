# Lesson 08: Error Handling in GraphQL

Error handling in GraphQL is fundamentally different from REST. In REST, you return HTTP status codes: 404 for not found, 401 for unauthorized, 500 for server errors. In GraphQL, every response returns HTTP 200 (with rare exceptions). Errors are communicated through a dedicated `errors` array alongside any partial `data` that was successfully resolved.

This design enables something REST cannot do: partial responses. A single GraphQL query might ask for five different things. If three succeed and two fail, you get the three successful results plus error details for the two failures. The client can display what it has and handle the errors gracefully.

By the end of this lesson you will:

- Understand the GraphQL error response format
- Create typed error classes for common scenarios
- Build a `formatError` function that masks internal details in production
- Handle expected errors differently from unexpected errors
- Add structured error codes for client-side handling
- Implement error logging strategies

---

## How GraphQL Errors Work

Every GraphQL response has this shape:

```json
{
  "data": { ... },
  "errors": [ ... ]
}
```

Both fields are optional. A fully successful response has `data` and no `errors`. A fully failed response (like a syntax error in the query) has `errors` and no `data`. A partially successful response has both.

Each error in the array has this structure:

```json
{
  "message": "Human-readable error message",
  "locations": [{ "line": 3, "column": 5 }],
  "path": ["startups", 0, "founder"],
  "extensions": {
    "code": "NOT_FOUND",
    "stacktrace": ["..."]
  }
}
```

- `message` is required and should be useful to a developer reading it
- `locations` points to the position in the GraphQL query that caused the error
- `path` traces through the response data to the exact field that failed
- `extensions` is a free-form object for any additional metadata

The `path` field is particularly useful. If you query 10 startups and the 3rd one's founder resolver fails, the path will be `["startups", 2, "founder"]`. The client knows exactly which item in the list had a problem.

---

## Partial Data Example

Consider this query and response:

```graphql
query {
  startup(id: "startup-1") {
    title
    founder {
      name
    }
  }
  me {
    name
    email
  }
}
```

If the startup loads fine but the `me` query fails because the user is not authenticated:

```json
{
  "data": {
    "startup": {
      "title": "TechFlow",
      "founder": {
        "name": "Alice"
      }
    },
    "me": null
  },
  "errors": [
    {
      "message": "You must be logged in",
      "path": ["me"],
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

The client gets the startup data it asked for and can display it. It also knows the `me` query failed and why. A REST API would have to choose between returning the startup data (ignoring the auth failure) or returning an error (losing the startup data). GraphQL gives you both.

---

## Creating Error Classes

Let us build a set of error classes that cover the common cases. Create `src/errors/index.ts`:

```typescript
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

// Re-export from the validation lesson
export { UserInputError } from './validation-error.js';
```

Each error class sets a specific code in extensions. Here is what the codes mean:

- `NOT_FOUND` - The requested resource does not exist. The client should show a "not found" page or remove the item from its cache.
- `UNAUTHENTICATED` - The user needs to log in. The client should redirect to the login page.
- `FORBIDDEN` - The user is logged in but cannot access this resource. The client should show an "access denied" message.
- `BAD_USER_INPUT` - The input data is invalid (from Lesson 06). The client should highlight form errors.
- `INTERNAL_SERVER_ERROR` - Something unexpected broke. The client should show a generic error message and retry.

These codes give clients a reliable way to handle errors programmatically without parsing error messages, which would be fragile and break if you change the wording.

---

## Using Error Classes in Resolvers

Now update your resolvers to use the error classes:

```typescript
// src/resolvers/queries.ts
import { startups, users } from '../data/store.js';
import { NotFoundError } from '../errors/index.js';

export const queryResolvers = {
  Query: {
    startup: (_parent: unknown, args: { id: string }) => {
      const startup = startups.find((s) => s.id === args.id);
      if (!startup) {
        throw new NotFoundError('Startup', args.id);
      }
      return startup;
    },

    user: (_parent: unknown, args: { id: string }) => {
      const user = users.find((u) => u.id === args.id);
      if (!user) {
        throw new NotFoundError('User', args.id);
      }
      return user;
    },

    startups: (
      _parent: unknown,
      args: { limit?: number; offset?: number }
    ) => {
      const limit = args.limit || 10;
      const offset = args.offset || 0;
      return startups.slice(offset, offset + limit);
    },
  },
};
```

```typescript
// src/resolvers/mutations.ts (updated with error classes)
import { startups } from '../data/store.js';
import {
  NotFoundError,
  ForbiddenError,
  AuthenticationError,
} from '../errors/index.js';
import { validate } from '../validation/validate.js';
import { UpdateStartupInputSchema } from '../validation/schemas.js';
import { GraphQLContext } from '../index.js';

export const mutationResolvers = {
  Mutation: {
    updateStartup: (
      _parent: unknown,
      args: { id: string; input: unknown },
      context: GraphQLContext
    ) => {
      // Check authentication (when you have auth in context)
      // if (!context.user) {
      //   throw new AuthenticationError();
      // }

      const input = validate(UpdateStartupInputSchema, args.input);

      const index = startups.findIndex((s) => s.id === args.id);
      if (index === -1) {
        throw new NotFoundError('Startup', args.id);
      }

      const startup = startups[index];

      // Check authorization
      // if (startup.founderId !== context.user.id) {
      //   throw new ForbiddenError(
      //     'Only the founder can update this startup'
      //   );
      // }

      const updated = { ...startup };
      if (input.title !== undefined) updated.title = input.title;
      if (input.description !== undefined)
        updated.description = input.description;
      if (input.category !== undefined) updated.category = input.category;

      startups[index] = updated;
      return updated;
    },

    deleteStartup: (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      const index = startups.findIndex((s) => s.id === args.id);
      if (index === -1) {
        throw new NotFoundError('Startup', args.id);
      }

      // const startup = startups[index];
      // if (startup.founderId !== context.user.id) {
      //   throw new ForbiddenError(
      //     'Only the founder can delete this startup'
      //   );
      // }

      startups.splice(index, 1);
      return true;
    },
  },
};
```

The auth checks are commented out because we do not have authentication set up in this workshop. In a real application, the context would include the authenticated user, and you would uncomment those checks.

The pattern is simple and consistent: check conditions, throw a specific error if they fail, proceed with business logic if they pass. Each error type communicates exactly what went wrong and what the client should do about it.

---

## Building a formatError Function

Apollo Server lets you provide a `formatError` function that runs on every error before it is sent to the client. This is your last chance to modify, filter, or log errors.

Create `src/errors/format-error.ts`:

```typescript
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
    // Expected errors are informational — log at info level
    console.info('[GraphQL] Expected error:', {
      message: formattedError.message,
      code: formattedError.extensions?.code,
      path: formattedError.path,
    });
  } else {
    // Unexpected errors need attention — log at error level
    console.error('[GraphQL] Unexpected error:', {
      message: formattedError.message,
      path: formattedError.path,
      extensions: formattedError.extensions,
    });
  }
}
```

This function makes a crucial distinction.

Expected errors (instances of `AppError`) are things like "not found" or "validation failed." These are normal parts of application flow. The client needs the message and code. We strip the stack trace in production because it is useless to the client and could reveal internal file paths.

Unexpected errors are everything else: null pointer exceptions, database connection failures, out-of-memory errors. These should never leak details to the client. We replace the message with a generic string and set the code to `INTERNAL_SERVER_ERROR`. The real details are logged server-side for debugging.

---

## Wiring formatError into Apollo Server

Update your server setup to use the formatError function:

```typescript
// src/index.ts
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './resolvers/index.js';
import { createDataLoaders, DataLoaders } from './dataloaders/index.js';
import { formatError } from './errors/format-error.js';

export interface GraphQLContext {
  loaders: DataLoaders;
}

const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  formatError,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async () => ({
    loaders: createDataLoaders(),
  }),
});

console.log('Server ready at ' + url);
```

Just one additional import and one additional property on the server config. Apollo Server calls `formatError` for every error in the response, including errors from field resolvers in partial responses.

---

## Testing Error Handling

Start your server and test each error type in Apollo Sandbox.

Testing NotFoundError:

```graphql
query {
  startup(id: "nonexistent-id") {
    title
  }
}
```

Expected response:

```json
{
  "data": null,
  "errors": [
    {
      "message": "Startup not found: nonexistent-id",
      "path": ["startup"],
      "extensions": {
        "code": "NOT_FOUND",
        "resource": "Startup",
        "resourceId": "nonexistent-id"
      }
    }
  ]
}
```

Testing partial failures with aliases:

```graphql
query {
  validStartup: startup(id: "startup-1") {
    title
  }
  invalidStartup: startup(id: "nonexistent") {
    title
  }
}
```

Expected response:

```json
{
  "data": {
    "validStartup": {
      "title": "TechFlow"
    },
    "invalidStartup": null
  },
  "errors": [
    {
      "message": "Startup not found: nonexistent",
      "path": ["invalidStartup"],
      "extensions": {
        "code": "NOT_FOUND"
      }
    }
  ]
}
```

This demonstrates partial data. The valid startup loads successfully while the invalid one returns null with an error. The client can display the valid data and handle the error separately.

Testing unexpected errors: Temporarily add a resolver that throws a plain Error:

```typescript
testError: () => {
  throw new Error('Database connection refused on port 5432');
},
```

In development, you will see the full error message and stack trace. If you set `NODE_ENV=production` and restart, you will see:

```json
{
  "errors": [
    {
      "message": "An unexpected error occurred. Please try again later.",
      "extensions": {
        "code": "INTERNAL_SERVER_ERROR"
      }
    }
  ]
}
```

The database connection details are hidden from the client but logged on the server.

---

## Expected vs Unexpected Errors

This distinction is the foundation of good error handling. Let us be precise about what each category means.

Expected errors are conditions you anticipate and deliberately throw:
- A resource does not exist (NotFoundError)
- The user is not authenticated (AuthenticationError)
- The user lacks permission (ForbiddenError)
- Input data is invalid (UserInputError)
- A business rule is violated (e.g., "Cannot upvote your own startup")

These errors have clear messages and error codes. The client knows how to handle them. They are logged at info level because they are normal application behavior.

Unexpected errors are things you did not plan for:
- A database connection drops
- A null pointer because of a bug in your code
- An out-of-memory error
- A third-party API returns an unexpected response
- A file system operation fails

These errors should be masked from the client and logged at error level. They indicate something is wrong with the system, not with the user's request. In production, the client gets a generic message. On the server, you get the full error with stack trace for debugging.

The `formatError` function enforces this boundary. It checks `instanceof AppError` to distinguish the two categories. If you always throw `AppError` subclasses for expected conditions, everything else is automatically treated as unexpected.

---

## Nullable vs Non-Nullable Fields and Error Propagation

There is an important interaction between error handling and schema design. Consider this schema:

```graphql
type Query {
  startup(id: ID!): Startup       # nullable return
  startups: [Startup!]!            # non-nullable list with non-nullable items
}

type Startup {
  id: ID!
  title: String!
  founder: User                    # nullable
  category: Category!              # non-nullable
}
```

When a field resolver throws an error, GraphQL follows a null propagation rule:

- If the field is nullable (like `startup` or `founder`), GraphQL sets it to `null` and adds the error to the errors array. The rest of the response is unaffected.

- If the field is non-nullable (like `category` or items in `[Startup!]!`), GraphQL cannot set it to `null` because the schema says it must exist. So it propagates the null up to the nearest nullable parent.

Here is a concrete example. If the `category` resolver throws an error for one startup in the list:

```graphql
query {
  startups {    # [Startup!]!
    title
    category {  # Category! (non-nullable)
      name
    }
  }
}
```

Because `category` is non-nullable, its parent `Startup` becomes null. But `[Startup!]` says startups cannot be null in the list. So the entire `startups` field becomes null. The error wipes out the whole response.

This is called null propagation and it is one of the most surprising behaviors in GraphQL. The fix is strategic nullability:

```graphql
type Startup {
  id: ID!
  title: String!
  founder: User       # nullable - safe
  category: Category  # make this nullable too
}
```

The rule of thumb: make fields nullable unless you are certain they will never fail and never be missing. This gives GraphQL room to return partial data. Non-nullable fields are a promise to the client. Break that promise (by throwing an error) and you lose more data than just that field.

---

## Error Logging and Monitoring in Production

Our `console.log`-based logging is fine for development. In production you need structured logging that integrates with monitoring services. Here is a pattern:

```typescript
// src/errors/logger.ts
interface ErrorLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  type: 'expected' | 'unexpected';
  message: string;
  code: string | undefined;
  path: readonly (string | number)[] | undefined;
  requestId: string | undefined;
}

export function createErrorLogger(requestId?: string) {
  return {
    logExpected(
      message: string,
      code: string | undefined,
      path: readonly (string | number)[] | undefined
    ): void {
      const entry: ErrorLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        type: 'expected',
        message,
        code,
        path,
        requestId,
      };
      // In production: send to Datadog, Sentry, CloudWatch, etc.
      console.info(JSON.stringify(entry));
    },

    logUnexpected(
      message: string,
      path: readonly (string | number)[] | undefined,
      stack?: string
    ): void {
      const entry: ErrorLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        type: 'unexpected',
        message,
        code: 'INTERNAL_SERVER_ERROR',
        path,
        requestId,
      };
      console.error(JSON.stringify(entry));
      // sentry.captureException(error);
    },
  };
}
```

Structured JSON logging is important because log aggregation tools (like CloudWatch Logs Insights or Datadog) can parse JSON and let you search, filter, and create dashboards from the structured fields.

For request tracking, add a `requestId` to your context:

```typescript
context: async ({ req }) => ({
  loaders: createDataLoaders(),
  requestId: req.headers['x-request-id'] || crypto.randomUUID(),
}),
```

Then include the request ID in every error log. When a user reports a problem, you can search logs by request ID to find all related errors for that specific request.

---

## Error Handling Strategies

Now that we have the building blocks, here are guidelines for when to use each approach.

Throw errors for operations that cannot proceed: When a resolver cannot return meaningful data, throw an error. A query for a specific startup that does not exist should throw `NotFoundError`. There is no data to return.

Return null for optional relationships: If a startup's `websiteUrl` field is null, that is not an error. If a user has no avatar, return null. These are expected states, not failures.

Use try/catch for external service calls: When calling an external API or database, wrap the call in try/catch. Convert known failure modes into AppError subclasses and let unknown failures bubble up as unexpected errors:

```typescript
async function getStartupFromDB(id: string): Promise<Startup> {
  try {
    const result = await db.query('SELECT * FROM startups WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw new NotFoundError('Startup', id);
    }
    return result.rows[0];
  } catch (error) {
    // Re-throw AppErrors as-is
    if (error instanceof AppError) throw error;
    // Wrap database errors
    console.error('Database error:', error);
    throw new Error('Failed to fetch startup');
  }
}
```

Never swallow errors silently: If something goes wrong, either throw an error or log it. A resolver that catches an exception and returns an empty array without logging will make debugging impossible.

---

## Client-Side Error Handling

For completeness, here is how a well-structured client handles the different error codes:

```typescript
// Client-side error handler (for reference)
function handleGraphQLErrors(errors: GraphQLError[]) {
  for (const error of errors) {
    const code = error.extensions?.code;

    switch (code) {
      case 'UNAUTHENTICATED':
        // Redirect to login page
        router.push('/login');
        break;

      case 'FORBIDDEN':
        // Show access denied message
        showNotification(
          'You do not have access to this resource',
          'error'
        );
        break;

      case 'NOT_FOUND':
        // Remove from local cache, show not found UI
        const resource = error.extensions?.resource as string;
        const resourceId = error.extensions?.resourceId as string;
        cache.evict(resource, resourceId);
        showNotification('The requested item was not found', 'warning');
        break;

      case 'BAD_USER_INPUT':
        // Map field errors to form fields
        const fieldErrors = error.extensions?.fieldErrors as FieldError[];
        if (fieldErrors) {
          fieldErrors.forEach(({ field, message }) => {
            form.setError(field, { message });
          });
        }
        break;

      case 'INTERNAL_SERVER_ERROR':
      default:
        // Generic error, suggest retry
        showNotification(
          'Something went wrong. Please try again.',
          'error'
        );
        break;
    }
  }
}
```

The switch on `extensions.code` is why consistent error codes matter. The client can handle each error type differently without fragile string matching on error messages.

---

## Union Types for Error Handling (Alternative Approach)

Some GraphQL APIs model expected outcomes as union types in the schema instead of using the errors array:

```graphql
union CreateStartupResult = CreateStartupSuccess | ValidationError

type CreateStartupSuccess {
  startup: Startup!
}

type ValidationError {
  fieldErrors: [FieldError!]!
}

type FieldError {
  field: String!
  message: String!
}

type Mutation {
  createStartup(input: CreateStartupInput!): CreateStartupResult!
}
```

The client handles this with inline fragments:

```graphql
mutation {
  createStartup(input: { ... }) {
    ... on CreateStartupSuccess {
      startup { id title }
    }
    ... on ValidationError {
      fieldErrors { field message }
    }
  }
}
```

This approach has advantages: errors are part of the schema, so they are discoverable and typed. The client can handle them with standard data-fetching logic. But it also makes the schema much more verbose, especially when you have many mutations.

Both approaches are valid. The errors array approach we use in this workshop is simpler and more common. The union type approach is worth considering for APIs where you want maximum type safety.

---

## Exercise

1. Add an `AuthenticationError` check to the `createStartup` mutation. Check for a header like `x-api-key` in the context. If missing, throw `AuthenticationError`.

2. Create a `ForbiddenError` scenario: when updating a startup, verify that a `userId` from the context matches the startup's `founderId`. If not, throw `ForbiddenError`.

3. Test the `formatError` function by running your server with `NODE_ENV=production` and sending requests that trigger each error type. Verify that unexpected errors are masked and expected errors pass through with their codes.

4. Experiment with null propagation: make a non-nullable field throw an error and observe how it affects the parent fields in the response.

---

## Summary

GraphQL error handling is richer than REST because responses can contain both data and errors. We built a system with four layers:

1. Error classes (`NotFoundError`, `AuthenticationError`, `ForbiddenError`, `UserInputError`) that attach structured codes and metadata to GraphQL errors.

2. Resolvers that throw the appropriate error class for each failure case.

3. A `formatError` function that masks unexpected errors in production while letting expected errors through with their full details.

4. A logging strategy that distinguishes expected errors (informational) from unexpected errors (needs attention).

The key files we created or updated:

- `src/errors/index.ts` - Error class hierarchy
- `src/errors/format-error.ts` - Production error formatting and masking
- Updated resolver files to use typed errors consistently

In the next lesson we will add real-time subscriptions so clients can receive updates as they happen.
