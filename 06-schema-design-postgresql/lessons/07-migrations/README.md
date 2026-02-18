# Migrations

In the previous lesson you defined your entire LaunchPad schema in TypeScript using Drizzle ORM. But the database does not know about those definitions yet. Your PostgreSQL instance is still empty. Migrations are the bridge between your schema code and the actual tables in the database. In this lesson you will learn what migrations are, why they matter, how to generate and run them with drizzle-kit, and how to seed your database with realistic sample data.

## What You'll Learn

- What database migrations are and why every team needs them
- How drizzle-kit generate compares your schema to the migration history and produces SQL files
- The anatomy of a Drizzle migration file
- How to write a migrate.ts script that applies migrations programmatically
- How to write a seed.ts script that populates the database with sample data
- How to run migrations against your Docker PostgreSQL instance
- Best practices for managing migrations in a team environment

## Concepts

### What Are Migrations?

A migration is a versioned change to your database schema. Think of migrations as version control for your database structure. Just like git tracks changes to your source code over time, migrations track changes to your tables, columns, indexes, and constraints.

Without migrations you would connect to the database and run CREATE TABLE statements by hand. That works when you are the only developer on a hobby project, but it falls apart as soon as you need to:

- Share database changes with teammates
- Deploy to staging and production environments
- Roll back a change that broke something
- Understand what the database looked like three months ago

Migrations solve all of these problems. Each migration is a file that contains the SQL needed to move the database from one state to the next. They are applied in order, and a metadata table in the database tracks which migrations have already been run.

### How Drizzle Migrations Work

Drizzle-kit follows a generate-then-apply workflow:

1. You edit your TypeScript schema (src/db/schema.ts).
2. You run drizzle-kit generate. The tool reads your schema, compares it to the last known state (stored in a snapshot file), and generates a new SQL migration file.
3. You review the generated SQL to make sure it does what you expect.
4. You run the migration against the database, either with drizzle-kit migrate or with a custom migrate.ts script.

This approach is called "declarative schema with generated migrations." You declare what the database should look like in TypeScript, and the tool figures out the SQL needed to get there. It is the same philosophy used by tools like Terraform for infrastructure.

### Migration Files Structure

When you run drizzle-kit generate, it creates files in the output directory you specified in drizzle.config.ts (./drizzle in our case). The directory structure looks like this:

```
drizzle/
  0000_initial_migration.sql
  meta/
    0000_snapshot.json
    _journal.json
```

The SQL file contains the actual DDL statements (CREATE TABLE, ALTER TABLE, etc.). The meta directory contains internal state:

- Snapshot files record what the schema looked like at each migration point. Drizzle-kit diffs the current schema against the latest snapshot to determine what changed.
- The journal file tracks the order and status of all migrations.

You should commit both the SQL files and the meta directory to version control. They are part of your project history.

### Why Not Just Push?

Drizzle-kit also has a push command that applies schema changes directly to the database without generating migration files. This is convenient during early prototyping, but it is dangerous for production use. Without migration files you have no audit trail, no way to review changes before they are applied, and no way to run the exact same changes on another database. We will use the generate-then-migrate workflow throughout this course because it is the workflow you will use in every professional project.

## Step by Step

### Step 1: Make Sure PostgreSQL Is Running

Before generating or running migrations, your Docker PostgreSQL container must be running. Start it if it is not already:

```bash
docker compose up -d
```

Verify the container is healthy:

```bash
docker compose ps
```

You should see the postgres container with a status of "Up" or "healthy." If the database named launchpad does not exist yet, connect and create it:

```bash
docker compose exec postgres psql -U postgres -c "CREATE DATABASE launchpad;"
```

If the database already exists, that command will print a notice and you can safely ignore it.

### Step 2: Generate the Initial Migration

Run the drizzle-kit generate command from the project root:

```bash
npx drizzle-kit generate
```

Drizzle-kit reads your schema from src/db/schema.ts (as specified in drizzle.config.ts), sees that there are no previous snapshots, and generates a migration file containing all of your CREATE TABLE statements.

You should see output similar to:

```
1 tables added
 - users
 - categories
 - startups
 - comments
 - upvotes

[✓] Your SQL migration file ➜ drizzle/0000_initial_migration.sql
```

The exact file name will include a timestamp or sequence number. Open the generated file to inspect it.

### Step 3: Review the Generated SQL

Open the migration file (drizzle/0000_initial_migration.sql or similar). You will see standard PostgreSQL DDL:

```sql
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "avatar_url" text,
  "bio" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "slug" varchar(100) NOT NULL,
  CONSTRAINT "categories_name_unique" UNIQUE("name"),
  CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "startups" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "tagline" varchar(500) NOT NULL,
  "description" text NOT NULL,
  "website_url" text,
  "logo_url" text,
  "category_id" integer NOT NULL,
  "founder_id" integer NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "featured" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "startups_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "content" text NOT NULL,
  "startup_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "upvotes" (
  "id" serial PRIMARY KEY NOT NULL,
  "startup_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "startups" ADD CONSTRAINT "startups_category_id_categories_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "startups" ADD CONSTRAINT "startups_founder_id_users_id_fk"
    FOREIGN KEY ("founder_id") REFERENCES "users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "comments" ADD CONSTRAINT "comments_startup_id_startups_id_fk"
    FOREIGN KEY ("startup_id") REFERENCES "startups"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "upvotes" ADD CONSTRAINT "upvotes_startup_id_startups_id_fk"
    FOREIGN KEY ("startup_id") REFERENCES "startups"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "upvotes" ADD CONSTRAINT "upvotes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "unique_upvote"
  ON "upvotes" ("startup_id", "user_id");
```

This is the same SQL you would have written by hand in the earlier lessons, but generated automatically from your TypeScript schema. The IF NOT EXISTS and EXCEPTION WHEN duplicate_object guards make the migration safe to run multiple times (idempotent).

Take a moment to verify that every table, column, constraint, and foreign key matches what you defined in schema.ts. This review step is important -- you should always read the generated SQL before applying it.

### Step 4: Write the Migration Script

While you can run migrations with npx drizzle-kit migrate, it is better to have a TypeScript script you can call from your build process or CI pipeline. Create src/db/migrate.ts:

```ts
// src/db/migrate.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function runMigrations() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'launchpad',
  });

  const db = drizzle(pool);

  console.log('Running migrations...');

  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('Migrations complete.');

  await pool.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

This script creates a dedicated pool, runs all pending migrations from the ./drizzle folder, logs the result, and closes the pool. The pool.end() call is important -- without it the Node.js process will hang because the pool keeps connections alive.

### Step 5: Add a Script to package.json

Add convenience scripts so you do not have to remember the full commands:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:seed": "tsx src/db/seed.ts",
    "db:studio": "drizzle-kit studio"
  }
}
```

We use tsx to run TypeScript files directly without a separate compile step. Install it if you have not already:

```bash
npm install -D tsx
```

### Step 6: Run the Migration

Execute the migration script:

```bash
npm run db:migrate
```

You should see:

```
Running migrations...
Migrations complete.
```

If you get a connection error, make sure your Docker container is running and the launchpad database exists.

To verify the tables were created, connect to PostgreSQL and list them:

```bash
docker compose exec postgres psql -U postgres -d launchpad -c "\dt"
```

You should see output listing all five tables plus the drizzle migration tracking table:

```
              List of relations
 Schema |         Name          | Type  |  Owner
--------+-----------------------+-------+----------
 public | categories            | table | postgres
 public | comments              | table | postgres
 public | startups              | table | postgres
 public | upvotes               | table | postgres
 public | users                 | table | postgres
 public | __drizzle_migrations  | table | postgres
```

The __drizzle_migrations table is where Drizzle tracks which migrations have been applied. You should never modify this table by hand.

### Step 7: Write the Seed Script

An empty database is not very useful for development. You need sample data to test queries, build UI, and verify that your relationships work correctly. Create src/db/seed.ts:

```ts
// src/db/seed.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

async function seed() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'launchpad',
  });

  const db = drizzle(pool, { schema });

  console.log('Seeding database...');

  // ----------------------------------------------------------
  // Clear existing data (in reverse order of dependencies)
  // ----------------------------------------------------------
  await db.delete(schema.upvotes);
  await db.delete(schema.comments);
  await db.delete(schema.startups);
  await db.delete(schema.categories);
  await db.delete(schema.users);

  // ----------------------------------------------------------
  // Users
  // ----------------------------------------------------------
  const insertedUsers = await db
    .insert(schema.users)
    .values([
      {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        bio: 'Full-stack developer and startup enthusiast.',
      },
      {
        name: 'Bob Smith',
        email: 'bob@example.com',
        bio: 'Designer turned founder. Building tools for creators.',
      },
      {
        name: 'Carol Williams',
        email: 'carol@example.com',
        bio: 'Product manager with a passion for developer tools.',
      },
      {
        name: 'David Brown',
        email: 'david@example.com',
        bio: 'Serial entrepreneur. Third startup and counting.',
      },
      {
        name: 'Eva Martinez',
        email: 'eva@example.com',
        bio: 'AI researcher exploring practical applications.',
      },
    ])
    .returning();

  console.log('Inserted ' + insertedUsers.length + ' users.');

  // ----------------------------------------------------------
  // Categories
  // ----------------------------------------------------------
  const insertedCategories = await db
    .insert(schema.categories)
    .values([
      {
        name: 'Developer Tools',
        slug: 'developer-tools',
        description: 'Tools that make developers more productive.',
      },
      {
        name: 'AI & Machine Learning',
        slug: 'ai-machine-learning',
        description: 'Products powered by artificial intelligence.',
      },
      {
        name: 'SaaS',
        slug: 'saas',
        description: 'Software as a service products.',
      },
      {
        name: 'Design',
        slug: 'design',
        description: 'Design tools, resources, and platforms.',
      },
      {
        name: 'Productivity',
        slug: 'productivity',
        description: 'Tools that help you get more done.',
      },
    ])
    .returning();

  console.log('Inserted ' + insertedCategories.length + ' categories.');

  // ----------------------------------------------------------
  // Startups
  // ----------------------------------------------------------
  const insertedStartups = await db
    .insert(schema.startups)
    .values([
      {
        name: 'CodeFlow',
        slug: 'codeflow',
        tagline: 'Collaborative code review for modern teams',
        description:
          'CodeFlow brings real-time collaboration to code review. Leave comments, suggest changes, and merge with confidence. Built for teams that ship fast.',
        websiteUrl: 'https://codeflow.example.com',
        categoryId: insertedCategories[0].id,
        founderId: insertedUsers[0].id,
        status: 'active',
        featured: true,
      },
      {
        name: 'PromptLab',
        slug: 'promptlab',
        tagline: 'Test and iterate on LLM prompts',
        description:
          'PromptLab gives you a playground for testing prompts against multiple language models. Compare outputs, track versions, and share templates with your team.',
        websiteUrl: 'https://promptlab.example.com',
        categoryId: insertedCategories[1].id,
        founderId: insertedUsers[4].id,
        status: 'active',
        featured: true,
      },
      {
        name: 'InvoiceBot',
        slug: 'invoicebot',
        tagline: 'Automated invoicing for freelancers',
        description:
          'Stop chasing payments. InvoiceBot generates, sends, and tracks invoices automatically. Integrates with Stripe, PayPal, and bank transfers.',
        websiteUrl: 'https://invoicebot.example.com',
        categoryId: insertedCategories[2].id,
        founderId: insertedUsers[3].id,
        status: 'active',
        featured: false,
      },
      {
        name: 'PixelSnap',
        slug: 'pixelsnap',
        tagline: 'Design-to-code in one click',
        description:
          'Upload any design file and PixelSnap generates clean, responsive HTML and CSS. Supports Figma, Sketch, and Adobe XD imports.',
        websiteUrl: 'https://pixelsnap.example.com',
        categoryId: insertedCategories[3].id,
        founderId: insertedUsers[1].id,
        status: 'active',
        featured: false,
      },
      {
        name: 'FocusMode',
        slug: 'focusmode',
        tagline: 'Block distractions and track deep work',
        description:
          'FocusMode blocks distracting websites and apps during work sessions. Track your deep work hours, set daily goals, and build streaks.',
        websiteUrl: 'https://focusmode.example.com',
        categoryId: insertedCategories[4].id,
        founderId: insertedUsers[2].id,
        status: 'active',
        featured: false,
      },
      {
        name: 'SchemaViz',
        slug: 'schemaviz',
        tagline: 'Visualize your database schema instantly',
        description:
          'Connect SchemaViz to any PostgreSQL, MySQL, or SQLite database and get an interactive ER diagram in seconds. Export to PNG, SVG, or share a live link.',
        websiteUrl: 'https://schemaviz.example.com',
        categoryId: insertedCategories[0].id,
        founderId: insertedUsers[2].id,
        status: 'pending',
        featured: false,
      },
      {
        name: 'SentimentAI',
        slug: 'sentimentai',
        tagline: 'Real-time sentiment analysis for customer feedback',
        description:
          'SentimentAI processes customer reviews, support tickets, and social mentions in real time. Get alerts when sentiment drops and identify trends before they become problems.',
        categoryId: insertedCategories[1].id,
        founderId: insertedUsers[3].id,
        status: 'active',
        featured: false,
      },
      {
        name: 'TaskPilot',
        slug: 'taskpilot',
        tagline: 'AI-powered task prioritization',
        description:
          'TaskPilot uses machine learning to analyze your task list and suggest the optimal order. It learns from your habits and adapts to your work style over time.',
        categoryId: insertedCategories[4].id,
        founderId: insertedUsers[4].id,
        status: 'active',
        featured: true,
      },
    ])
    .returning();

  console.log('Inserted ' + insertedStartups.length + ' startups.');

  // ----------------------------------------------------------
  // Comments
  // ----------------------------------------------------------
  const insertedComments = await db
    .insert(schema.comments)
    .values([
      {
        content: 'This is exactly what our team needed. The real-time collaboration features are top notch.',
        startupId: insertedStartups[0].id,
        userId: insertedUsers[1].id,
      },
      {
        content: 'Been using the beta for two weeks. Huge improvement over our previous workflow.',
        startupId: insertedStartups[0].id,
        userId: insertedUsers[2].id,
      },
      {
        content: 'The multi-model comparison feature is incredibly useful for prompt engineering.',
        startupId: insertedStartups[1].id,
        userId: insertedUsers[0].id,
      },
      {
        content: 'Love the version tracking. Finally I can see how my prompts evolved.',
        startupId: insertedStartups[1].id,
        userId: insertedUsers[3].id,
      },
      {
        content: 'Saved me so much time on invoicing. The Stripe integration works flawlessly.',
        startupId: insertedStartups[2].id,
        userId: insertedUsers[0].id,
      },
      {
        content: 'The generated code is surprisingly clean. Impressed with the Figma support.',
        startupId: insertedStartups[3].id,
        userId: insertedUsers[4].id,
      },
      {
        content: 'My screen time dropped by 40 percent since I started using FocusMode.',
        startupId: insertedStartups[4].id,
        userId: insertedUsers[3].id,
      },
      {
        content: 'Great idea! Would love to see MySQL support added soon.',
        startupId: insertedStartups[5].id,
        userId: insertedUsers[0].id,
      },
      {
        content: 'The AI prioritization is scarily accurate. It knows my work patterns better than I do.',
        startupId: insertedStartups[7].id,
        userId: insertedUsers[1].id,
      },
      {
        content: 'Integrates perfectly with our existing project management setup.',
        startupId: insertedStartups[7].id,
        userId: insertedUsers[2].id,
      },
    ])
    .returning();

  console.log('Inserted ' + insertedComments.length + ' comments.');

  // ----------------------------------------------------------
  // Upvotes
  // ----------------------------------------------------------
  const insertedUpvotes = await db
    .insert(schema.upvotes)
    .values([
      { startupId: insertedStartups[0].id, userId: insertedUsers[1].id },
      { startupId: insertedStartups[0].id, userId: insertedUsers[2].id },
      { startupId: insertedStartups[0].id, userId: insertedUsers[3].id },
      { startupId: insertedStartups[0].id, userId: insertedUsers[4].id },
      { startupId: insertedStartups[1].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[1].id, userId: insertedUsers[2].id },
      { startupId: insertedStartups[1].id, userId: insertedUsers[3].id },
      { startupId: insertedStartups[2].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[2].id, userId: insertedUsers[4].id },
      { startupId: insertedStartups[3].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[3].id, userId: insertedUsers[2].id },
      { startupId: insertedStartups[3].id, userId: insertedUsers[4].id },
      { startupId: insertedStartups[4].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[4].id, userId: insertedUsers[1].id },
      { startupId: insertedStartups[5].id, userId: insertedUsers[3].id },
      { startupId: insertedStartups[6].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[6].id, userId: insertedUsers[1].id },
      { startupId: insertedStartups[7].id, userId: insertedUsers[0].id },
      { startupId: insertedStartups[7].id, userId: insertedUsers[1].id },
      { startupId: insertedStartups[7].id, userId: insertedUsers[2].id },
      { startupId: insertedStartups[7].id, userId: insertedUsers[3].id },
    ])
    .returning();

  console.log('Inserted ' + insertedUpvotes.length + ' upvotes.');

  console.log('Seeding complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

There are several important patterns in this seed script:

Deletion order matters. You must delete tables with foreign keys first (upvotes, comments), then the tables they reference (startups), and finally the base tables (categories, users). If you try to delete users before deleting their startups, PostgreSQL will reject the operation because of the foreign key constraint.

The .returning() method tells PostgreSQL to return the inserted rows, including auto-generated values like id and createdAt. We use the returned ids to set up correct foreign key references in dependent tables.

Data is realistic enough to test with. The sample startups have different categories, founders, and statuses. Comments and upvotes are distributed unevenly (some startups are more popular than others), which will make queries in later lessons more interesting.

### Step 8: Run the Seed Script

Execute the seed script:

```bash
npm run db:seed
```

You should see:

```
Seeding database...
Inserted 5 users.
Inserted 5 categories.
Inserted 8 startups.
Inserted 10 comments.
Inserted 21 upvotes.
Seeding complete.
```

Verify the data is in the database:

```bash
docker compose exec postgres psql -U postgres -d launchpad -c "SELECT id, name, email FROM users;"
```

```
 id |      name       |       email
----+-----------------+--------------------
  1 | Alice Johnson   | alice@example.com
  2 | Bob Smith       | bob@example.com
  3 | Carol Williams  | carol@example.com
  4 | David Brown     | david@example.com
  5 | Eva Martinez    | eva@example.com
```

You can also check the startup count per category:

```bash
docker compose exec postgres psql -U postgres -d launchpad -c \
  "SELECT c.name, COUNT(s.id) FROM categories c LEFT JOIN startups s ON s.category_id = c.id GROUP BY c.name ORDER BY count DESC;"
```

### Step 9: Explore with Drizzle Studio

Drizzle-kit includes a visual database explorer called Drizzle Studio. Launch it:

```bash
npm run db:studio
```

This opens a browser-based interface where you can browse tables, view data, run queries, and even edit rows. It is similar to pgAdmin or TablePlus but runs directly from your drizzle config with no extra setup.

Use the studio to browse through your seeded data and verify that relationships look correct. Click on a startup row and check that its categoryId and founderId point to real records in the categories and users tables.

### Step 10: Make a Schema Change and Generate a New Migration

Let us practice the migration workflow by adding a column. Suppose you want to track when a startup was last featured. Open src/db/schema.ts and add a new column to the startups table:

```ts
export const startups = pgTable('startups', {
  // ... existing columns ...
  featuredAt: timestamp('featured_at'),
});
```

Now generate a new migration:

```bash
npm run db:generate
```

Drizzle-kit detects the difference between the current schema and the last snapshot. It generates a new migration file containing only the change:

```sql
ALTER TABLE "startups" ADD COLUMN "featured_at" timestamp;
```

Apply the migration:

```bash
npm run db:migrate
```

Check the drizzle directory -- you should now have two migration files. Each one represents a point-in-time change to your schema. Together they form the complete history of your database evolution.

This is the workflow you will repeat throughout the project. Change the schema, generate, review, migrate. Every change is captured, versioned, and reproducible.

## Exercise

1. Add a new column called website to the users table. It should be a text column that allows null values. Generate a migration, review the SQL, and apply it.

2. After applying the migration, update the seed script to include website URLs for two of the five users. Run the seed script again to refresh the data.

3. Add a new table called replies to the schema. A reply has an id (serial primary key), a content (text, not null), a commentId referencing comments (with cascade delete), a userId referencing users, and a createdAt timestamp. Generate a migration and apply it.

4. Add three sample replies to the seed script, making sure to seed them after comments and delete them before comments. Run the seed again and verify the data.

5. Run drizzle-kit studio and browse all the tables to confirm everything looks correct.

## Key Takeaways

- Migrations are versioned SQL files that track every change to your database schema over time, just like git tracks source code changes.
- The drizzle-kit generate command compares your TypeScript schema against the last snapshot and produces only the SQL needed for the difference.
- Always review generated SQL before applying it. The tool is reliable, but reviewing SQL is a habit that prevents surprises in production.
- A seed script populates the database with sample data for development. Delete in reverse dependency order, insert in dependency order, and use .returning() to capture generated IDs.
- Commit migration files and the meta directory to version control. They are part of your project and must be shared with every teammate and every deployment environment.
- The db:generate, db:migrate, db:seed workflow is one you will use hundreds of times throughout any real project.

## Summary

You generated your first migration from the LaunchPad schema, reviewed the SQL it produced, and applied it to your Docker PostgreSQL instance. You created a reusable migrate.ts script for programmatic migration runs and a comprehensive seed.ts script that populates the database with five users, five categories, eight startups, ten comments, and twenty-one upvotes. You practiced the schema-change workflow by adding a new column and generating an incremental migration. Your database is now fully set up with tables, constraints, foreign keys, and realistic data.

In the next lesson you will learn about indexes and performance. You will use EXPLAIN ANALYZE to understand how PostgreSQL executes queries, add indexes to speed up common access patterns, and measure the before-and-after difference.
