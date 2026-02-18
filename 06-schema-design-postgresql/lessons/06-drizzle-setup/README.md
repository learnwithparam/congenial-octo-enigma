# Drizzle Setup

In the first five lessons of this course you designed a relational schema for LaunchPad using raw SQL. You created tables, defined relationships, and normalized your data. That knowledge is permanent and transfers to any database tool you will ever use. Now it is time to bring that schema into your TypeScript codebase so your application code and your database speak the same language. In this lesson you will set up Drizzle ORM, define every LaunchPad table in TypeScript, and create a reusable database client.

## What You'll Learn

- What an ORM is and why you need one in a real project
- How Drizzle ORM compares to Prisma and other TypeScript ORMs
- How to install drizzle-orm, the pg driver, and drizzle-kit
- How to write a drizzle.config.ts configuration file
- How to define tables with pgTable including columns, defaults, and constraints
- How to express foreign keys and relations in Drizzle
- How to create a database client that your entire application can import

## Concepts

### What Is an ORM?

ORM stands for Object-Relational Mapping. It is a layer that sits between your application code and your database. Instead of writing raw SQL strings, you call TypeScript functions that generate SQL for you. The ORM also maps the rows that come back from the database into typed objects your code can work with safely.

Without an ORM your code looks like this:

```ts
const result = await pool.query(
  'SELECT id, name, email FROM users WHERE id = $1',
  [userId]
);
const user = result.rows[0]; // type is `any`
```

With Drizzle the same query becomes:

```ts
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
});
// user is fully typed: { id: number; name: string; email: string; ... }
```

The SQL knowledge you built in earlier lessons is not wasted. Drizzle generates standard SQL under the hood, and when you need to debug a slow query or write something the ORM does not support, you drop down to raw SQL with the `sql` template tag. Think of an ORM as a productivity multiplier, not a replacement for understanding SQL.

### Why Drizzle?

There are several TypeScript ORMs available today. The two most popular are Prisma and Drizzle. Here is how they compare for a project like LaunchPad:

Prisma uses its own schema language (a .prisma file) to define tables. You run a code generator that produces a TypeScript client from that schema. The generated client is powerful, but the extra code generation step adds complexity to your build pipeline. Prisma also abstracts SQL heavily -- you rarely see the queries it generates, which can make performance tuning harder.

Drizzle takes a different approach. Your schema is written in plain TypeScript using pgTable, mysqlTable, or sqliteTable functions. There is no separate schema language and no code generation step. The TypeScript you write is the source of truth. Drizzle also stays close to SQL -- its query builder mirrors SQL syntax almost one-to-one, so the mental model you built in earlier lessons carries over directly.

Key advantages of Drizzle for this course:

1. TypeScript-native schema -- Your tables are defined as regular TypeScript objects. Autocomplete and type checking work everywhere with zero extra tooling.

2. SQL-like query builder -- Drizzle select, where, join, and orderBy map directly to SQL clauses. If you know SELECT ... FROM ... WHERE, you know Drizzle.

3. Lightweight -- Drizzle has no runtime dependencies beyond your database driver. The bundle is small and startup is fast.

4. Relational queries -- Drizzle offers a relational query API (similar to Prisma includes) for fetching nested data in a single call.

5. Raw SQL escape hatch -- The sql template tag lets you write raw SQL anywhere, giving you full control when the query builder is not enough.

### The Drizzle Ecosystem

Drizzle is split into two packages:

- drizzle-orm: The runtime library you import in your application. It contains the query builder, schema definition functions, and database client.
- drizzle-kit: A CLI tool for migrations. It reads your TypeScript schema, compares it to the database, and generates SQL migration files. You only need drizzle-kit during development, so it is installed as a dev dependency.

You also need a PostgreSQL driver. Drizzle supports several drivers. We will use the pg package because it is the most established Node.js PostgreSQL driver and works well with the Docker setup from Lesson 2.

### Configuration Overview

Drizzle needs one configuration file at the root of your project: drizzle.config.ts. This file tells drizzle-kit where to find your schema files and how to connect to the database. It is only used by the CLI -- your application code does not read it.

## Step by Step

### Step 1: Install Dependencies

Make sure you are in the root of the LaunchPad project. Install the runtime ORM and the PostgreSQL driver as regular dependencies:

```bash
npm install drizzle-orm pg
```

Install the TypeScript types for the pg driver and the Drizzle CLI tool as dev dependencies:

```bash
npm install -D @types/pg drizzle-kit
```

After installation your package.json will include these new entries:

```json
{
  "dependencies": {
    "drizzle-orm": "^0.38.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.30.0"
  }
}
```

The exact patch versions may differ. What matters is drizzle-orm 0.38.x and drizzle-kit 0.30.x or newer.

### Step 2: Create the Drizzle Config File

Create a file called drizzle.config.ts in the project root:

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'launchpad',
  },
});
```

Here is what each field does:

- schema: The path to the file (or files) where you define your tables. Drizzle-kit reads this to generate migrations.
- out: The directory where migration files will be written. We use ./drizzle to keep them at the project root, clearly separated from application code.
- dialect: Tells Drizzle which database engine you are targeting. We use postgresql.
- dbCredentials: Connection details for your PostgreSQL instance. The values fall back to the defaults from our Docker Compose setup in Lesson 2.

### Step 3: Set Up Environment Variables

Create a .env file in the project root if you do not have one already:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=launchpad
```

These match the Docker Compose configuration from Lesson 2. If you changed any values there, update them here to match.

Make sure your .gitignore includes .env so credentials are never committed:

```
# .gitignore
.env
node_modules
```

### Step 4: Create the Project Structure

Create the directory for your database files:

```bash
mkdir -p src/db
```

You will create two files in this directory:

- src/db/schema.ts -- All table definitions and relations
- src/db/index.ts -- The database client that the rest of your app imports

### Step 5: Define the Users Table

Open src/db/schema.ts and start with the users table. Every function you need comes from drizzle-orm/pg-core:

```ts
// src/db/schema.ts
import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// Users
// ============================================================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

Let us break down what is happening:

- pgTable takes two arguments: the SQL table name as a string and an object describing the columns.
- serial creates an auto-incrementing integer column, perfect for primary keys.
- varchar creates a variable-length character column with an optional max length.
- text creates an unbounded text column, suitable for long strings like bios and descriptions.
- timestamp creates a timestamp column. defaultNow() tells PostgreSQL to use the current time when a row is inserted.
- The .notNull() chain marks the column as NOT NULL.
- The .unique() chain adds a UNIQUE constraint.

Notice the naming convention: the TypeScript property uses camelCase (avatarUrl) while the SQL column name uses snake_case (avatar_url). Drizzle handles this mapping automatically.

### Step 6: Define the Categories Table

Add the categories table below the users table:

```ts
// ============================================================
// Categories
// ============================================================
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

Categories are simple lookup data. Each category has a human-readable name ("Developer Tools") and a URL-friendly slug ("developer-tools"). The unique constraints ensure no duplicates slip in.

### Step 7: Define the Startups Table

The startups table is the heart of LaunchPad. It references both users (the founder) and categories:

```ts
// ============================================================
// Startups
// ============================================================
export const startups = pgTable('startups', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  tagline: varchar('tagline', { length: 500 }).notNull(),
  description: text('description').notNull(),
  websiteUrl: text('website_url'),
  logoUrl: text('logo_url'),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id),
  founderId: integer('founder_id')
    .notNull()
    .references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  featured: boolean('featured').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

Two important patterns to notice here:

Foreign keys: The .references() method creates a foreign key constraint. The arrow function syntax (() => categories.id) avoids circular reference issues when tables reference each other. Drizzle resolves these lazily at runtime.

Default values: The status column defaults to 'pending' and featured defaults to false. These defaults are applied at the database level, so they work even if you insert a row using raw SQL.

### Step 8: Define the Comments Table

Comments belong to a startup and are written by a user:

```ts
// ============================================================
// Comments
// ============================================================
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  startupId: integer('startup_id')
    .notNull()
    .references(() => startups.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

Notice the { onDelete: 'cascade' } option on the startup reference. This means that when a startup is deleted, all its comments are automatically deleted too. This is the ON DELETE CASCADE behavior from SQL, expressed in TypeScript.

### Step 9: Define the Upvotes Table

Upvotes link a user to a startup. A user can upvote a startup only once, which we enforce with a unique constraint on the combination of both columns:

```ts
// ============================================================
// Upvotes
// ============================================================
export const upvotes = pgTable(
  'upvotes',
  {
    id: serial('id').primaryKey(),
    startupId: integer('startup_id')
      .notNull()
      .references(() => startups.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueUpvote: uniqueIndex('unique_upvote').on(table.startupId, table.userId),
  })
);
```

The third argument to pgTable is a function that receives the table and returns an object of indexes and constraints. Here we create a unique index on (startup_id, user_id) so the same user cannot upvote the same startup twice. If they try, the database will reject the insert with a constraint violation error.

### Step 10: Define Relations

Drizzle has a separate relations API for its relational query system. Relations do not create database constraints (the .references() calls already did that). Instead they tell Drizzle how tables connect so you can use the relational query API (db.query.users.findMany with nested includes).

Add these below your table definitions:

```ts
// ============================================================
// Relations
// ============================================================
export const usersRelations = relations(users, ({ many }) => ({
  startups: many(startups),
  comments: many(comments),
  upvotes: many(upvotes),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  startups: many(startups),
}));

export const startupsRelations = relations(startups, ({ one, many }) => ({
  category: one(categories, {
    fields: [startups.categoryId],
    references: [categories.id],
  }),
  founder: one(users, {
    fields: [startups.founderId],
    references: [users.id],
  }),
  comments: many(comments),
  upvotes: many(upvotes),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  startup: one(startups, {
    fields: [comments.startupId],
    references: [startups.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const upvotesRelations = relations(upvotes, ({ one }) => ({
  startup: one(startups, {
    fields: [upvotes.startupId],
    references: [startups.id],
  }),
  user: one(users, {
    fields: [upvotes.userId],
    references: [users.id],
  }),
}));
```

Each relation definition uses either one() for a belongs-to relationship or many() for a has-many relationship. The fields and references arrays specify which columns form the join.

For example, the startup-to-category relation says: "A startup belongs to one category. The join uses startups.categoryId on the startup side and categories.id on the category side."

### Step 11: Create the Database Client

Now create src/db/index.ts. This file creates a single database client that your entire application imports:

```ts
// src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'launchpad',
});

export const db = drizzle(pool, { schema });
```

A few things to understand about this setup:

Pool vs Client: The pg library offers both a Pool and a single Client. A Pool maintains a set of connections and distributes queries across them. For a web server that handles many concurrent requests, a pool is essential. A single Client would create a bottleneck.

The schema import: Passing the schema object to drizzle() enables the relational query API. Without it you can still use the core query builder (db.select, db.insert), but you cannot use db.query.users.findMany with nested includes.

Singleton pattern: By creating the pool and the db instance at the module level, Node.js module caching ensures only one pool exists no matter how many files import from this module. Every import of db shares the same connection pool.

### Step 12: Add a Type Helper

It is useful to export inferred types for each table so you can use them throughout your application. Add this to the bottom of src/db/schema.ts:

```ts
// ============================================================
// Inferred Types
// ============================================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Startup = typeof startups.$inferSelect;
export type NewStartup = typeof startups.$inferInsert;

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

export type Upvote = typeof upvotes.$inferSelect;
export type NewUpvote = typeof upvotes.$inferInsert;
```

The $inferSelect type represents a row as it comes back from a SELECT query. The $inferInsert type represents the data needed to INSERT a new row -- columns with defaults become optional. For example, NewStartup will not require id or createdAt because those have default values.

### Step 13: Verify the Setup

Make sure your Docker PostgreSQL container is running (from Lesson 2):

```bash
docker compose up -d
```

Then run a quick check to make sure drizzle-kit can read your schema:

```bash
npx drizzle-kit check
```

If everything is configured correctly, drizzle-kit will parse your schema without errors. You should see output indicating that it found your tables. If you get a connection error, double-check that your Docker container is running and that your .env values match your Docker Compose configuration.

You can also verify your TypeScript compiles cleanly:

```bash
npx tsc --noEmit
```

This ensures all imports resolve and types are correct.

## Exercise

1. Add a new table called tags to the schema. A tag has an id (serial primary key), a name (varchar, unique, max 50 characters), and a createdAt timestamp. Define the pgTable and export the inferred types.

2. Create a join table called startup_tags that connects startups to tags (many-to-many). It should have an id, a startupId referencing startups, a tagId referencing tags, and a unique index on the combination of startupId and tagId. Add onDelete cascade for both foreign keys.

3. Add relations for both the tags table and the startup_tags table. A tag has many startup_tags, and a startup_tags entry belongs to one startup and one tag.

4. Update the startupsRelations to include a many() relation to startup_tags.

5. Verify your changes compile by running npx tsc --noEmit.

## Key Takeaways

- An ORM maps database tables to TypeScript types, giving you autocomplete and compile-time safety across your entire data layer.
- Drizzle ORM defines schemas in plain TypeScript with pgTable -- no separate schema language, no code generation step.
- Foreign keys are declared with .references(() => table.column) and support options like onDelete cascade.
- The relations API is separate from foreign key constraints. It enables the relational query builder (db.query) for fetching nested data.
- A connection Pool is essential for production applications. The singleton pattern at the module level ensures one pool is shared across all imports.
- Inferred types ($inferSelect and $inferInsert) keep your application types in sync with your schema automatically.

## Summary

You installed Drizzle ORM and the pg driver, created a drizzle.config.ts file that points to your schema and database, and defined five tables: users, categories, startups, comments, and upvotes. Each table has proper column types, constraints, and foreign keys. You added relation definitions so the relational query API knows how your tables connect. Finally, you created a database client in src/db/index.ts that the rest of your application can import. Your entire LaunchPad schema is now expressed in TypeScript with full type safety.

In the next lesson you will use drizzle-kit to generate migration files from this schema and run them against your Docker PostgreSQL database. You will also write a seed script to populate the database with sample data so you have something to query in later lessons.
