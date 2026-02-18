# Validation and Error Handling

Right now our API accepts any garbage data you throw at it. Send a startup with no name? Sure. Send an empty object? No problem, enjoy your cryptic SQLite error. That is not how production APIs work.

In this lesson you will add input validation with Zod and build a proper error handling system. By the end, your API will reject bad data with clear, field-level error messages and handle unexpected errors gracefully instead of dumping stack traces to the client.

## What You Will Learn

- Defining validation schemas with Zod
- Building reusable validation middleware for Express
- Creating custom error classes for different failure modes
- Building a global error handler that catches everything
- Returning consistent, structured error responses

## Concepts

### Why Validation Matters

Without validation, three bad things happen:

1. Bad data gets into your database. Once it is in there, it is painful to clean up. Imagine a startup with an empty name showing up on your frontend.

2. Your database throws cryptic errors. SQLite will reject a NOT NULL violation, but the error message is not something you want to show to an API consumer.

3. Security holes open up. SQL injection, oversized payloads, and unexpected data types can all cause problems if you blindly trust user input.

Server-side validation is not optional. Even if you have client-side validation on the frontend, you must validate on the server too. Anyone can bypass the frontend by sending requests directly to your API.

### Zod: Schema Validation for TypeScript

Zod is a TypeScript-first schema validation library. You define a schema that describes what valid data looks like, and Zod checks incoming data against it. If validation fails, you get structured error details with exact field paths and messages.

Why Zod over alternatives like Joi or Yup?

- It is TypeScript-native. You can infer TypeScript types directly from your schemas, so you never have to define types separately.
- It has zero dependencies.
- The API is chainable and readable.
- It has excellent error messages out of the box.

### The Error Handling Strategy

Our error handling has three layers:

1. Validation errors: Bad input from the client. Return 400 with field-level details.
2. Not found errors: Resource does not exist. Return 404 with a message.
3. Unexpected errors: Bugs, database failures, anything else. Return 500 with a generic message (never expose internals).

We will use custom error classes for the first two, and a global error handler catches everything.

## Step by Step

### Step 1: Create Custom Error Classes

Start with a clean set of error classes that your application can throw. These are not validation schemas -- they are JavaScript error classes that carry HTTP status codes and structured details.

Create the file `src/errors.ts`:

```ts
// src/errors.ts

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  public readonly errors: FieldError[];

  constructor(errors: FieldError[]) {
    super('Validation failed', 400);
    this.errors = errors;
  }
}

export interface FieldError {
  field: string;
  message: string;
}
```

Let us walk through what each class does.

`AppError` is the base class. Every custom error extends it. It carries a `statusCode` so the error handler knows what HTTP status to return. The `isOperational` flag distinguishes expected errors (bad input, missing resource) from unexpected bugs. The `Error.captureStackTrace` call ensures the stack trace starts at the point where you created the error, not inside the constructor itself.

`NotFoundError` is for when a resource does not exist. It automatically formats a human-readable message and sets the status to 404.

`ValidationError` carries an array of `FieldError` objects. Each one has a `field` name (like "name" or "tagline") and a `message` explaining what went wrong. This structure makes it easy for frontend code to display errors next to the right form fields.

### Step 2: Create Zod Schemas

Now define what valid startup data looks like. Create the schemas directory and file.

Create `src/schemas/startup.ts`:

```ts
// src/schemas/startup.ts
import { z } from 'zod';

export const createStartupSchema = z.object({
  name: z
    .string({
      required_error: 'Name is required',
    })
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),

  tagline: z
    .string({
      required_error: 'Tagline is required',
    })
    .min(10, 'Tagline must be at least 10 characters')
    .max(200, 'Tagline must be at most 200 characters')
    .trim(),

  description: z
    .string({
      required_error: 'Description is required',
    })
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description must be at most 2000 characters')
    .trim(),

  url: z
    .string({
      required_error: 'URL is required',
    })
    .url('URL must be a valid URL (e.g. https://example.com)'),

  category_id: z
    .number({
      required_error: 'Category is required',
      invalid_type_error: 'Category must be a number',
    })
    .int('Category must be an integer')
    .positive('Category must be a positive number'),
});

export const updateStartupSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim()
    .optional(),

  tagline: z
    .string()
    .min(10, 'Tagline must be at least 10 characters')
    .max(200, 'Tagline must be at most 200 characters')
    .trim()
    .optional(),

  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description must be at most 2000 characters')
    .trim()
    .optional(),

  url: z
    .string()
    .url('URL must be a valid URL (e.g. https://example.com)')
    .optional(),

  category_id: z
    .number({
      invalid_type_error: 'Category must be a number',
    })
    .int('Category must be an integer')
    .positive('Category must be a positive number')
    .optional(),
});

// Infer TypeScript types from the schemas
export type CreateStartupInput = z.infer<typeof createStartupSchema>;
export type UpdateStartupInput = z.infer<typeof updateStartupSchema>;
```

A few things to notice here.

The `createStartupSchema` requires all fields. Every field has a `required_error` that provides a clear message when it is missing entirely. The chain of `.min()`, `.max()`, and `.trim()` adds further constraints. The `.url()` validator checks that the string is actually a valid URL.

The `updateStartupSchema` makes every field optional with `.optional()`. When you update a startup, you should be able to send only the fields you want to change. But if you do send a field, it still has to pass the same constraints.

The `z.infer` utility at the bottom extracts TypeScript types from the schemas. This means you never write a separate interface -- the schema is the single source of truth for both runtime validation and compile-time types.

### Step 3: Build Validation Middleware

Now create middleware that takes a Zod schema and validates the request body against it.

Create `src/middleware/validate.ts`:

```ts
// src/middleware/validate.ts
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

function formatZodErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
```

This middleware is a higher-order function. You call `validate(someSchema)` and it returns an Express middleware function. Inside, it uses `safeParse` instead of `parse`. The difference is important: `parse` throws on failure, while `safeParse` returns a result object with `success: boolean` and either `data` or `error`. This gives us control over how to handle the failure.

The `formatZodErrors` function converts Zod's error format into our simpler `FieldError` format. Zod errors have a `path` array (for nested objects this could be `['address', 'city']`) and a `message`. We join the path with dots to get field names like `address.city`.

One important detail: after validation succeeds, we replace `req.body` with `result.data`. This is the parsed and transformed data -- strings have been trimmed, types have been coerced. Your route handler gets clean data.

### Step 4: Build the Global Error Handler

This is the safety net that catches every error in your application.

Create `src/middleware/error-handler.ts`:

```ts
// src/middleware/error-handler.ts
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
```

This is an Express error-handling middleware. You can tell because it has four parameters instead of three. Express knows that middleware with the signature `(err, req, res, next)` is an error handler.

The handler checks the error type and responds accordingly:

- `ValidationError`: Returns 400 with the field-level error details.
- `AppError` (including `NotFoundError`): Returns the appropriate status code with the error message.
- Everything else: Returns a generic 500. You never want to expose stack traces, database errors, or internal details to the client. Log them on the server, but send a safe message to the client.

### Step 5: Wire Up the Validation Middleware

Now update your startup routes to use validation on POST and PUT.

Update `src/routes/startups.ts`. Here is what the create and update routes should look like after adding validation:

```ts
// src/routes/startups.ts
import { Router } from 'express';
import { db } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { createStartupSchema, updateStartupSchema } from '../schemas/startup.js';
import { NotFoundError } from '../errors.js';

const router = Router();

// GET /api/startups -- List all startups
router.get('/', (req, res) => {
  const startups = db.prepare('SELECT * FROM startups').all();
  res.json({ data: startups });
});

// GET /api/startups/:id -- Get a single startup
router.get('/:id', (req, res) => {
  const startup = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(req.params.id);

  if (!startup) {
    throw new NotFoundError('Startup', req.params.id);
  }

  res.json({ data: startup });
});

// POST /api/startups -- Create a new startup
router.post('/', validate(createStartupSchema), (req, res) => {
  const { name, tagline, description, url, category_id } = req.body;

  const result = db
    .prepare(
      'INSERT INTO startups (name, tagline, description, url, category_id) VALUES (?, ?, ?, ?, ?)'
    )
    .run(name, tagline, description, url, category_id);

  const startup = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json({ data: startup });
});

// PUT /api/startups/:id -- Update a startup
router.put('/:id', validate(updateStartupSchema), (req, res) => {
  const existing = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(req.params.id);

  if (!existing) {
    throw new NotFoundError('Startup', req.params.id);
  }

  const fields = req.body;
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    updates.push(`${key} = ?`);
    values.push(value);
  }

  if (updates.length > 0) {
    values.push(req.params.id);
    db.prepare(
      `UPDATE startups SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(...values);
  }

  const startup = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(req.params.id);

  res.json({ data: startup });
});

// DELETE /api/startups/:id -- Delete a startup
router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM startups WHERE id = ?')
    .get(req.params.id);

  if (!existing) {
    throw new NotFoundError('Startup', req.params.id);
  }

  db.prepare('DELETE FROM startups WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
```

Notice the changes:

1. The POST route now has `validate(createStartupSchema)` as middleware before the handler. If validation fails, the handler never runs.

2. The PUT route uses `validate(updateStartupSchema)` which allows partial updates.

3. GET by ID and DELETE now throw `NotFoundError` instead of manually sending 404 responses. The error handler takes care of formatting the response.

4. We removed the manual `if (!startup) { res.status(404).json(...) }` pattern. Throwing errors is cleaner because it works the same way everywhere, and the error handler ensures consistent response formatting.

### Step 6: Register the Error Handler

The error handler must be registered after all your routes in the main app file.

Update `src/index.ts`:

```ts
// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import startupsRouter from './routes/startups.js';
import { errorHandler } from './middleware/error-handler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/startups', startupsRouter);

// Global error handler -- MUST be after all routes
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
```

The order matters. Express processes middleware in the order you register it. The error handler must come last so it can catch errors from any route.

### Step 7: Handle Async Errors

There is a gotcha with Express 4 and thrown errors. If you throw inside an async route handler, Express will not catch it -- it becomes an unhandled promise rejection and your server may crash.

For our current code, the better-sqlite3 library is synchronous, so throwing works fine. But if you ever switch to an async database driver or add any async operations, you need to wrap your handlers.

Here is a simple wrapper you can add to `src/middleware/validate.ts` or create as a separate utility:

```ts
// src/middleware/async-handler.ts
import { Request, Response, NextFunction } from 'express';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

You would use it like this:

```ts
router.get('/:id', asyncHandler(async (req, res) => {
  // async operations are safe here
  const startup = await someAsyncQuery(req.params.id);
  if (!startup) throw new NotFoundError('Startup', req.params.id);
  res.json({ data: startup });
}));
```

For Express 5 (coming soon), this wrapper is not needed because Express 5 handles async errors automatically. But for Express 4, keep this utility handy.

## Test It Out

Start your server and test the validation:

```bash
npm run dev
```

Send a POST request with missing fields:

```bash
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{}'
```

You should get a 400 response:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "name", "message": "Name is required" },
    { "field": "tagline", "message": "Tagline is required" },
    { "field": "description", "message": "Description is required" },
    { "field": "url", "message": "URL is required" },
    { "field": "category_id", "message": "Category is required" }
  ]
}
```

Send a POST with invalid data:

```bash
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{"name": "A", "tagline": "short", "description": "too short", "url": "not-a-url", "category_id": -1}'
```

Response:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "name", "message": "Name must be at least 2 characters" },
    { "field": "tagline", "message": "Tagline must be at least 10 characters" },
    { "field": "description", "message": "Description must be at least 50 characters" },
    { "field": "url", "message": "URL must be a valid URL (e.g. https://example.com)" },
    { "field": "category_id", "message": "Category must be a positive number" }
  ]
}
```

Try fetching a non-existent startup:

```bash
curl http://localhost:3000/api/startups/99999
```

Response:

```json
{
  "error": "Startup with id '99999' not found"
}
```

Now send valid data:

```bash
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{"name": "TestStartup", "tagline": "A tagline that is long enough to pass", "description": "This is a description that is definitely long enough to pass the fifty character minimum requirement for the validation schema.", "url": "https://teststartup.com", "category_id": 1}'
```

You should get a 201 with the created startup.

## File Summary

Here is every file you created or modified in this lesson:

- `src/errors.ts` -- Custom error classes (AppError, NotFoundError, ValidationError)
- `src/schemas/startup.ts` -- Zod schemas for create and update
- `src/middleware/validate.ts` -- Validation middleware that connects Zod to Express
- `src/middleware/error-handler.ts` -- Global error handler
- `src/middleware/async-handler.ts` -- Async wrapper for future use
- `src/routes/startups.ts` -- Updated with validation middleware and NotFoundError
- `src/index.ts` -- Updated to register the error handler

## Key Takeaways

- Never trust client input. Validate everything on the server.
- Zod schemas serve double duty: runtime validation and TypeScript type inference.
- Custom error classes let you throw errors anywhere and handle them in one place.
- The global error handler ensures consistent error responses across your entire API.
- Never expose internal error details (stack traces, SQL errors) to the client.
- Express 4 needs an async wrapper for async route handlers. Express 5 fixes this.

## Exercises

1. Add a schema for a category. Categories should have a `name` (required, 2-50 characters) and a `description` (optional, max 200 characters). Apply validation to a POST /api/categories route.

2. Add a custom error class called `ConflictError` with status 409. Use it when someone tries to create a startup with a name that already exists.

3. The current `updateStartupSchema` allows sending an empty object (no fields). Add a `.refine()` check that requires at least one field to be present.

## Next Lesson

Your API validates input and handles errors properly. But the GET /api/startups endpoint returns every single startup in the database. In Lesson 07, you will add pagination, sorting, and filtering so clients can request exactly the data they need.
