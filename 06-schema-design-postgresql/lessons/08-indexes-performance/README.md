# Indexes and Performance

Your LaunchPad database has tables, relationships, and sample data. Queries work, but are they fast? When the startups table has 10 rows, everything feels instant. When it has 100,000 rows, a query that scans every row becomes painfully slow. Indexes are the primary tool for making database queries fast. In this lesson you will learn what indexes are, how they work internally, how to measure query performance with EXPLAIN ANALYZE, and how to add indexes to your LaunchPad schema.

## What You'll Learn

- What a database index is and how B-tree indexes work at a high level
- How PostgreSQL decides whether to use an index or scan the whole table
- How to read EXPLAIN ANALYZE output to understand query performance
- Which columns in your LaunchPad schema benefit from indexing
- How to add indexes in Drizzle ORM and generate a migration for them
- What composite indexes are and when to use them
- When indexes hurt performance and the tradeoffs involved

## Concepts

### What Is an Index?

An index is a separate data structure that the database maintains alongside your table. It organizes a copy of one or more column values in a way that makes lookups fast. The analogy most people use is a book index: instead of reading every page to find the word "migration," you flip to the index at the back, find "migration," and jump directly to the right pages.

Without an index, PostgreSQL has to perform a sequential scan -- it reads every row in the table and checks whether it matches your WHERE condition. With an index, PostgreSQL can jump directly to the matching rows.

### How B-tree Indexes Work

The default index type in PostgreSQL is a B-tree (balanced tree). A B-tree organizes values in a sorted tree structure. Here is a simplified picture of what happens when you create an index on the name column of the startups table:

1. PostgreSQL creates a tree where each node contains a range of name values and pointers to the actual table rows.
2. The root node splits the alphabet into ranges (say, A-M and N-Z).
3. Child nodes split further (A-F, G-M, N-S, T-Z).
4. Leaf nodes contain the actual values and row pointers.

When you query WHERE name = 'CodeFlow', PostgreSQL starts at the root, follows the branch for the C range, and arrives at the leaf node containing 'CodeFlow' in just a few steps. Even with millions of rows, a B-tree lookup typically takes 3-4 steps.

This is dramatically faster than a sequential scan that checks every single row.

### Indexes PostgreSQL Creates Automatically

You do not always need to create indexes manually. PostgreSQL automatically creates indexes for:

- Primary keys: Every PRIMARY KEY column gets a unique B-tree index. Your users.id, startups.id, and other primary keys are already indexed.
- Unique constraints: Every UNIQUE constraint creates a unique index. Your users.email, startups.slug, categories.name, and categories.slug are all indexed automatically.

Foreign key columns, however, are NOT automatically indexed in PostgreSQL. This is a common source of performance problems and one of the main things we will fix in this lesson.

### When PostgreSQL Uses (or Ignores) an Index

Having an index does not guarantee PostgreSQL will use it. The query planner makes a cost-based decision for every query. It estimates the cost of a sequential scan versus an index scan and picks the cheaper option. The planner might skip an index when:

- The table is small (a few hundred rows). A sequential scan of a tiny table can be faster than the overhead of traversing an index tree.
- The query matches a large percentage of rows. If your WHERE clause matches 80 percent of the table, reading the whole table is faster than bouncing between the index and the table data.
- Statistics are outdated. PostgreSQL maintains statistics about data distribution. If they are stale, the planner might make a bad choice. Running ANALYZE updates them.

### Understanding EXPLAIN ANALYZE

EXPLAIN ANALYZE is your primary tool for understanding query performance. It runs the query, collects timing information, and shows you the execution plan:

```sql
EXPLAIN ANALYZE SELECT * FROM startups WHERE category_id = 1;
```

The output looks something like this:

```
Seq Scan on startups  (cost=0.00..1.10 rows=2 width=200) (actual time=0.012..0.013 rows=2 loops=1)
  Filter: (category_id = 1)
  Rows Removed by Filter: 6
Planning Time: 0.045 ms
Execution Time: 0.025 ms
```

Here is what each part means:

- Seq Scan: The method PostgreSQL used. "Seq Scan" means it read every row. "Index Scan" or "Bitmap Index Scan" means it used an index.
- cost: Two numbers. The first is the startup cost, the second is the total estimated cost (in arbitrary units). Lower is better.
- rows: The estimated number of rows the step will return.
- actual time: Real-world timing in milliseconds. The first number is the time to return the first row, the second is the time to return all rows.
- Rows Removed by Filter: How many rows were read but did not match the WHERE condition. A high number here means the query is doing wasted work.
- Planning Time: How long the query planner took to decide on the execution plan.
- Execution Time: Total wall-clock time to run the query.

With our tiny dataset of 8 startups, the execution time is fractions of a millisecond and a sequential scan is fine. But the execution plan tells you what will happen at scale.

## Step by Step

### Step 1: Analyze Current Query Plans

Make sure your PostgreSQL container is running and the database is seeded from Lesson 7. Connect to the database:

```bash
docker compose exec postgres psql -U postgres -d launchpad
```

Run EXPLAIN ANALYZE on a query that filters startups by category:

```sql
EXPLAIN ANALYZE SELECT * FROM startups WHERE category_id = 1;
```

You will see a Seq Scan because there is no index on category_id. With 8 rows, the performance is fine, but the plan reveals the problem: PostgreSQL has to scan every row.

Try another common query -- finding startups by their founder:

```sql
EXPLAIN ANALYZE SELECT * FROM startups WHERE founder_id = 3;
```

Again, a Seq Scan. Both category_id and founder_id are foreign key columns that lack indexes.

Now try a query that does use an index:

```sql
EXPLAIN ANALYZE SELECT * FROM startups WHERE slug = 'codeflow';
```

This one uses an Index Scan because slug has a UNIQUE constraint (which creates an index automatically). You can see the difference in the plan.

### Step 2: Simulate a Larger Dataset

To see the real impact of indexes, you need more data. Run this SQL to generate 10,000 startup rows (you can run this directly in psql):

```sql
INSERT INTO startups (name, slug, tagline, description, category_id, founder_id, status, featured, created_at, updated_at)
SELECT
  'Startup ' || i,
  'startup-' || i,
  'Tagline for startup ' || i,
  'Description for startup ' || i || '. This is a longer description to simulate real data.',
  (i % 5) + 1,
  (i % 5) + 1,
  CASE WHEN i % 10 = 0 THEN 'pending' ELSE 'active' END,
  CASE WHEN i % 50 = 0 THEN true ELSE false END,
  NOW() - (i || ' hours')::interval,
  NOW() - (i || ' hours')::interval
FROM generate_series(100, 10099) AS s(i);
```

This inserts 10,000 rows with category_id values cycling through 1-5. Now run the category query again:

```sql
EXPLAIN ANALYZE SELECT * FROM startups WHERE category_id = 1;
```

The Seq Scan now takes noticeably longer because PostgreSQL reads all 10,000+ rows to find the ones matching category_id = 1. Pay attention to the "Rows Removed by Filter" number -- it will be around 8,000, meaning the database read 8,000 rows it did not need.

### Step 3: Add an Index on category_id Using Raw SQL

While still in psql, create an index:

```sql
CREATE INDEX idx_startups_category_id ON startups (category_id);
```

Run the same query:

```sql
EXPLAIN ANALYZE SELECT * FROM startups WHERE category_id = 1;
```

The plan now shows an Index Scan (or Bitmap Index Scan) instead of a Seq Scan. The "Rows Removed by Filter" drops to zero because the index points PostgreSQL directly to the matching rows. The execution time drops significantly.

Drop the index since we will recreate it properly in the Drizzle schema:

```sql
DROP INDEX idx_startups_category_id;
```

Also remove the test data:

```sql
DELETE FROM startups WHERE slug LIKE 'startup-%';
```

Exit psql:

```sql
\q
```

### Step 4: Add Indexes to the Drizzle Schema

Open src/db/schema.ts and add indexes to the tables that need them. In Drizzle you add indexes using the third argument of pgTable (the same function where you defined the unique_upvote index in Lesson 6).

Update the startups table:

```ts
import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  uniqueIndex,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

export const startups = pgTable(
  'startups',
  {
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
    featuredAt: timestamp('featured_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    categoryIdx: index('idx_startups_category_id').on(table.categoryId),
    founderIdx: index('idx_startups_founder_id').on(table.founderId),
    statusIdx: index('idx_startups_status').on(table.status),
    createdAtIdx: index('idx_startups_created_at').on(table.createdAt),
  })
);
```

We are adding four indexes:

- categoryIdx: Speeds up filtering startups by category (the most common browse query).
- founderIdx: Speeds up finding all startups by a specific founder (user profile pages).
- statusIdx: Speeds up filtering by status (showing only active or pending startups).
- createdAtIdx: Speeds up sorting by creation date (newest first listings).

### Step 5: Add Indexes to Comments and Upvotes

Update the comments table to index its foreign keys:

```ts
export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    content: text('content').notNull(),
    startupId: integer('startup_id')
      .notNull()
      .references(() => startups.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    startupIdx: index('idx_comments_startup_id').on(table.startupId),
    userIdx: index('idx_comments_user_id').on(table.userId),
  })
);
```

Update the upvotes table. It already has a unique index on (startupId, userId). Add an individual index on startupId for counting upvotes per startup:

```ts
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
    startupIdx: index('idx_upvotes_startup_id').on(table.startupId),
  })
);
```

### Step 6: Understand Composite Indexes

The unique_upvote index on (startupId, userId) is a composite index -- it covers two columns. Composite indexes follow a "leftmost prefix" rule: a composite index on (A, B) can be used for queries that filter on A alone, or on both A and B, but not for queries that filter only on B.

This means our unique_upvote index on (startupId, userId) already helps with queries like:

```sql
SELECT * FROM upvotes WHERE startup_id = 5;
```

But it would NOT help with:

```sql
SELECT * FROM upvotes WHERE user_id = 3;
```

If you frequently query upvotes by user_id alone (for example, "show me all startups this user upvoted"), you would need a separate index on user_id. Think about your access patterns and create indexes that match them.

### Step 7: Generate and Apply the Migration

Generate a migration for the new indexes:

```bash
npm run db:generate
```

Review the generated SQL file. It should contain CREATE INDEX statements for each index you defined. It should not recreate the tables since only indexes changed.

Apply the migration:

```bash
npm run db:migrate
```

### Step 8: Verify the Indexes Exist

Connect to psql and list all indexes on the startups table:

```bash
docker compose exec postgres psql -U postgres -d launchpad -c "\di"
```

You should see your new indexes listed alongside the automatic ones for primary keys and unique constraints.

### Step 9: Measure the Impact

Connect to psql and insert test data again:

```sql
INSERT INTO startups (name, slug, tagline, description, category_id, founder_id, status, featured, created_at, updated_at)
SELECT
  'Startup ' || i,
  'startup-' || i,
  'Tagline for startup ' || i,
  'Description for startup ' || i || '. This is a longer description to simulate real data.',
  (i % 5) + 1,
  (i % 5) + 1,
  CASE WHEN i % 10 = 0 THEN 'pending' ELSE 'active' END,
  CASE WHEN i % 50 = 0 THEN true ELSE false END,
  NOW() - (i || ' hours')::interval,
  NOW() - (i || ' hours')::interval
FROM generate_series(100, 10099) AS s(i);
```

Now run the same query with EXPLAIN ANALYZE:

```sql
EXPLAIN ANALYZE SELECT * FROM startups WHERE category_id = 1;
```

This time you should see an Index Scan or Bitmap Index Scan right away. Compare the execution time and "Rows Removed by Filter" to what you saw in Step 2.

Try sorting by created_at:

```sql
EXPLAIN ANALYZE SELECT * FROM startups WHERE status = 'active' ORDER BY created_at DESC LIMIT 20;
```

The index on created_at helps PostgreSQL avoid sorting the entire result set. Without the index, PostgreSQL would have to read all matching rows and then sort them. With the index, it can read rows in order and stop after 20.

Clean up the test data when you are done:

```sql
DELETE FROM startups WHERE slug LIKE 'startup-%';
```

### Step 10: When NOT to Add Indexes

Indexes are not free. Every index has costs:

Write overhead: Every INSERT, UPDATE, or DELETE must also update every index on that table. A table with 10 indexes is significantly slower to write to than a table with 2 indexes.

Storage: Each index takes up disk space. For a large table, indexes can use as much storage as the table itself.

Maintenance: PostgreSQL runs VACUUM and ANALYZE operations on indexes. More indexes mean more background maintenance work.

Here are guidelines for when to skip indexing:

- Small tables: A table with a few hundred rows (like our categories table) does not benefit from indexes beyond the primary key. PostgreSQL can scan the whole table faster than it can traverse an index tree.
- Rarely queried columns: If a column is only used in bulk exports or admin reports that run once a day, the write overhead of an index is not justified by occasional read savings.
- Low-cardinality columns: A boolean column like "featured" has only two possible values. An index on it provides little selectivity. However, a partial index (CREATE INDEX ... WHERE featured = true) can be useful if the true value is rare.
- Columns in write-heavy tables: If a table receives thousands of inserts per second, every additional index multiplies the write cost.

The rule of thumb is: index columns that appear in WHERE clauses, JOIN conditions, and ORDER BY clauses of your most frequent queries. Do not index everything "just in case."

## Exercise

1. Connect to psql and run EXPLAIN ANALYZE on this query without any changes:

```sql
EXPLAIN ANALYZE SELECT * FROM comments WHERE user_id = 1 ORDER BY created_at DESC;
```

Note the execution plan and timing.

2. Verify that the index on comments.user_id is being used. If the dataset is too small for PostgreSQL to choose the index, insert 5,000 test comments and try again.

3. Add a composite index on the startups table covering (status, created_at). This helps the common query pattern "show active startups sorted by newest first." Update schema.ts, generate a migration, and apply it.

4. Run EXPLAIN ANALYZE on this query before and after adding the composite index:

```sql
EXPLAIN ANALYZE SELECT * FROM startups WHERE status = 'active' ORDER BY created_at DESC LIMIT 20;
```

Document the difference in execution plan and timing.

5. Think about the upvotes table. If you wanted to build a "trending today" feature that counts upvotes created in the last 24 hours per startup, which column(s) would you index? Add the index to schema.ts and test it.

## Key Takeaways

- Indexes are separate data structures (usually B-trees) that allow PostgreSQL to find rows without scanning the entire table.
- PostgreSQL automatically indexes primary keys and unique constraints but does NOT automatically index foreign keys.
- EXPLAIN ANALYZE is the essential tool for understanding how PostgreSQL executes a query. Always check the plan for important queries.
- Add indexes to columns that appear in WHERE clauses, JOIN conditions, and ORDER BY clauses of your most frequent queries.
- Composite indexes follow the leftmost prefix rule: an index on (A, B) helps queries on A and (A, B) but not B alone.
- Every index has a write cost. Do not over-index -- focus on the queries that matter most to your application.
- Measure before and after. Never assume an index helps; verify it with EXPLAIN ANALYZE.

## Summary

You learned how B-tree indexes work, how PostgreSQL decides whether to use them, and how to read EXPLAIN ANALYZE output. You added indexes to the LaunchPad schema for frequently queried columns -- category_id, founder_id, status, and created_at on startups, plus foreign key indexes on comments and upvotes. You generated and applied a migration for the new indexes, tested them against a larger dataset, and saw the execution plan change from Seq Scan to Index Scan. You also learned when indexes are not appropriate and the write-performance tradeoffs they introduce.

In the next lesson you will put your indexed database to work with complex queries. You will write joins, aggregations, CTEs, and window functions using Drizzle to build real features like trending startups, category statistics, and user activity summaries.
