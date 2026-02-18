# SQLite Setup

Your API works, but every time you restart the server, your data disappears. Time to fix that. In this lesson, you will set up SQLite as your database using the better-sqlite3 library, design your tables, and write a seed script that populates the database with sample data.

## What You'll Learn

- Why SQLite is an excellent choice for API development
- How to install and configure better-sqlite3
- How to create a database connection module
- How to design and create tables with SQL
- How to write a seed script that populates sample data
- What prepared statements are and why they prevent SQL injection
- How to inspect your database from the command line

## Why SQLite?

Most API tutorials jump straight to PostgreSQL or MySQL. Those are great databases, but they require you to install a database server, manage connections, handle networking, and deal with configuration. That is a lot of overhead when you are learning API development.

SQLite is different. It is a file-based database -- your entire database lives in a single file on disk. There is no server to install, no ports to configure, no background processes to manage. You just point your code at a file and start querying.

Here is what makes SQLite special:

- Zero configuration: no server, no setup, no user accounts
- Single file: the entire database is one file you can copy, move, or delete
- Fast: for read-heavy workloads with moderate write volumes, SQLite is remarkably quick
- Reliable: SQLite is the most widely deployed database in the world (it runs on every smartphone)
- Full SQL support: joins, subqueries, indexes, transactions -- it is all there

SQLite is not the right choice for every application. If you need multiple servers writing to the same database simultaneously, you need PostgreSQL or MySQL. But for development, prototyping, and many production use cases (especially read-heavy APIs), SQLite is more than enough.

For the LaunchPad API, SQLite is the perfect fit. We get persistent storage with zero infrastructure overhead.

## Concepts

### better-sqlite3 vs sqlite3

There are two popular SQLite libraries for Node.js:

- sqlite3: asynchronous, callback-based API. Older and more widely used.
- better-sqlite3: synchronous API. Faster, simpler, and more predictable.

We are using better-sqlite3 because:

1. The synchronous API is easier to understand -- no callbacks, no promises, no async/await needed for database calls
2. It is significantly faster than the async sqlite3 package (10-20x for many operations)
3. It provides transaction support with a simple API
4. It works perfectly with Express's synchronous route handlers

The synchronous nature might seem like a problem -- would it not block the event loop? For SQLite, synchronous operations complete in microseconds because the database is local. There is no network round-trip. The overhead of wrapping every call in a Promise would actually make things slower.

### SQL Basics

If you have not used SQL before, here is a quick primer on the statements we will use:

CREATE TABLE defines a new table:

```sql
CREATE TABLE IF NOT EXISTS startups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);
```

- INTEGER PRIMARY KEY AUTOINCREMENT: auto-generated numeric ID
- TEXT NOT NULL: a required text field
- UNIQUE: no two rows can have the same value in this column
- IF NOT EXISTS: only create the table if it does not already exist (safe to run multiple times)

INSERT adds a new row:

```sql
INSERT INTO startups (name, slug) VALUES ('CodeBrew', 'codebrew');
```

SELECT retrieves data:

```sql
SELECT * FROM startups;
SELECT * FROM startups WHERE id = 1;
```

UPDATE modifies existing rows:

```sql
UPDATE startups SET name = 'CodeBrew 2.0' WHERE id = 1;
```

DELETE removes rows:

```sql
DELETE FROM startups WHERE id = 1;
```

### Prepared Statements

A prepared statement is a pre-compiled SQL template where you use placeholders instead of directly inserting values:

```typescript
// Dangerous - DO NOT do this
const name = req.body.name;
db.exec('INSERT INTO startups (name) VALUES (\'' + name + '\')');

// Safe - use prepared statements
const stmt = db.prepare('INSERT INTO startups (name) VALUES (?)');
stmt.run(name);
```

The first approach is vulnerable to SQL injection. If someone sends a name like `'); DROP TABLE startups; --`, the concatenated SQL would destroy your table. The second approach treats the placeholder value as data, never as SQL code, making injection impossible.

better-sqlite3 makes prepared statements the default way to interact with the database. Every query you write will use `?` placeholders.

## Step by Step

### Step 1: Install Dependencies

If you have not already installed better-sqlite3, do it now:

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

better-sqlite3 is a native module, meaning it includes compiled C code that interfaces directly with the SQLite engine. The installation process compiles this native code for your operating system. If you see warnings about node-gyp during installation, that is normal.

### Step 2: Create the Database Connection

Create the directory and file `src/db/index.ts`:

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '../../data.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Enable foreign keys (SQLite has them disabled by default)
db.pragma('foreign_keys = ON');

export default db;
```

Let us break this down.

The first few lines deal with ESM path resolution. In CommonJS, you have `__dirname` available globally. In ESM, you do not -- you have to derive it from `import.meta.url`. The `fileURLToPath` function converts the module URL to a file path, and `path.dirname` extracts the directory.

`process.env.DATABASE_URL || path.join(...)` lets you override the database location with an environment variable. The default puts the database file at the project root as `data.db`.

`new Database(DB_PATH)` creates (or opens) the SQLite database file. If the file does not exist, better-sqlite3 creates it automatically.

The two `pragma` calls configure SQLite behavior:

- WAL mode (Write-Ahead Logging) improves performance when you have concurrent reads and writes. Instead of locking the entire database for writes, WAL lets readers continue while a write is in progress.
- Foreign keys are disabled by default in SQLite for historical reasons. Enabling them ensures that your FOREIGN KEY constraints are actually enforced.

### Step 3: Create the Tables

Create `src/db/schema.ts`:

```typescript
import db from './index.js';

export function createTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'founder',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS startups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      category_id INTEGER,
      founder TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      funding_stage TEXT NOT NULL DEFAULT 'Pre-Seed',
      funding_amount INTEGER NOT NULL DEFAULT 0,
      employee_count INTEGER NOT NULL DEFAULT 1,
      founded INTEGER NOT NULL DEFAULT 2025,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);
}
```

There are several design decisions worth noting:

Column naming convention: SQL traditionally uses snake_case (funding_amount), while JavaScript uses camelCase (fundingAmount). We will use snake_case in the database and convert to camelCase in our TypeScript code when reading results.

The `categories` table is simple -- just an ID, name, slug, and description. The UNIQUE constraint on both name and slug ensures no duplicates.

The `users` table stores basic user information. The email field has a UNIQUE constraint, which is how we will detect duplicate registrations and return 409 errors.

The `startups` table is the most complex. It has a `category_id` foreign key that references the categories table. This replaces the simple category string we used in the in-memory version. The `FOREIGN KEY` constraint ensures that every startup points to a valid category.

The `DEFAULT (datetime('now'))` expressions tell SQLite to use the current timestamp when a row is inserted without specifying those fields. The parentheses around `datetime('now')` make it an expression that SQLite evaluates at insert time, rather than a fixed string.

`db.exec()` runs raw SQL that does not return results. It is perfect for DDL statements like CREATE TABLE.

### Step 4: Create the Seed Script

Create `src/db/seed.ts`:

```typescript
import db from './index.js';
import { createTables } from './schema.js';

function seed(): void {
  console.log('Creating tables...');
  createTables();

  console.log('Clearing existing data...');
  db.exec('DELETE FROM startups');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM categories');

  console.log('Seeding categories...');
  const insertCategory = db.prepare(
    'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)'
  );

  const categories = [
    ['Developer Tools', 'developer-tools', 'Tools and platforms for software developers'],
    ['CleanTech', 'cleantech', 'Sustainable and environmental technology'],
    ['HealthTech', 'healthtech', 'Healthcare and medical technology'],
    ['FinTech', 'fintech', 'Financial technology and services'],
    ['SaaS', 'saas', 'Software as a Service products'],
    ['AI/ML', 'ai-ml', 'Artificial intelligence and machine learning'],
    ['EdTech', 'edtech', 'Education technology'],
    ['Cloud Infrastructure', 'cloud-infrastructure', 'Cloud computing and infrastructure'],
  ];

  for (const [name, slug, description] of categories) {
    insertCategory.run(name, slug, description);
  }

  console.log('Seeding users...');
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, role) VALUES (?, ?, ?)'
  );

  const users = [
    ['Alex Chen', 'alex@codebrew.dev', 'founder'],
    ['Maria Santos', 'maria@greenroute.eco', 'founder'],
    ['James Okafor', 'james@medisync.health', 'founder'],
    ['Sarah Kim', 'sarah@datavault.io', 'founder'],
    ['Raj Patel', 'raj@learnflow.ai', 'founder'],
  ];

  for (const [name, email, role] of users) {
    insertUser.run(name, email, role);
  }

  console.log('Seeding startups...');
  const insertStartup = db.prepare(`
    INSERT INTO startups (
      name, slug, description, category_id, founder,
      website, funding_stage, funding_amount, employee_count, founded
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const getCategoryId = db.prepare('SELECT id FROM categories WHERE slug = ?');

  const startupsData = [
    {
      name: 'CodeBrew',
      slug: 'codebrew',
      description: 'AI-powered code review platform that catches bugs before they reach production',
      category: 'developer-tools',
      founder: 'Alex Chen',
      website: 'https://codebrew.dev',
      fundingStage: 'Series A',
      fundingAmount: 5000000,
      employeeCount: 25,
      founded: 2024,
    },
    {
      name: 'GreenRoute',
      slug: 'greenroute',
      description: 'Sustainable logistics optimization for last-mile delivery',
      category: 'cleantech',
      founder: 'Maria Santos',
      website: 'https://greenroute.eco',
      fundingStage: 'Seed',
      fundingAmount: 2000000,
      employeeCount: 12,
      founded: 2025,
    },
    {
      name: 'MediSync',
      slug: 'medisync',
      description: 'Real-time patient data synchronization across hospital systems',
      category: 'healthtech',
      founder: 'James Okafor',
      website: 'https://medisync.health',
      fundingStage: 'Series B',
      fundingAmount: 15000000,
      employeeCount: 60,
      founded: 2023,
    },
    {
      name: 'DataVault',
      slug: 'datavault',
      description: 'Enterprise-grade secure cloud data management and encryption',
      category: 'cloud-infrastructure',
      founder: 'Sarah Kim',
      website: 'https://datavault.io',
      fundingStage: 'Seed',
      fundingAmount: 1500000,
      employeeCount: 8,
      founded: 2025,
    },
    {
      name: 'LearnFlow',
      slug: 'learnflow',
      description: 'Adaptive learning platform powered by AI tutoring',
      category: 'edtech',
      founder: 'Raj Patel',
      website: 'https://learnflow.ai',
      fundingStage: 'Pre-Seed',
      fundingAmount: 500000,
      employeeCount: 4,
      founded: 2025,
    },
    {
      name: 'PayBridge',
      slug: 'paybridge',
      description: 'Cross-border payment infrastructure for emerging markets',
      category: 'fintech',
      founder: 'Maria Santos',
      website: 'https://paybridge.finance',
      fundingStage: 'Series A',
      fundingAmount: 8000000,
      employeeCount: 35,
      founded: 2024,
    },
  ];

  for (const s of startupsData) {
    const category = getCategoryId.get(s.category) as { id: number } | undefined;
    const categoryId = category ? category.id : null;

    insertStartup.run(
      s.name,
      s.slug,
      s.description,
      categoryId,
      s.founder,
      s.website,
      s.fundingStage,
      s.fundingAmount,
      s.employeeCount,
      s.founded
    );
  }

  // Print summary
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const startupCount = db.prepare('SELECT COUNT(*) as count FROM startups').get() as { count: number };

  console.log('');
  console.log('Seed complete:');
  console.log('  Categories: ' + categoryCount.count);
  console.log('  Users:      ' + userCount.count);
  console.log('  Startups:   ' + startupCount.count);
}

seed();
```

Let us walk through the key patterns in this script.

The seed function starts by calling `createTables()` to ensure the tables exist. Then it clears all existing data with DELETE statements. The order matters -- startups must be deleted before categories because of the foreign key constraint. If you try to delete a category that a startup references, SQLite will throw an error (because we enabled foreign keys).

Prepared statements are created once and reused for each insert. The `db.prepare()` call compiles the SQL and returns a statement object. Calling `stmt.run(...)` executes it with the given values. This is both safer (no SQL injection) and faster (the SQL is compiled once, not once per row).

The category lookup (`getCategoryId.get(s.category)`) demonstrates how prepared statements work for SELECT queries. The `.get()` method returns a single row as a plain JavaScript object. We use it to convert the category slug to an ID for the foreign key.

The type assertion `as { id: number } | undefined` is needed because better-sqlite3's TypeScript types return `unknown` for query results. In a larger application, you might create helper functions to handle this more cleanly.

### Step 5: Add the Seed Script to package.json

Update your package.json scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:seed": "tsx src/db/seed.ts"
  }
}
```

### Step 6: Initialize the Database on Server Start

Update `src/index.ts` to create tables when the server starts:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createTables } from './db/schema.js';
import startupsRouter from './routes/startups.js';

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

// Start the server
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});

export default app;
```

The `createTables()` call at the top ensures that the database tables exist before the server starts accepting requests. Because we use `CREATE TABLE IF NOT EXISTS`, this is safe to run every time -- it does nothing if the tables already exist.

### Step 7: Run the Seed Script

```bash
npm run db:seed
```

You should see output like:

```
Creating tables...
Clearing existing data...
Seeding categories...
Seeding users...
Seeding startups...

Seed complete:
  Categories: 8
  Users:      5
  Startups:   6
```

A `data.db` file now exists in your project root. This single file contains your entire database.

### Step 8: Inspect the Database

You can use the sqlite3 command-line tool to inspect your database. On macOS, it is pre-installed. On Linux, install it with `apt install sqlite3`. On Windows, download it from the SQLite website.

```bash
sqlite3 data.db
```

This opens an interactive SQL shell. Try these commands:

List all tables:
```sql
.tables
```

Output:
```
categories  startups    users
```

See the schema of a table:
```sql
.schema startups
```

Query the data:
```sql
SELECT id, name, slug FROM startups;
```

Output:
```
1|CodeBrew|codebrew
2|GreenRoute|greenroute
3|MediSync|medisync
4|DataVault|datavault
5|LearnFlow|learnflow
6|PayBridge|paybridge
```

Pretty-print output with column headers:
```sql
.mode column
.headers on
SELECT id, name, funding_stage, funding_amount FROM startups;
```

Output:
```
id  name        funding_stage  funding_amount
--  ----------  -------------  --------------
1   CodeBrew    Series A       5000000
2   GreenRoute  Seed           2000000
3   MediSync    Series B       15000000
4   DataVault   Seed           1500000
5   LearnFlow   Pre-Seed       500000
6   PayBridge   Series A       8000000
```

Join startups with their categories:
```sql
SELECT s.name, c.name as category
FROM startups s
JOIN categories c ON s.category_id = c.id;
```

Exit the shell:
```sql
.exit
```

These commands are useful for debugging. When something looks wrong in your API responses, you can check the database directly to see if the data is correct.

### Step 9: Update the .env File

Add the database path to your .env file:

```
PORT=3000
DATABASE_URL=./data.db
```

And update .env.example:

```
PORT=3000
DATABASE_URL=./data.db
```

### Step 10: Update .gitignore

Add the database file to .gitignore so it is not committed to version control:

```
node_modules
dist
*.db
.env
```

The `*.db` pattern catches any SQLite database file. Each developer runs the seed script to create their own local database.

## Understanding the Database File

The `data.db` file is a self-contained SQLite database. You can:

- Copy it to create a backup: `cp data.db data.backup.db`
- Delete it and re-seed to start fresh: `rm data.db && npm run db:seed`
- Move it to a different machine and it works identically

This is one of SQLite's greatest strengths. There is no server to coordinate with. The database is just a file.

The WAL mode we enabled creates two additional files alongside the database: `data.db-wal` and `data.db-shm`. These are temporary files that SQLite manages automatically. Do not delete them while the server is running, but they will be cleaned up when all connections close.

## Transactions

better-sqlite3 supports transactions, which let you run multiple operations atomically -- either all succeed or none do:

```typescript
const insertMany = db.transaction((items: string[]) => {
  const stmt = db.prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)');
  for (const item of items) {
    stmt.run(item, item.toLowerCase(), '');
  }
});

// If any insert fails, all of them are rolled back
insertMany(['Category A', 'Category B', 'Category C']);
```

The `db.transaction()` method wraps a function in a BEGIN/COMMIT block. If the function throws an error, the transaction is automatically rolled back. This is essential for data integrity -- you never end up in a state where some rows were inserted and others were not.

We will use transactions more in later lessons, but understanding the concept now is important.

## Try It Yourself

1. Add a new table called `funding_rounds` with columns: id, startup_id (foreign key to startups), round_name (TEXT), amount (INTEGER), date (TEXT), and investor (TEXT). Add the CREATE TABLE statement to `schema.ts` and add some seed data.

2. Open the sqlite3 shell and write a query that finds all startups with funding above 5 million, sorted by funding amount in descending order.

3. Write a query that counts how many startups are in each category using GROUP BY. The result should show the category name and the count.

4. Try deleting a category that has startups referencing it (use the sqlite3 shell). What happens? This is the foreign key constraint in action.

## Key Takeaways

- SQLite is a file-based database that requires zero configuration -- perfect for development
- better-sqlite3 provides a synchronous API that is simpler and faster than the async alternative
- Use `CREATE TABLE IF NOT EXISTS` to make table creation idempotent (safe to run repeatedly)
- Prepared statements with `?` placeholders prevent SQL injection and improve performance
- The `db.exec()` method runs raw SQL, while `db.prepare()` creates reusable statements
- A seed script populates the database with sample data for development
- WAL mode and foreign keys should be enabled when creating the database connection
- Transactions ensure multiple operations succeed or fail as a unit
- The sqlite3 command-line tool is invaluable for inspecting and debugging your database

## Next Steps

The database is ready and loaded with data. In the next lesson, we will rewire our CRUD endpoints to read from and write to SQLite instead of the in-memory array. You will see how the route handlers change only slightly -- the Express routing stays the same, but the data source becomes persistent.
