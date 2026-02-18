# Automated Tests with Vitest and Supertest

Manual testing is great for exploration, but it does not scale. Every time you change a line of code, you would need to re-run dozens of curl commands to make sure nothing broke. Automated tests solve this. You write them once, and they run in seconds every time you push code.

In this lesson you will set up Vitest with Supertest to write integration tests for the LaunchPad API. By the end, you will have a comprehensive test suite that covers CRUD operations, validation, pagination, and error handling.

## What You Will Learn

- The testing pyramid: unit, integration, and end-to-end tests
- Setting up Vitest for a TypeScript Express project
- Using Supertest to make HTTP requests against your app
- Creating a test database setup with isolated state
- Writing integration tests for every CRUD endpoint
- Testing validation errors and edge cases
- Testing pagination and search
- Running tests and reading coverage reports

## Concepts

### The Testing Pyramid

The testing pyramid has three layers:

Unit tests are at the base. They test individual functions in isolation. They are fast, cheap, and you should have the most of them. Example: testing a utility function that formats dates.

Integration tests are in the middle. They test how multiple parts work together. For an API, this means testing that a request flows through the router, hits the database, and returns the correct response. This is what we will focus on.

End-to-end (E2E) tests are at the top. They test the entire system from the user's perspective, often including a real browser. They are slow, brittle, and expensive. You should have the fewest of them.

For an API, integration tests give you the best return on investment. They test the real HTTP layer, real middleware, and real database queries without the overhead of E2E tests.

### Vitest

Vitest is a test runner built on top of Vite. It is fast, has excellent TypeScript support, and is compatible with the Jest API (so if you know Jest, you already know Vitest). We chose Vitest because:

- It handles TypeScript and ESM natively -- no transpilation config needed
- It is fast thanks to Vite's architecture
- It has built-in coverage reporting
- The watch mode is excellent for development

### Supertest

Supertest is a library that lets you make HTTP requests against an Express app without starting a real server. You pass it your Express app instance and it handles the rest. This is perfect for testing because:

- No port conflicts (no server listening on a port)
- No network latency
- Tests are isolated and fast
- You get a clean API for asserting status codes, headers, and body content

## Step by Step

### Step 1: Configure Vitest

Vitest needs to know about your TypeScript setup. Create a Vitest config file at the project root.

Create `vitest.config.ts`:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/db/seed.ts'],
    },
  },
});
```

Let us break this down:

- `globals: true` makes `describe`, `it`, `expect`, and `beforeAll` available globally without importing them.
- `environment: 'node'` tells Vitest to run in a Node.js environment (not a browser).
- `include` tells Vitest where to find test files.
- `setupFiles` points to a file that runs before all tests. We will use this to set up the test database.
- `coverage` configures code coverage reporting. We exclude `index.ts` (the server startup) and `seed.ts` (the seed script) because they are not testable in isolation.

### Step 2: Restructure the App for Testing

To test the Express app with Supertest, we need to separate the app creation from the server startup. Right now, `src/index.ts` creates the app and immediately calls `app.listen()`. We need to export the app without starting it.

Create `src/app.ts`:

```ts
// src/app.ts
import express from 'express';
import cors from 'cors';
import startupsRouter from './routes/startups.js';
import categoriesRouter from './routes/categories.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/startups', startupsRouter);
app.use('/api/categories', categoriesRouter);

// Global error handler -- must be last
app.use(errorHandler);

export default app;
```

Update `src/index.ts` to import from app.ts:

```ts
// src/index.ts
import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});
```

This separation is a common pattern. The `app.ts` file creates and configures the Express app. The `index.ts` file is the entry point that starts the server. Tests import from `app.ts` and never start a real server.

If you do not have a categories router yet, create a simple one at `src/routes/categories.ts`:

```ts
// src/routes/categories.ts
import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

router.get('/', (_req, res) => {
  const categories = db.prepare('SELECT * FROM categories').all();
  res.json({ data: categories });
});

router.get('/:id', (req, res) => {
  const category = db
    .prepare('SELECT * FROM categories WHERE id = ?')
    .get(req.params.id);

  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  res.json({ data: category });
});

export default router;
```

### Step 3: Create the Test Setup

The test setup file initializes a fresh database for each test run. We use an in-memory SQLite database so tests are fast and isolated.

Create `tests/setup.ts`:

```ts
// tests/setup.ts
import Database from 'better-sqlite3';
import { beforeAll, afterAll } from 'vitest';

// Create an in-memory database for testing
const testDb = new Database(':memory:');

// Create tables
beforeAll(() => {
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed test data
  testDb.exec(`
    INSERT INTO categories (name, description) VALUES
      ('AI/ML', 'Artificial Intelligence and Machine Learning'),
      ('DevTools', 'Developer Tools and Infrastructure'),
      ('SaaS', 'Software as a Service');

    INSERT INTO startups (name, tagline, description, url, category_id, upvotes) VALUES
      ('TechFlow AI', 'AI-powered workflow automation for modern teams', 'TechFlow AI is a platform that uses artificial intelligence to automate repetitive workflows across your organization.', 'https://techflow.ai', 1, 42),
      ('CodeBuddy', 'Your AI pair programmer that actually understands context and intent', 'CodeBuddy is an AI coding assistant that integrates with your IDE and understands your entire codebase for better suggestions.', 'https://codebuddy.dev', 1, 28),
      ('ShipFast', 'Deploy to production in under sixty seconds with zero configuration', 'ShipFast handles building, testing, and deploying your application automatically. Just push to main and it handles the rest.', 'https://shipfast.io', 2, 15),
      ('DataPipe', 'Real-time data pipelines without writing any infrastructure code', 'DataPipe lets you build data pipelines visually. Connect sources, transform data, and route it to destinations without code.', 'https://datapipe.com', 2, 33),
      ('MetricHub', 'Product analytics that developers actually want to use every day', 'MetricHub provides simple and powerful product analytics with a developer-first approach and SQL-based querying interface.', 'https://metrichub.io', 3, 19);
  `);
});

afterAll(() => {
  testDb.close();
});

export { testDb };
```

Now we need a way to make the routes use our test database instead of the real one. The cleanest approach is to make the database module swappable.

Update `src/db/index.ts` to support overriding:

```ts
// src/db/index.ts
import Database from 'better-sqlite3';

let db: Database.Database;

if (process.env.NODE_ENV === 'test') {
  // In test mode, the database will be set by the test setup
  db = null as any;
} else {
  db = new Database('launchpad.db');

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function setDb(newDb: Database.Database) {
  db = newDb;
}

export { db };
```

Then update `tests/setup.ts` to inject the test database:

```ts
// tests/setup.ts
import Database from 'better-sqlite3';
import { beforeAll, afterAll } from 'vitest';
import { setDb } from '../src/db/index.js';

// Create an in-memory database for testing
const testDb = new Database(':memory:');

beforeAll(() => {
  // Inject the test database into the app
  setDb(testDb);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed test data
  testDb.exec(`
    INSERT INTO categories (name, description) VALUES
      ('AI/ML', 'Artificial Intelligence and Machine Learning'),
      ('DevTools', 'Developer Tools and Infrastructure'),
      ('SaaS', 'Software as a Service');

    INSERT INTO startups (name, tagline, description, url, category_id, upvotes) VALUES
      ('TechFlow AI', 'AI-powered workflow automation for modern teams', 'TechFlow AI is a platform that uses artificial intelligence to automate repetitive workflows across your organization.', 'https://techflow.ai', 1, 42),
      ('CodeBuddy', 'Your AI pair programmer that actually understands context and intent', 'CodeBuddy is an AI coding assistant that integrates with your IDE and understands your entire codebase for better suggestions.', 'https://codebuddy.dev', 1, 28),
      ('ShipFast', 'Deploy to production in under sixty seconds with zero configuration', 'ShipFast handles building, testing, and deploying your application automatically. Just push to main and it handles the rest.', 'https://shipfast.io', 2, 15),
      ('DataPipe', 'Real-time data pipelines without writing any infrastructure code', 'DataPipe lets you build data pipelines visually. Connect sources, transform data, and route it to destinations without code.', 'https://datapipe.com', 2, 33),
      ('MetricHub', 'Product analytics that developers actually want to use every day', 'MetricHub provides simple and powerful product analytics with a developer-first approach and SQL-based querying interface.', 'https://metrichub.io', 3, 19);
  `);
});

afterAll(() => {
  testDb.close();
});

export { testDb };
```

### Step 4: Write Startup Integration Tests

Now write the actual tests. This is the main test file.

Create `tests/startups.test.ts`:

```ts
// tests/startups.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /api/startups', () => {
  it('should return a list of startups', async () => {
    const res = await request(app).get('/api/startups');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('should include pagination metadata', async () => {
    const res = await request(app).get('/api/startups');

    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(10);
    expect(res.body.pagination.total).toBeGreaterThan(0);
    expect(res.body.pagination.totalPages).toBeGreaterThan(0);
  });

  it('should respect the limit parameter', async () => {
    const res = await request(app).get('/api/startups?limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination.limit).toBe(2);
  });

  it('should respect the page parameter', async () => {
    const page1 = await request(app).get('/api/startups?limit=2&page=1');
    const page2 = await request(app).get('/api/startups?limit=2&page=2');

    expect(page1.body.data[0].id).not.toBe(page2.body.data[0]?.id);
  });

  it('should return empty data for a page beyond results', async () => {
    const res = await request(app).get('/api/startups?page=999');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it('should sort by name ascending', async () => {
    const res = await request(app).get(
      '/api/startups?sort=name&order=asc'
    );

    const names = res.body.data.map((s: any) => s.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('should sort by name descending', async () => {
    const res = await request(app).get(
      '/api/startups?sort=name&order=desc'
    );

    const names = res.body.data.map((s: any) => s.name);
    const sorted = [...names].sort().reverse();
    expect(names).toEqual(sorted);
  });

  it('should filter by category', async () => {
    const res = await request(app).get('/api/startups?category=1');

    expect(res.status).toBe(200);
    res.body.data.forEach((startup: any) => {
      expect(startup.category_id).toBe(1);
    });
  });

  it('should search by name', async () => {
    const res = await request(app).get('/api/startups?search=TechFlow');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toContain('TechFlow');
  });

  it('should search by tagline', async () => {
    const res = await request(app).get('/api/startups?search=workflow');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('should return 400 for invalid page', async () => {
    const res = await request(app).get('/api/startups?page=-1');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return 400 for invalid sort field', async () => {
    const res = await request(app).get('/api/startups?sort=password');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return 400 for limit exceeding maximum', async () => {
    const res = await request(app).get('/api/startups?limit=101');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('GET /api/startups/:id', () => {
  it('should return a single startup', async () => {
    const res = await request(app).get('/api/startups/1');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.name).toBe('TechFlow AI');
  });

  it('should include the category name', async () => {
    const res = await request(app).get('/api/startups/1');

    expect(res.body.data.category_name).toBeDefined();
  });

  it('should return 404 for non-existent startup', async () => {
    const res = await request(app).get('/api/startups/99999');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });
});

describe('POST /api/startups', () => {
  const validStartup = {
    name: 'NewStartup',
    tagline: 'A brand new startup with an exciting tagline',
    description:
      'This is a long enough description that passes the fifty character minimum requirement for the Zod validation schema we defined.',
    url: 'https://newstartup.com',
    category_id: 1,
  };

  it('should create a new startup', async () => {
    const res = await request(app)
      .post('/api/startups')
      .send(validStartup);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('NewStartup');
    expect(res.body.data.id).toBeDefined();
  });

  it('should return 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/startups')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toBeInstanceOf(Array);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('should return field-level errors for invalid data', async () => {
    const res = await request(app)
      .post('/api/startups')
      .send({
        name: 'X',
        tagline: 'short',
        description: 'short',
        url: 'not-a-url',
        category_id: -1,
      });

    expect(res.status).toBe(400);

    const fields = res.body.details.map((d: any) => d.field);
    expect(fields).toContain('name');
    expect(fields).toContain('tagline');
    expect(fields).toContain('description');
    expect(fields).toContain('url');
    expect(fields).toContain('category_id');
  });

  it('should return error when name is missing', async () => {
    const { name, ...withoutName } = validStartup;
    const res = await request(app)
      .post('/api/startups')
      .send(withoutName);

    expect(res.status).toBe(400);
    const nameError = res.body.details.find((d: any) => d.field === 'name');
    expect(nameError).toBeDefined();
  });

  it('should trim whitespace from string fields', async () => {
    const res = await request(app)
      .post('/api/startups')
      .send({
        ...validStartup,
        name: '  SpacedName  ',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('SpacedName');
  });
});

describe('PUT /api/startups/:id', () => {
  it('should update an existing startup', async () => {
    const res = await request(app)
      .put('/api/startups/1')
      .send({
        tagline: 'An updated tagline that is long enough to pass validation',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.tagline).toBe(
      'An updated tagline that is long enough to pass validation'
    );
  });

  it('should allow partial updates', async () => {
    const before = await request(app).get('/api/startups/1');
    const originalName = before.body.data.name;

    await request(app)
      .put('/api/startups/1')
      .send({
        tagline: 'Only updating the tagline field and nothing else',
      });

    const after = await request(app).get('/api/startups/1');
    expect(after.body.data.name).toBe(originalName);
  });

  it('should return 404 for non-existent startup', async () => {
    const res = await request(app)
      .put('/api/startups/99999')
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid update data', async () => {
    const res = await request(app)
      .put('/api/startups/1')
      .send({ name: 'X' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('DELETE /api/startups/:id', () => {
  it('should delete an existing startup', async () => {
    // First create a startup to delete
    const created = await request(app)
      .post('/api/startups')
      .send({
        name: 'ToDelete',
        tagline: 'This startup will be deleted in the next step',
        description:
          'A temporary startup created specifically for testing the delete endpoint in our integration tests.',
        url: 'https://todelete.com',
        category_id: 1,
      });

    const id = created.body.data.id;

    const res = await request(app).delete('/api/startups/' + id);
    expect(res.status).toBe(204);

    // Verify it is gone
    const verify = await request(app).get('/api/startups/' + id);
    expect(verify.status).toBe(404);
  });

  it('should return 404 for non-existent startup', async () => {
    const res = await request(app).delete('/api/startups/99999');

    expect(res.status).toBe(404);
  });
});

describe('GET /health', () => {
  it('should return ok status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
```

Let us highlight a few patterns in these tests.

Each `describe` block groups tests for one endpoint. Within each group, you test the happy path first, then error cases.

The POST tests use a `validStartup` object as a base. Individual tests modify or omit fields from this base to test specific scenarios.

The DELETE test creates its own startup before deleting it. This makes the test self-contained -- it does not depend on data from other tests. The only caveat is that our test database seeds data in `beforeAll`, so tests that modify data can affect each other. For a more robust setup, you would reset the database between each test with `beforeEach`.

The destructuring trick `const { name, ...withoutName } = validStartup` is a clean way to create test data with one field removed.

### Step 5: Write Category Tests

Create `tests/categories.test.ts`:

```ts
// tests/categories.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /api/categories', () => {
  it('should return a list of categories', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(3);
  });

  it('should include category names', async () => {
    const res = await request(app).get('/api/categories');

    const names = res.body.data.map((c: any) => c.name);
    expect(names).toContain('AI/ML');
    expect(names).toContain('DevTools');
    expect(names).toContain('SaaS');
  });
});

describe('GET /api/categories/:id', () => {
  it('should return a single category', async () => {
    const res = await request(app).get('/api/categories/1');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.name).toBe('AI/ML');
  });

  it('should return 404 for non-existent category', async () => {
    const res = await request(app).get('/api/categories/999');

    expect(res.status).toBe(404);
  });
});
```

### Step 6: Update package.json Scripts

Make sure your test script uses the right environment. Update `package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "NODE_ENV=test vitest run",
    "test:watch": "NODE_ENV=test vitest",
    "test:coverage": "NODE_ENV=test vitest run --coverage"
  }
}
```

The `NODE_ENV=test` environment variable tells the database module to expect the test database injection. The `vitest run` command runs tests once and exits (good for CI). The `vitest` command (without `run`) starts watch mode.

### Step 7: Run the Tests

Run all tests:

```bash
npm test
```

You should see output like this:

```
 ✓ tests/startups.test.ts (21 tests) 45ms
 ✓ tests/categories.test.ts (4 tests) 12ms

 Test Files  2 passed (2)
      Tests  25 passed (25)
   Start at  10:45:00
   Duration  1.23s
```

All 25 tests should pass. If any fail, read the error message carefully. The most common issues are:

- Database not being injected properly (check the `NODE_ENV` and `setDb` call)
- Test data not matching expectations (check the seed data in setup.ts)
- Routes not matching the expected paths (check your router registrations)

### Step 8: Run with Coverage

```bash
npm run test:coverage
```

This generates a coverage report showing which lines, branches, and functions are covered by tests:

```
 % Coverage report from v8
-----------------------|---------|----------|---------|---------|
File                   | % Stmts | % Branch | % Funcs | % Lines |
-----------------------|---------|----------|---------|---------|
All files              |   85.71 |    78.57 |   90.00 |   85.71 |
 src/errors.ts         |  100.00 |   100.00 |  100.00 |  100.00 |
 src/middleware/        |   90.00 |    80.00 |  100.00 |   90.00 |
 src/routes/startups.ts|   88.00 |    75.00 |  100.00 |   88.00 |
 src/schemas/startup.ts|  100.00 |   100.00 |  100.00 |  100.00 |
-----------------------|---------|----------|---------|---------|
```

Coverage tells you which parts of your code are exercised by tests. Aim for 80% or higher on important files, but do not obsess over 100%. Some code paths (like the generic 500 error handler) are hard to trigger in tests and that is okay.

### Step 9: Watch Mode for Development

During development, use watch mode:

```bash
npm run test:watch
```

Vitest watches your files and re-runs affected tests when you save. This gives you instant feedback as you write code. It is one of the best developer experience improvements you can make.

## Testing Patterns to Know

### Arrange, Act, Assert

Every test follows this pattern:

1. Arrange: Set up the data and conditions
2. Act: Perform the action being tested
3. Assert: Verify the result

```ts
it('should create a new startup', async () => {
  // Arrange
  const input = { name: 'Test', /* ... */ };

  // Act
  const res = await request(app).post('/api/startups').send(input);

  // Assert
  expect(res.status).toBe(201);
  expect(res.body.data.name).toBe('Test');
});
```

### Test Isolation

Each test should be independent. It should not depend on the order of other tests or the side effects of previous tests. In our setup, we seed data once in `beforeAll`. For better isolation, you could use `beforeEach` to reset the database:

```ts
beforeEach(() => {
  testDb.exec('DELETE FROM startups');
  testDb.exec('DELETE FROM categories');
  // Re-seed...
});
```

This is slower but guarantees isolation. Choose based on your needs.

### Testing Error Responses

Always test the shape of error responses, not just the status code:

```ts
it('should return field-level errors', async () => {
  const res = await request(app)
    .post('/api/startups')
    .send({});

  expect(res.status).toBe(400);
  expect(res.body.error).toBe('Validation failed');
  expect(res.body.details).toBeInstanceOf(Array);

  // Check that specific fields are called out
  const fields = res.body.details.map((d: any) => d.field);
  expect(fields).toContain('name');
});
```

## File Summary

Here is every file you created or modified in this lesson:

- `vitest.config.ts` -- Vitest configuration with setup file and coverage
- `src/app.ts` -- Express app creation separated from server startup
- `src/index.ts` -- Updated to import from app.ts
- `src/db/index.ts` -- Added setDb function for test database injection
- `src/routes/categories.ts` -- Simple categories router (if not already created)
- `tests/setup.ts` -- Test database setup with in-memory SQLite and seed data
- `tests/startups.test.ts` -- 21 integration tests for startup endpoints
- `tests/categories.test.ts` -- 4 integration tests for category endpoints
- `package.json` -- Added test:watch and test:coverage scripts

## Key Takeaways

- Separate your Express app from the server startup so tests can import the app without starting a listener.
- Use an in-memory SQLite database for tests. It is fast and each test run starts fresh.
- Integration tests are the sweet spot for APIs. They test the full request-response cycle without the overhead of E2E tests.
- Use Supertest to make HTTP requests against your Express app without running a real server.
- Test both happy paths and error paths. Validation errors, 404s, and edge cases are just as important as success cases.
- Coverage reports show you what is tested and what is not. Aim for 80% or higher on business logic.
- Watch mode gives you instant feedback during development.

## Exercises

1. Add a `beforeEach` that resets and re-seeds the database. Verify that tests still pass and are truly isolated from each other.

2. Write tests for the PUT endpoint that verify the `updated_at` timestamp changes after an update.

3. Add a test that creates 15 startups, then verifies pagination works correctly with `limit=5` across 3 pages.

4. Write tests for the sort-by-upvotes functionality. Create startups with known upvote counts and verify the sort order.

5. Set up a GitHub Actions workflow that runs `npm test` on every push. Create a `.github/workflows/test.yml` file.

## Next Lesson

You have manual tests and automated tests. In Lesson 10, you will document your API so other developers (and your future self) know exactly how to use it. You will create API documentation, explore the OpenAPI specification format, and wrap up the course.
