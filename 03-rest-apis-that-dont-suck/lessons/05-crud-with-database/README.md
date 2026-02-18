# CRUD With Database

This is where everything comes together. In this lesson, you will replace the in-memory array with real SQLite queries. Your API endpoints will keep working exactly the same way from the client's perspective, but now data persists across server restarts. You will also add a categories endpoint and learn how to convert between database snake_case and JavaScript camelCase.

## What You'll Learn

- How to refactor in-memory CRUD operations to use SQLite queries
- How to use parameterized queries to safely read and write data
- How to convert between snake_case database columns and camelCase JavaScript properties
- How to generate slugs automatically on insert
- How to add a categories endpoint
- The differences between in-memory and database-backed approaches

## In-Memory vs Database: What Changes?

The transition from in-memory to database storage is surprisingly small. Here is what changes and what stays the same:

Stays the same:
- Route definitions (paths, methods, parameters)
- Response format (the data envelope)
- Error handling patterns (404, 400 responses)
- The overall structure of each handler

Changes:
- Data source: array operations become SQL queries
- ID generation: we relied on a counter, now SQLite handles it with AUTOINCREMENT
- Timestamp management: we called `new Date().toISOString()`, now SQLite's `datetime('now')` handles it
- Column names: the database uses snake_case, our API returns camelCase

## Concepts

### Row Mapping

SQLite returns rows with column names exactly as they are in the database: `funding_amount`, `employee_count`, `created_at`. But our API returns camelCase: `fundingAmount`, `employeeCount`, `createdAt`.

We need a mapping function that converts a database row to an API response object. This is a common pattern in any API that uses a SQL database:

```typescript
function mapStartupRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category_name || null,
    categoryId: row.category_id,
    founder: row.founder,
    website: row.website,
    fundingStage: row.funding_stage,
    fundingAmount: row.funding_amount,
    employeeCount: row.employee_count,
    founded: row.founded,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

This explicit mapping gives you full control over what the API returns. You can rename fields, combine fields, exclude internal fields, or compute derived values. It also means your database schema can evolve independently of your API contract.

### JOINs for Related Data

In the in-memory version, each startup had a `category` string field. In the database, we normalized this into a separate `categories` table with a foreign key. To get the category name along with the startup data, we use a SQL JOIN:

```sql
SELECT s.*, c.name as category_name
FROM startups s
LEFT JOIN categories c ON s.category_id = c.id
```

A LEFT JOIN returns all startups, even those without a matching category (their `category_name` will be null). If we used an INNER JOIN instead, startups without a category would be excluded from the results entirely.

### The `changes` and `lastInsertRowid` Properties

When you run an INSERT, UPDATE, or DELETE with better-sqlite3, the result object includes two useful properties:

- `changes`: the number of rows affected (useful for checking if an UPDATE or DELETE actually modified anything)
- `lastInsertRowid`: the ID of the last inserted row (useful for returning the created resource)

```typescript
const result = stmt.run(name, slug, description);
console.log(result.changes);        // 1 (one row inserted)
console.log(result.lastInsertRowid); // 7 (the new row's ID)
```

We will use `lastInsertRowid` after INSERT operations to fetch and return the complete created row, and `changes` after UPDATE and DELETE operations to detect when the target row does not exist.

## Step by Step

### Step 1: Create a Row Mapper Module

Create `src/db/mappers.ts`:

```typescript
export function mapStartupRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category_name || null,
    categoryId: row.category_id,
    founder: row.founder,
    website: row.website,
    fundingStage: row.funding_stage,
    fundingAmount: row.funding_amount,
    employeeCount: row.employee_count,
    founded: row.founded,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCategoryRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
  };
}
```

These functions are intentionally simple. Each one takes a raw database row and returns a clean API object with camelCase property names. We keep them in a separate file so they can be reused by different route files and test helpers.

The `any` type for the row parameter is not ideal, but better-sqlite3 returns untyped rows. In a production codebase, you might create TypeScript interfaces for your database rows, but for learning purposes the explicit mapping makes the conversion visible and understandable.

### Step 2: Refactor the Startups Router

Replace the contents of `src/routes/startups.ts` with the database-backed version:

```typescript
import { Router, Request, Response } from 'express';
import db from '../db/index.js';
import { mapStartupRow } from '../db/mappers.js';
import { slugify } from '../utils.js';

const router = Router();

// GET /api/startups - List all startups
router.get('/', (_req: Request, res: Response) => {
  const stmt = db.prepare(`
    SELECT s.*, c.name as category_name
    FROM startups s
    LEFT JOIN categories c ON s.category_id = c.id
    ORDER BY s.created_at DESC
  `);

  const rows = stmt.all();
  const startups = rows.map(mapStartupRow);

  res.json({ data: startups });
});

// GET /api/startups/:id - Get a single startup
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'ID must be a number',
      },
    });
    return;
  }

  const stmt = db.prepare(`
    SELECT s.*, c.name as category_name
    FROM startups s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE s.id = ?
  `);

  const row = stmt.get(id);

  if (!row) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Startup with ID ' + id + ' not found',
      },
    });
    return;
  }

  res.json({ data: mapStartupRow(row) });
});

// POST /api/startups - Create a new startup
router.post('/', (req: Request, res: Response) => {
  const {
    name,
    description,
    categoryId,
    founder,
    website,
    fundingStage,
    fundingAmount,
    employeeCount,
    founded,
  } = req.body;

  // Basic validation
  if (!name || !description) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name and description are required',
      },
    });
    return;
  }

  const slug = slugify(name);

  // Check for duplicate slug
  const existing = db.prepare('SELECT id FROM startups WHERE slug = ?').get(slug);
  if (existing) {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A startup with a similar name already exists',
      },
    });
    return;
  }

  const insertStmt = db.prepare(`
    INSERT INTO startups (
      name, slug, description, category_id, founder,
      website, funding_stage, funding_amount, employee_count, founded
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertStmt.run(
    name,
    slug,
    description,
    categoryId || null,
    founder || '',
    website || '',
    fundingStage || 'Pre-Seed',
    fundingAmount || 0,
    employeeCount || 1,
    founded || new Date().getFullYear()
  );

  // Fetch the created row to return it
  const newRow = db.prepare(`
    SELECT s.*, c.name as category_name
    FROM startups s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE s.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ data: mapStartupRow(newRow) });
});

// PUT /api/startups/:id - Update a startup
router.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'ID must be a number',
      },
    });
    return;
  }

  // Check if the startup exists
  const existing = db.prepare('SELECT id FROM startups WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Startup with ID ' + id + ' not found',
      },
    });
    return;
  }

  const {
    name,
    description,
    categoryId,
    founder,
    website,
    fundingStage,
    fundingAmount,
    employeeCount,
    founded,
  } = req.body;

  if (!name || !description) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name and description are required',
      },
    });
    return;
  }

  const slug = slugify(name);

  // Check for duplicate slug (but allow the same startup to keep its slug)
  const duplicate = db.prepare(
    'SELECT id FROM startups WHERE slug = ? AND id != ?'
  ).get(slug, id);

  if (duplicate) {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A startup with a similar name already exists',
      },
    });
    return;
  }

  const updateStmt = db.prepare(`
    UPDATE startups SET
      name = ?,
      slug = ?,
      description = ?,
      category_id = ?,
      founder = ?,
      website = ?,
      funding_stage = ?,
      funding_amount = ?,
      employee_count = ?,
      founded = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);

  updateStmt.run(
    name,
    slug,
    description,
    categoryId || null,
    founder || '',
    website || '',
    fundingStage || 'Pre-Seed',
    fundingAmount || 0,
    employeeCount || 1,
    founded || new Date().getFullYear(),
    id
  );

  // Fetch the updated row to return it
  const updatedRow = db.prepare(`
    SELECT s.*, c.name as category_name
    FROM startups s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE s.id = ?
  `).get(id);

  res.json({ data: mapStartupRow(updatedRow) });
});

// DELETE /api/startups/:id - Delete a startup
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'ID must be a number',
      },
    });
    return;
  }

  const result = db.prepare('DELETE FROM startups WHERE id = ?').run(id);

  if (result.changes === 0) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Startup with ID ' + id + ' not found',
      },
    });
    return;
  }

  res.status(204).send();
});

export default router;
```

Let us examine the key differences from the in-memory version.

In the list endpoint, instead of returning a static array, we run a SELECT query with a LEFT JOIN to include the category name. The `stmt.all()` method returns all matching rows as an array of objects. We map each row through `mapStartupRow` to convert snake_case to camelCase. The `ORDER BY s.created_at DESC` clause returns the most recently created startups first.

In the get-one endpoint, `stmt.get(id)` returns a single row or `undefined` if no match is found. The `?` placeholder in the WHERE clause is replaced with the `id` value, safely preventing SQL injection.

The create endpoint now generates a slug and checks for duplicates before inserting. After the INSERT, we use `result.lastInsertRowid` to fetch the complete row (including server-generated fields like timestamps) and return it to the client. This round-trip is necessary because SQLite's `datetime('now')` generates the timestamps, not our JavaScript code.

The update endpoint checks for existence first, then validates the body, then checks for slug conflicts (excluding the current startup from the duplicate check with `AND id != ?`). The UPDATE statement explicitly sets `updated_at = datetime('now')` so the timestamp reflects the modification time.

The delete endpoint is the most elegant change. Instead of finding an index and splicing, we run a DELETE query and check `result.changes`. If it is 0, no rows were deleted, meaning the startup did not exist. This eliminates the need for a separate existence check.

### Step 3: Create the Categories Router

Create `src/routes/categories.ts`:

```typescript
import { Router, Request, Response } from 'express';
import db from '../db/index.js';
import { mapCategoryRow } from '../db/mappers.js';

const router = Router();

// GET /api/categories - List all categories
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  const categories = rows.map(mapCategoryRow);

  res.json({ data: categories });
});

// GET /api/categories/:id - Get a single category
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'ID must be a number',
      },
    });
    return;
  }

  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);

  if (!row) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Category with ID ' + id + ' not found',
      },
    });
    return;
  }

  res.json({ data: mapCategoryRow(row) });
});

export default router;
```

The categories router is read-only -- just GET endpoints. The pattern is identical to what we used for startups: prepare a statement, execute it, map the rows, return the response.

### Step 4: Mount the Categories Router

Update `src/index.ts` to include the new router:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createTables } from './db/schema.js';
import startupsRouter from './routes/startups.js';
import categoriesRouter from './routes/categories.js';

dotenv.config();

// Ensure tables exist
createTables();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(req.method + ' ' + req.url);
  next();
});

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/startups', startupsRouter);
app.use('/api/categories', categoriesRouter);

// Start the server
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});

export default app;
```

### Step 5: Clean Up the Old In-Memory Files

Now that we are using the database, the in-memory data store is no longer needed. You can delete `src/data/startups.ts` and the `src/data/` directory. The types in `src/types.ts` still describe the API response shape, so keep that file.

Your project structure should now look like this:

```
launchpad-api/
  src/
    db/
      index.ts       (database connection)
      schema.ts      (table creation)
      seed.ts        (seed script)
      mappers.ts     (row mapping functions)
    routes/
      startups.ts    (startup CRUD endpoints)
      categories.ts  (category endpoints)
    index.ts         (Express app setup)
    types.ts         (TypeScript interfaces)
    utils.ts         (slugify helper)
  .env
  .gitignore
  data.db
  package.json
  tsconfig.json
```

### Step 6: Seed and Test

Make sure the database is seeded:

```bash
npm run db:seed
```

Start the server:

```bash
npm run dev
```

Now test every endpoint with curl.

List all startups:

```bash
curl http://localhost:3000/api/startups | json_pp
```

You should see all six seeded startups, each with a `category` field containing the category name (from the JOIN) and a `categoryId` field containing the numeric foreign key.

Get a single startup:

```bash
curl http://localhost:3000/api/startups/1 | json_pp
```

Returns the CodeBrew startup with its category name.

Create a new startup:

```bash
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CloudPeak",
    "description": "Serverless deployment platform with automatic scaling",
    "categoryId": 8,
    "founder": "Jamie Liu",
    "website": "https://cloudpeak.dev",
    "fundingStage": "Seed",
    "fundingAmount": 3000000,
    "employeeCount": 15,
    "founded": 2025
  }' | json_pp
```

Notice we now send `categoryId` (the numeric ID) instead of a category string. The response includes the resolved category name from the JOIN. The startup gets an auto-generated ID and timestamps.

Restart the server and list startups again:

```bash
curl http://localhost:3000/api/startups | json_pp
```

The CloudPeak startup is still there. Data persists now.

Try creating a duplicate:

```bash
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CloudPeak",
    "description": "Another cloud platform",
    "categoryId": 8
  }' | json_pp
```

Returns a 409 Conflict because a startup with the slug "cloudpeak" already exists.

Update a startup:

```bash
curl -X PUT http://localhost:3000/api/startups/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CodeBrew",
    "description": "AI-powered code review and automated testing platform",
    "categoryId": 1,
    "founder": "Alex Chen",
    "website": "https://codebrew.dev",
    "fundingStage": "Series B",
    "fundingAmount": 20000000,
    "employeeCount": 80,
    "founded": 2024
  }' | json_pp
```

The response shows the updated fields and a new `updatedAt` timestamp.

Delete a startup:

```bash
curl -X DELETE http://localhost:3000/api/startups/7 -v
```

Returns 204 with no body. Try deleting it again to see the 404.

List categories:

```bash
curl http://localhost:3000/api/categories | json_pp
```

Returns all eight categories, sorted alphabetically.

Get a single category:

```bash
curl http://localhost:3000/api/categories/1 | json_pp
```

### Step 7: Understanding the Query Patterns

Let us look at the query patterns we used and why each one is appropriate.

For listing resources (GET all), we use `stmt.all()`:

```typescript
const rows = db.prepare('SELECT * FROM startups').all();
```

This returns an array of row objects. Even if there are no results, it returns an empty array -- never null or undefined.

For getting a single resource (GET one), we use `stmt.get()`:

```typescript
const row = db.prepare('SELECT * FROM startups WHERE id = ?').get(id);
```

This returns a single row object or `undefined`. We check for `undefined` and return 404.

For creating a resource (POST), we use `stmt.run()` and check `lastInsertRowid`:

```typescript
const result = db.prepare('INSERT INTO startups ...').run(...values);
const newRow = db.prepare('SELECT * FROM startups WHERE id = ?').get(result.lastInsertRowid);
```

The INSERT returns metadata (not the row itself), so we do a follow-up SELECT to get the complete row with server-generated values.

For updating a resource (PUT), we use `stmt.run()`:

```typescript
db.prepare('UPDATE startups SET ... WHERE id = ?').run(...values, id);
const updatedRow = db.prepare('SELECT * FROM startups WHERE id = ?').get(id);
```

Similar to INSERT, we do a follow-up SELECT to return the updated row.

For deleting a resource (DELETE), we use `stmt.run()` and check `changes`:

```typescript
const result = db.prepare('DELETE FROM startups WHERE id = ?').run(id);
if (result.changes === 0) { /* 404 */ }
```

No follow-up SELECT needed because we return 204 with no body.

## Comparing In-Memory vs Database Approaches

Here is a side-by-side comparison:

Finding all items:
- In-memory: return the array directly
- Database: `db.prepare('SELECT * FROM startups').all()`

Finding one item:
- In-memory: `startups.find(s => s.id === id)`
- Database: `db.prepare('SELECT * FROM startups WHERE id = ?').get(id)`

Creating an item:
- In-memory: push to array, manually assign ID and timestamps
- Database: INSERT with AUTOINCREMENT and DEFAULT datetime('now')

Updating an item:
- In-memory: find index, spread new values over old
- Database: UPDATE SET with WHERE clause

Deleting an item:
- In-memory: find index, splice from array
- Database: DELETE FROM with WHERE clause

Data persistence:
- In-memory: lost on server restart
- Database: persists in file on disk

Concurrent access:
- In-memory: only works within a single process
- Database: SQLite handles concurrent reads, serializes writes

The code changes are modest. The route structure, validation logic, and response format are identical. Only the data access layer changed. This is a good sign -- it means our API design was not coupled to the storage mechanism.

## Try It Yourself

1. Add a `GET /api/startups/slug/:slug` endpoint that finds a startup by its slug. Use a parameterized query: `SELECT s.*, c.name as category_name FROM startups s LEFT JOIN categories c ON s.category_id = c.id WHERE s.slug = ?`. Return 404 if no startup matches.

2. Add a `GET /api/categories/:id/startups` endpoint that returns all startups in a given category. First check that the category exists (404 if not), then query startups filtered by `category_id`. This nested route pattern is common in REST APIs for accessing related resources.

3. Modify the create and update endpoints to verify that the provided `categoryId` actually exists in the categories table before inserting or updating. If it does not exist, return a 400 error with a message like "Category with ID 99 not found". This is application-level validation on top of the database foreign key constraint.

4. Add an endpoint `GET /api/stats` that returns summary statistics: total number of startups, total number of categories, total funding amount across all startups, and the average employee count. Use SQL aggregate functions (COUNT, SUM, AVG).

## Key Takeaways

- Migrating from in-memory to database storage only changes the data access code, not the route structure or response format
- Use `stmt.all()` for listing, `stmt.get()` for single lookups, and `stmt.run()` for inserts, updates, and deletes
- `result.lastInsertRowid` gives you the ID of a newly created row
- `result.changes` tells you how many rows were affected by an UPDATE or DELETE
- Map database rows (snake_case) to API responses (camelCase) with explicit mapping functions
- LEFT JOINs let you include related data (like category names) in your responses
- Check for slug/name duplicates before INSERT or UPDATE to return meaningful 409 errors
- Always do a follow-up SELECT after INSERT or UPDATE to return the complete row with server-generated values

## Next Steps

Your API now has persistent storage, full CRUD operations, and a clean project structure. But we are still trusting clients to send valid data and doing only basic checks. In the next lesson, we will add proper input validation using Zod -- a TypeScript-first schema validation library that catches bad data before it reaches the database and gives users clear, actionable error messages.
