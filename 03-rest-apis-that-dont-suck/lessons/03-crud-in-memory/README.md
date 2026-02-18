# CRUD In Memory

Time to build real endpoints. In this lesson, you will implement the full set of CRUD operations for the startups resource using an in-memory array as your data store. This approach lets us focus entirely on Express routing and request handling without worrying about databases yet.

## What You'll Learn

- How to define TypeScript types for your API resources
- How to build all five CRUD endpoints (list, get, create, update, delete)
- How to use Express Router to organize routes into separate files
- How to read route parameters and request bodies
- How to return proper status codes for each operation
- How to test endpoints with curl

## Why Start with In-Memory Storage?

Building APIs in two phases -- first in-memory, then with a database -- is a proven approach for several reasons:

- You can test your endpoint design immediately without setting up any infrastructure
- You learn Express routing and request handling in isolation
- If your API design has problems, you discover them before investing time in database schemas
- The transition from arrays to database queries is straightforward because the route handlers stay mostly the same

The downside is obvious: when you restart the server, all data is lost. That is fine for development. We will add SQLite in Lesson 04.

## Concepts

### Express Router

As your API grows, putting every route in `src/index.ts` becomes unmanageable. Express Router lets you group related routes into separate files. Think of a Router as a mini Express app that handles a subset of your routes:

```typescript
// src/routes/startups.ts
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => { /* list all startups */ });
router.get('/:id', (req, res) => { /* get one startup */ });

export default router;
```

Then in your main file, you mount the router at a specific path:

```typescript
// src/index.ts
import startupsRouter from './routes/startups.js';

app.use('/api/startups', startupsRouter);
```

Now all routes defined in the startups router are prefixed with `/api/startups`. The `router.get('/')` handler responds to `GET /api/startups` and `router.get('/:id')` responds to `GET /api/startups/42`.

### Route Parameters

Express uses the colon syntax to define dynamic segments in URLs:

```typescript
router.get('/:id', (req, res) => {
  const id = req.params.id;  // always a string
});
```

The value of `req.params.id` is always a string. If the client requests `/api/startups/7`, then `req.params.id` is `"7"` (the string), not `7` (the number). You need to convert it yourself using `parseInt()` or `Number()`.

### Request Body

For POST and PUT requests, the client sends data in the request body. Thanks to the `express.json()` middleware we added in Lesson 01, this data is automatically parsed and available as `req.body`:

```typescript
router.post('/', (req, res) => {
  const { name, description, category } = req.body;
});
```

The request body is typed as `any` by default. Later in the course, we will use Zod to validate the body and get proper TypeScript types. For now, we will trust that the client sends the right shape.

## Step by Step

### Step 1: Define the Startup Type

Create a new file `src/types.ts` for our TypeScript interfaces:

```typescript
export interface Startup {
  id: number;
  name: string;
  slug: string;
  description: string;
  category: string;
  founder: string;
  website: string;
  fundingStage: string;
  fundingAmount: number;
  employeeCount: number;
  founded: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateStartupInput = Omit<
  Startup,
  'id' | 'slug' | 'createdAt' | 'updatedAt'
>;

export type UpdateStartupInput = Omit<
  Startup,
  'id' | 'slug' | 'createdAt' | 'updatedAt'
>;
```

The `Startup` interface defines the full shape of a startup as returned by the API. The `CreateStartupInput` and `UpdateStartupInput` types use TypeScript's `Omit` utility to exclude fields that the server generates automatically. The client never sends `id`, `slug`, `createdAt`, or `updatedAt` -- those are all server-managed.

### Step 2: Create the In-Memory Store

Create `src/data/startups.ts`:

```typescript
import { Startup } from '../types.js';

let nextId = 4;

export const startups: Startup[] = [
  {
    id: 1,
    name: 'CodeBrew',
    slug: 'codebrew',
    description: 'AI-powered code review platform that catches bugs before they reach production',
    category: 'Developer Tools',
    founder: 'Alex Chen',
    website: 'https://codebrew.dev',
    fundingStage: 'Series A',
    fundingAmount: 5000000,
    employeeCount: 25,
    founded: 2024,
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 2,
    name: 'GreenRoute',
    slug: 'greenroute',
    description: 'Sustainable logistics optimization for last-mile delivery',
    category: 'CleanTech',
    founder: 'Maria Santos',
    website: 'https://greenroute.eco',
    fundingStage: 'Seed',
    fundingAmount: 2000000,
    employeeCount: 12,
    founded: 2025,
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-02-01T14:30:00.000Z',
  },
  {
    id: 3,
    name: 'MediSync',
    slug: 'medisync',
    description: 'Real-time patient data synchronization across hospital systems',
    category: 'HealthTech',
    founder: 'James Okafor',
    website: 'https://medisync.health',
    fundingStage: 'Series B',
    fundingAmount: 15000000,
    employeeCount: 60,
    founded: 2023,
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-02-15T11:00:00.000Z',
  },
];

export function getNextId(): number {
  return nextId++;
}
```

We start with three sample startups so we have data to work with immediately. The `nextId` variable tracks the next available ID. The `getNextId()` function returns the current value and increments it, ensuring each new startup gets a unique ID.

Note the `.js` extension in the import path (`'../types.js'`). When using ESM with TypeScript, you must include the `.js` extension in import paths even though the actual file is `.ts`. TypeScript compiles `.ts` files to `.js`, and the import paths in the compiled output need to match the actual file extensions. This is one of the quirks of ESM in TypeScript.

### Step 3: Create a Slug Utility

Create `src/utils.ts`:

```typescript
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}
```

This function converts a string like "My Cool Startup" into "my-cool-startup". Slugs are URL-friendly identifiers that are easier to read than numeric IDs. The function:

1. Converts to lowercase
2. Removes leading/trailing whitespace
3. Removes special characters (keeping only word characters, spaces, and hyphens)
4. Replaces spaces and underscores with hyphens
5. Collapses multiple consecutive hyphens into one

### Step 4: Build the Startups Router

Create the directory and file `src/routes/startups.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { startups, getNextId } from '../data/startups.js';
import { slugify } from '../utils.js';

const router = Router();

// GET /api/startups - List all startups
router.get('/', (_req: Request, res: Response) => {
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

  const startup = startups.find((s) => s.id === id);

  if (!startup) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Startup with ID ' + id + ' not found',
      },
    });
    return;
  }

  res.json({ data: startup });
});

// POST /api/startups - Create a new startup
router.post('/', (req: Request, res: Response) => {
  const {
    name,
    description,
    category,
    founder,
    website,
    fundingStage,
    fundingAmount,
    employeeCount,
    founded,
  } = req.body;

  // Basic validation
  if (!name || !description || !category) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name, description, and category are required',
      },
    });
    return;
  }

  const now = new Date().toISOString();
  const newStartup = {
    id: getNextId(),
    name,
    slug: slugify(name),
    description,
    category,
    founder: founder || '',
    website: website || '',
    fundingStage: fundingStage || 'Pre-Seed',
    fundingAmount: fundingAmount || 0,
    employeeCount: employeeCount || 1,
    founded: founded || new Date().getFullYear(),
    createdAt: now,
    updatedAt: now,
  };

  startups.push(newStartup);

  res.status(201).json({ data: newStartup });
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

  const index = startups.findIndex((s) => s.id === id);

  if (index === -1) {
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
    category,
    founder,
    website,
    fundingStage,
    fundingAmount,
    employeeCount,
    founded,
  } = req.body;

  if (!name || !description || !category) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name, description, and category are required',
      },
    });
    return;
  }

  const existing = startups[index];
  const updatedStartup = {
    ...existing,
    name,
    slug: slugify(name),
    description,
    category,
    founder: founder || existing.founder,
    website: website || existing.website,
    fundingStage: fundingStage || existing.fundingStage,
    fundingAmount: fundingAmount ?? existing.fundingAmount,
    employeeCount: employeeCount ?? existing.employeeCount,
    founded: founded ?? existing.founded,
    updatedAt: new Date().toISOString(),
  };

  startups[index] = updatedStartup;

  res.json({ data: updatedStartup });
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

  const index = startups.findIndex((s) => s.id === id);

  if (index === -1) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Startup with ID ' + id + ' not found',
      },
    });
    return;
  }

  startups.splice(index, 1);

  res.status(204).send();
});

export default router;
```

Let us walk through each endpoint in detail.

The list endpoint (`GET /`) is the simplest. It returns all startups wrapped in a data envelope. No parameters, no filtering, no pagination yet -- just return everything. We will add pagination in Lesson 07.

The get-one endpoint (`GET /:id`) first parses the ID from a string to a number. If the ID is not a valid number (for example, someone requests `/api/startups/abc`), we return 400. Then we search the array for a matching startup. If none is found, we return 404. Otherwise, we return the startup wrapped in the data envelope.

The create endpoint (`POST /`) destructures the expected fields from `req.body`. We do basic validation -- checking that the three required fields (name, description, category) are present. For optional fields, we provide defaults. The server generates the id, slug, createdAt, and updatedAt fields. After pushing the new startup to the array, we return 201 with the full startup object.

The update endpoint (`PUT /:id`) combines the ID parsing from the get endpoint with the body reading from the create endpoint. It finds the existing startup, merges the new data with preserved values for optional fields, updates the `updatedAt` timestamp, and returns the updated object. Notice we use the nullish coalescing operator (`??`) for numeric fields. This is because `||` would treat `0` as falsy, meaning you could never set `fundingAmount` to 0. The `??` operator only falls back when the value is `null` or `undefined`.

The delete endpoint (`DELETE /:id`) finds the startup, removes it from the array with `splice`, and returns 204 with no body. The `.send()` call without arguments sends an empty response.

### Step 5: Mount the Router

Update `src/index.ts` to use the new router:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import startupsRouter from './routes/startups.js';

dotenv.config();

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

// Start the server
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});

export default app;
```

The key line is `app.use('/api/startups', startupsRouter)`. This tells Express: "For any request that starts with /api/startups, hand it off to the startups router." The router then matches against its own routes, with `/api/startups` already stripped from the path.

### Step 6: Create the Directory Structure

Your project should now look like this:

```
launchpad-api/
  src/
    data/
      startups.ts
    routes/
      startups.ts
    index.ts
    types.ts
    utils.ts
  .env
  .gitignore
  package.json
  tsconfig.json
```

### Step 7: Test with curl

Start the server:

```bash
npm run dev
```

Now test each endpoint in a separate terminal.

List all startups:

```bash
curl http://localhost:3000/api/startups | json_pp
```

The `json_pp` command (available on macOS and most Linux systems) pretty-prints the JSON output. On Windows, you can pipe to `python -m json.tool` instead.

You should see all three sample startups wrapped in the data envelope.

Get a single startup:

```bash
curl http://localhost:3000/api/startups/1 | json_pp
```

Returns the CodeBrew startup.

Try a non-existent ID:

```bash
curl http://localhost:3000/api/startups/999 | json_pp
```

Returns a 404 error:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Startup with ID 999 not found"
  }
}
```

Create a new startup:

```bash
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DataVault",
    "description": "Secure cloud data management for enterprises",
    "category": "Cloud Infrastructure",
    "founder": "Sarah Kim",
    "website": "https://datavault.io",
    "fundingStage": "Seed",
    "fundingAmount": 1500000,
    "employeeCount": 8,
    "founded": 2025
  }' | json_pp
```

Returns the created startup with a 201 status and a server-generated ID, slug, and timestamps.

Verify it was added by listing all startups again:

```bash
curl http://localhost:3000/api/startups | json_pp
```

You should now see four startups.

Update a startup:

```bash
curl -X PUT http://localhost:3000/api/startups/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CodeBrew",
    "description": "AI-powered code review and testing platform",
    "category": "Developer Tools",
    "founder": "Alex Chen",
    "website": "https://codebrew.dev",
    "fundingStage": "Series B",
    "fundingAmount": 20000000,
    "employeeCount": 80,
    "founded": 2024
  }' | json_pp
```

Returns the updated startup with a new `updatedAt` timestamp.

Delete a startup:

```bash
curl -X DELETE http://localhost:3000/api/startups/4 -v
```

The `-v` flag shows verbose output including headers. You should see a `204 No Content` response with an empty body.

Try deleting the same startup again:

```bash
curl -X DELETE http://localhost:3000/api/startups/4 -v
```

This time you get a 404 because the startup no longer exists.

Test validation by sending a request without required fields:

```bash
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{"website": "https://example.com"}' | json_pp
```

Returns a 400 error telling you that name, description, and category are required.

### Step 8: Understanding the Response Pattern

Notice how every response follows a consistent pattern:

Success responses always have a `data` property:
```json
{ "data": { ... } }
{ "data": [ ... ] }
```

Error responses always have an `error` property with `code` and `message`:
```json
{ "error": { "code": "NOT_FOUND", "message": "..." } }
```

This consistency is a gift to frontend developers. They can write a single response handler:

```typescript
const response = await fetch('/api/startups');
const json = await response.json();

if (json.error) {
  // handle error using json.error.code and json.error.message
} else {
  // use json.data
}
```

No guessing, no special cases. Every endpoint behaves the same way.

## How In-Memory Storage Works (and Its Limitations)

The array we created in `src/data/startups.ts` lives in the server process's memory. This means:

- Reads are instant (no network calls, no disk I/O)
- Writes are instant (just pushing to or splicing from an array)
- All data is lost when the server restarts
- Data is not shared between server instances (if you run two copies)
- Memory usage grows with data (not a problem for development, but terrible for production)

For development and prototyping, in-memory storage is perfect. You can rapidly iterate on your API design and test different approaches without worrying about database migrations. Once the API shape is locked down, migrating to a real database (which we do in Lessons 04 and 05) is straightforward because the route handlers only need small changes.

## Try It Yourself

1. Add a `GET /api/startups/slug/:slug` endpoint that finds a startup by its slug instead of its ID. For example, `GET /api/startups/slug/codebrew` should return the CodeBrew startup. Return 404 if no startup matches the given slug.

2. Add validation to the update endpoint that prevents changing a startup's name to one that already exists (checking against other startups in the array). If a conflict is detected, return a 409 status code with an appropriate error message.

3. Add a `GET /api/startups?category=CleanTech` endpoint that filters startups by category. Hint: check `req.query.category` and use the array `filter` method. If no category query parameter is provided, return all startups as before.

## Key Takeaways

- Express Router lets you organize routes into separate files and mount them at specific paths
- Route parameters (`:id`) are always strings -- parse them with `parseInt()` when you need numbers
- `req.body` contains the parsed JSON request body (requires `express.json()` middleware)
- Return 201 for successful creation, 204 for successful deletion, 404 when a resource is not found
- Use the nullish coalescing operator (`??`) for numeric fields to avoid treating 0 as falsy
- Consistent response envelopes (`{ data }` for success, `{ error }` for failures) make life easier for API consumers
- In-memory storage is great for prototyping but does not persist data across server restarts

## Next Steps

Our API works, but it has a fatal flaw: restart the server and all your data vanishes. In the next lesson, we will set up SQLite -- a file-based database that is perfect for development and small production workloads. We will create tables, write a seed script, and prepare everything for the database-backed CRUD we build in Lesson 05.
