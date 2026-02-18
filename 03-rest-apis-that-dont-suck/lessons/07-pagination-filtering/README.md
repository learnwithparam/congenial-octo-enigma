# Pagination and Filtering

Your GET /api/startups endpoint currently returns every startup in the database in a single response. With 10 startups that is fine. With 10,000 it is a disaster -- slow responses, wasted bandwidth, and a frontend that chokes trying to render everything at once.

In this lesson you will add pagination, sorting, filtering, and search to the list endpoint. These are table-stakes features for any production API. By the end, your clients will be able to request exactly the slice of data they need.

## What You Will Learn

- Offset-based pagination with page and limit parameters
- Dynamic SQL query building with parameterized queries
- Sorting by multiple fields in ascending or descending order
- Filtering by category
- Text search with SQL LIKE
- Returning pagination metadata alongside the data

## Concepts

### Offset-Based Pagination

The most common pagination approach uses two parameters:

- `page`: Which page of results to return (starting from 1)
- `limit`: How many results per page

The database uses OFFSET and LIMIT to skip and take rows. If you ask for page 3 with a limit of 10, the query skips the first 20 rows and returns the next 10.

```
Page 1: OFFSET 0,  LIMIT 10  (rows 1-10)
Page 2: OFFSET 10, LIMIT 10  (rows 11-20)
Page 3: OFFSET 20, LIMIT 10  (rows 21-30)
```

The formula is: `OFFSET = (page - 1) * limit`

Offset-based pagination is simple and works well for most use cases. It has one downside: if data is inserted or deleted between page requests, you might see duplicates or miss items. For most applications this is acceptable. When it is not, you would use cursor-based pagination (which we will not cover here).

### Dynamic Query Building

When you have multiple optional filters, you cannot use a single hardcoded SQL query. Instead, you build the query dynamically by appending WHERE clauses, ORDER BY, and LIMIT/OFFSET based on what the client requested.

The key rule: never concatenate user input directly into SQL strings. Always use parameterized queries (the `?` placeholders) to prevent SQL injection.

### SQL Patterns

Here are the SQL features we will use:

- `LIMIT n`: Return at most n rows
- `OFFSET n`: Skip the first n rows
- `ORDER BY column ASC|DESC`: Sort results
- `WHERE column = ?`: Exact match filter
- `WHERE column LIKE ?`: Pattern matching (use `%` as wildcard)
- `COUNT(*)`: Count total matching rows (for pagination metadata)

## Step by Step

### Step 1: Validate Query Parameters

Before building dynamic queries, validate the incoming query parameters. Create a new schema for the list endpoint.

Add to `src/schemas/startup.ts`:

```ts
// Add these to the existing src/schemas/startup.ts file

export const listStartupsSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform(Number)
    .pipe(z.number().int().positive('Page must be a positive integer')),

  limit: z
    .string()
    .optional()
    .default('10')
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit must be at most 100')
    ),

  sort: z
    .enum(['created_at', 'name', 'upvotes'], {
      errorMap: () => ({
        message: 'Sort must be one of: created_at, name, upvotes',
      }),
    })
    .optional()
    .default('created_at'),

  order: z
    .enum(['asc', 'desc'], {
      errorMap: () => ({
        message: 'Order must be asc or desc',
      }),
    })
    .optional()
    .default('desc'),

  category: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : undefined))
    .pipe(
      z
        .number()
        .int()
        .positive('Category must be a positive integer')
        .optional()
    ),

  search: z.string().optional(),
});

export type ListStartupsQuery = z.infer<typeof listStartupsSchema>;
```

Query parameters arrive as strings, which is why every numeric field uses `.transform(Number)` followed by `.pipe()` to validate the transformed number. This is a common Zod pattern for parsing query strings.

A few design decisions worth explaining:

- Default page is 1, default limit is 10. Clients that do not send these params get sensible defaults.
- Maximum limit is 100. This prevents a client from requesting 10,000 rows in one shot.
- Sort options are restricted to specific fields. We do not let the client sort by arbitrary column names -- that would be a SQL injection risk even with parameterized queries (column names cannot be parameterized).
- Default sort is `created_at` descending, so newest startups appear first.

### Step 2: Build a Query Validation Middleware

The `validate` middleware from Lesson 06 validates `req.body`. For GET requests, we need to validate `req.query` instead. Add a second middleware function.

Update `src/middleware/validate.ts`:

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
```

We attach the parsed data to `req.validatedQuery` instead of overwriting `req.query`. The Express `req.query` object has a specific type and modifying it can cause type issues. Using a custom property is cleaner.

### Step 3: Build the Dynamic Query

This is the core of the lesson. Update the GET /api/startups handler to support all the query parameters.

Here is the updated `src/routes/startups.ts`. The GET / handler is the one that changes significantly:

```ts
// src/routes/startups.ts
import { Router } from 'express';
import { db } from '../db/index.js';
import { validate, validateQuery } from '../middleware/validate.js';
import {
  createStartupSchema,
  updateStartupSchema,
  listStartupsSchema,
} from '../schemas/startup.js';
import type { ListStartupsQuery } from '../schemas/startup.js';
import { NotFoundError } from '../errors.js';

const router = Router();

// GET /api/startups -- List startups with pagination, sorting, and filtering
router.get('/', validateQuery(listStartupsSchema), (req, res) => {
  const query = (req as any).validatedQuery as ListStartupsQuery;
  const { page, limit, sort, order, category, search } = query;

  // Build WHERE clauses dynamically
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (category) {
    conditions.push('s.category_id = ?');
    params.push(category);
  }

  if (search) {
    conditions.push('(s.name LIKE ? OR s.tagline LIKE ?)');
    const searchPattern = '%' + search + '%';
    params.push(searchPattern, searchPattern);
  }

  const whereClause =
    conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Count total matching rows (before pagination)
  const countQuery = 'SELECT COUNT(*) as total FROM startups s ' + whereClause;
  const countResult = db.prepare(countQuery).get(...params) as {
    total: number;
  };
  const total = countResult.total;

  // Build the data query with sorting and pagination
  const offset = (page - 1) * limit;
  const dataQuery =
    'SELECT s.*, c.name as category_name ' +
    'FROM startups s ' +
    'LEFT JOIN categories c ON s.category_id = c.id ' +
    whereClause + ' ' +
    'ORDER BY s.' + sort + ' ' + order.toUpperCase() + ' ' +
    'LIMIT ? OFFSET ?';

  const dataParams = [...params, limit, offset];
  const startups = db.prepare(dataQuery).all(...dataParams);

  const totalPages = Math.ceil(total / limit);

  res.json({
    data: startups,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

// GET /api/startups/:id -- Get a single startup
router.get('/:id', (req, res) => {
  const startup = db
    .prepare(
      'SELECT s.*, c.name as category_name ' +
      'FROM startups s ' +
      'LEFT JOIN categories c ON s.category_id = c.id ' +
      'WHERE s.id = ?'
    )
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
    updates.push(key + ' = ?');
    values.push(value);
  }

  if (updates.length > 0) {
    values.push(req.params.id);
    db.prepare(
      'UPDATE startups SET ' + updates.join(', ') + ', updated_at = CURRENT_TIMESTAMP WHERE id = ?'
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

Let us walk through the dynamic query building step by step.

### How the Dynamic Query Works

Step 1: We start with empty arrays for conditions and params.

Step 2: If a `category` filter was provided, we add a WHERE condition. The `?` is a parameterized placeholder -- the actual value goes into the params array. This prevents SQL injection because the database driver handles escaping.

Step 3: If a `search` term was provided, we add a LIKE condition that searches both the name and tagline columns. The `%` wildcards mean "match anything before and after the search term." We push the search pattern twice because we have two `?` placeholders (one for name, one for tagline).

Step 4: We join all conditions with AND. If there are no conditions, the WHERE clause is an empty string and the query returns all rows.

Step 5: Before fetching the data, we run a COUNT query with the same WHERE clause. This tells us the total number of matching rows, which we need for the pagination metadata. Without this count, the client would not know how many pages exist.

Step 6: We build the data query with ORDER BY and LIMIT/OFFSET. The sort column and order direction are inserted directly into the SQL string (not parameterized), but this is safe because we validated them against an allowlist in the Zod schema. Only `created_at`, `name`, or `upvotes` can appear as sort columns. Only `asc` or `desc` can appear as order directions.

Step 7: We combine the filter params with the pagination params. The order matters -- the params must match the order of `?` placeholders in the query.

### Understanding the Generated SQL

Here is an example of what the generated SQL looks like when a client requests:
`GET /api/startups?page=2&limit=5&sort=name&order=asc&category=3&search=ai`

Count query:
```sql
SELECT COUNT(*) as total
FROM startups s
WHERE s.category_id = ? AND (s.name LIKE ? OR s.tagline LIKE ?)
-- params: [3, '%ai%', '%ai%']
```

Data query:
```sql
SELECT s.*, c.name as category_name
FROM startups s
LEFT JOIN categories c ON s.category_id = c.id
WHERE s.category_id = ? AND (s.name LIKE ? OR s.tagline LIKE ?)
ORDER BY s.name ASC
LIMIT ? OFFSET ?
-- params: [3, '%ai%', '%ai%', 5, 5]
```

The LEFT JOIN with categories is a bonus. Instead of returning just a `category_id`, we also return the category name. This saves the client from making a separate request to look up the category.

### Step 4: Add the Upvotes Column

If your startups table does not have an `upvotes` column yet, add it. Update your database initialization in `src/db/index.ts` to include it in the CREATE TABLE statement:

```sql
CREATE TABLE IF NOT EXISTS startups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  upvotes INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

If you already have data and do not want to reset the database, you can run an ALTER TABLE migration instead:

```sql
ALTER TABLE startups ADD COLUMN upvotes INTEGER DEFAULT 0;
```

You could add this as a migration step in your seed script or run it directly in a SQLite client.

## Test It Out

Start your server and try these requests.

Basic pagination -- get page 1 with 5 items:

```bash
curl "http://localhost:3000/api/startups?page=1&limit=5"
```

Response:

```json
{
  "data": [
    {
      "id": 10,
      "name": "Latest Startup",
      "tagline": "The newest addition",
      "category_name": "AI/ML"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 12,
    "totalPages": 3
  }
}
```

Sort by name ascending:

```bash
curl "http://localhost:3000/api/startups?sort=name&order=asc"
```

Filter by category:

```bash
curl "http://localhost:3000/api/startups?category=1"
```

Search for startups with "ai" in the name or tagline:

```bash
curl "http://localhost:3000/api/startups?search=ai"
```

Combine everything:

```bash
curl "http://localhost:3000/api/startups?page=1&limit=5&sort=name&order=asc&category=1&search=ai"
```

Test invalid parameters:

```bash
curl "http://localhost:3000/api/startups?page=-1"
```

Response:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "page", "message": "Page must be a positive integer" }
  ]
}
```

Try an invalid sort field:

```bash
curl "http://localhost:3000/api/startups?sort=password"
```

Response:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "sort", "message": "Sort must be one of: created_at, name, upvotes" }
  ]
}
```

### Understanding the Response Shape

The response follows a common API convention:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 47,
    "totalPages": 5
  }
}
```

The `data` array contains the results for the current page. The `pagination` object tells the client everything it needs to build pagination controls:

- `page`: The current page number
- `limit`: How many items per page
- `total`: Total number of matching items across all pages
- `totalPages`: Calculated as `Math.ceil(total / limit)`

The client can use `totalPages` to know when to stop. If `page` equals `totalPages`, there are no more pages. Some APIs also include `hasNextPage` and `hasPreviousPage` booleans, but those are trivial to derive from the existing fields.

## Performance Considerations

For small datasets (under 10,000 rows), offset-based pagination with COUNT works well. As your dataset grows, keep these things in mind:

1. The COUNT query scans all matching rows every time. For millions of rows with complex filters, this gets slow. One optimization is to cache the count or use an approximate count.

2. Large OFFSET values are slow. `OFFSET 100000` means the database reads and discards 100,000 rows before returning your results. For very deep pagination, cursor-based pagination (using a WHERE clause on an indexed column) is much more efficient.

3. Add indexes on columns you filter and sort by. For our use case:

```sql
CREATE INDEX idx_startups_category ON startups(category_id);
CREATE INDEX idx_startups_created_at ON startups(created_at);
CREATE INDEX idx_startups_name ON startups(name);
```

For our LaunchPad API with hundreds or low thousands of startups, offset-based pagination is the right choice. Do not over-engineer.

## File Summary

Here is every file you created or modified in this lesson:

- `src/schemas/startup.ts` -- Added listStartupsSchema for query parameter validation
- `src/middleware/validate.ts` -- Added validateQuery middleware for GET request parameters
- `src/routes/startups.ts` -- Rewrote GET / handler with dynamic query building, pagination, sorting, filtering, and search
- `src/db/index.ts` -- Added upvotes column to startups table (if not already present)

## Key Takeaways

- Always validate query parameters just like you validate request bodies.
- Build SQL queries dynamically but always use parameterized values for user input.
- Restrict sort columns to an allowlist to prevent SQL injection through column names.
- Return pagination metadata so clients know the total count and page boundaries.
- The COUNT query runs separately from the data query because they need different SELECTs.
- LIKE with % wildcards provides basic text search. For advanced search, consider full-text search (FTS5 in SQLite).
- Set sensible defaults (page 1, limit 10) and maximum limits (100) to protect your server.

## Exercises

1. Add a `min_upvotes` query parameter that filters startups with at least N upvotes. Add it to the schema and the dynamic query builder.

2. Add a `created_after` parameter that accepts an ISO date string and filters startups created after that date. Use Zod's `z.string().datetime()` for validation.

3. Currently the search is case-sensitive on some databases. SQLite's LIKE is case-insensitive for ASCII characters by default, but confirm this by searching with different cases. How would you handle case sensitivity on other databases?

4. Add a `fields` query parameter that lets the client specify which columns to return (e.g., `fields=id,name,tagline`). Validate it against an allowlist of column names.

## Next Lesson

Your API now returns paginated, filtered, and sorted data. In Lesson 08, you will learn how to test all of this effectively using Postman and curl, building a complete collection that documents every endpoint and edge case.
