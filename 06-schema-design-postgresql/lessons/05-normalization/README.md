# 05 — Normalization

When you design a database, you face a constant tension: should you store a piece of data once and look it up when needed, or store it in multiple places for convenience? Normalization is the formal process of organizing tables to reduce redundancy and prevent data anomalies. It sounds academic, but the problems it solves are very practical -- duplicate data drifting out of sync, updates that miss some rows, and deletes that accidentally destroy unrelated information. In this lesson you will learn the three normal forms (1NF, 2NF, 3NF), see how the LaunchPad schema already follows them, and understand when it makes sense to deliberately break normal forms for performance.

## What You Will Learn

- What normalization is and why it matters for data integrity
- First Normal Form (1NF): atomic values and no repeating groups
- Second Normal Form (2NF): eliminating partial dependencies
- Third Normal Form (3NF): eliminating transitive dependencies
- How the LaunchPad schema (users, startups, categories, comments, upvotes) demonstrates each normal form
- What denormalization is and when to use it as a deliberate trade-off
- Common denormalization patterns in real-world applications

## Key Concepts

### Why Normalize?

Imagine a single flat table that stores everything about a startup:

```
| startup_name | founder_name | founder_email      | category_name    | tag1          | tag2     | comment1_text        | comment1_user  |
|-------------|-------------|-------------------|-----------------|--------------|---------|---------------------|---------------|
| CodeFlow    | Alice Johnson| alice@example.com  | Developer Tools  | open-source  | ai      | Great tool!          | Bob Smith     |
| PromptLab   | Eva Martinez | eva@example.com    | AI & ML          | ai           | saas    | Love the comparison  | Alice Johnson |
```

This looks simple, but it has serious problems:

Update anomaly: If Alice changes her email, you must find and update every row where she is listed as a founder. Miss one and the data is inconsistent.

Insert anomaly: You cannot add a new category unless a startup exists for it. The category only lives as a column value on a startup row.

Delete anomaly: If you delete the only startup in a category, the category itself disappears from the database.

Repeating groups: The tag1, tag2 columns are a fixed number of slots. What happens when a startup needs four tags? You add more columns, and most rows leave them empty.

Normalization eliminates these problems by splitting the data into separate, focused tables connected by relationships.

### First Normal Form (1NF)

A table is in 1NF when:

- Every column contains atomic (single) values -- no lists, arrays, or nested structures
- Every row is unique (has a primary key)
- There are no repeating groups of columns

Consider a badly designed startups table that violates 1NF:

```sql
CREATE TABLE startups_bad (
  id serial PRIMARY KEY,
  name varchar(255),
  founder_name varchar(255),
  founder_email varchar(255),
  tags varchar(500),         -- comma-separated: "ai, open-source, saas"
  category_name varchar(100)
);
```

The tags column violates 1NF because it stores multiple values in a single field. To find all startups tagged "ai", you would need a LIKE query:

```sql
SELECT * FROM startups_bad WHERE tags LIKE '%ai%';
```

This is slow (cannot use a regular index), error-prone (matches "flair" because it contains "ai"), and makes it impossible to enforce uniqueness or foreign key constraints on individual tags.

The LaunchPad schema is in 1NF. Every column holds a single value. Tags would be handled via a separate tags table and a join table (as discussed in the relationships lesson), not as a comma-separated string. Each table has a primary key (the id column), and there are no repeating groups like tag1, tag2, tag3.

Look at the users table:

```ts
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

Every column holds one value. The name column holds one name. The email column holds one email. There are no columns like phone1, phone2 or address_line_1, address_line_2 that suggest repeating groups. This is clean 1NF.

### Second Normal Form (2NF)

A table is in 2NF when:

- It is already in 1NF
- Every non-key column depends on the entire primary key, not just part of it

2NF violations only occur in tables with composite primary keys (primary keys made of multiple columns). If your primary key is a single column (like our serial id), the table is automatically in 2NF because there is no "part of the key" to depend on.

Where 2NF matters in LaunchPad is the upvotes table. Imagine if the upvotes table also stored the startup name:

```sql
CREATE TABLE upvotes_bad (
  startup_id integer REFERENCES startups(id),
  user_id integer REFERENCES users(id),
  startup_name varchar(255),    -- violation!
  created_at timestamp DEFAULT now(),
  PRIMARY KEY (startup_id, user_id)
);
```

If we use (startup_id, user_id) as the composite primary key, then startup_name depends only on startup_id, not on the full key. This is a partial dependency -- it violates 2NF. The startup name belongs in the startups table, not in the upvotes table.

The actual LaunchPad upvotes table is properly normalized:

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

It stores only the foreign keys and a timestamp. The startup name, user name, and all other details live in their respective tables and are fetched through joins when needed.

### Third Normal Form (3NF)

A table is in 3NF when:

- It is already in 2NF
- No non-key column depends on another non-key column (no transitive dependencies)

A transitive dependency is when column A determines column B, which determines column C. Column C transitively depends on column A through column B.

Consider this hypothetical startups table:

```sql
CREATE TABLE startups_bad (
  id serial PRIMARY KEY,
  name varchar(255),
  category_id integer,
  category_name varchar(100),   -- violation!
  category_slug varchar(100),   -- violation!
  founder_id integer,
  founder_name varchar(255),    -- violation!
  status varchar(20)
);
```

The category_name and category_slug columns depend on category_id, not on the startup's primary key. If you change a category's name, you would have to update every startup row in that category. This is a transitive dependency: startup.id -> startup.category_id -> category_name.

Similarly, founder_name depends on founder_id, not on the startup.

The LaunchPad schema avoids these problems by storing category_id and founder_id as foreign keys and keeping the category details in the categories table and user details in the users table:

```ts
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

Category name, slug, and description live here -- in one place. When you rename "AI & Machine Learning" to "Artificial Intelligence", you update one row and every startup in that category immediately reflects the change.

The startups table stores only the reference:

```ts
categoryId: integer('category_id')
  .notNull()
  .references(() => categories.id),
```

This is 3NF. No non-key column in the startups table depends on another non-key column. Every column either is the primary key, is a foreign key pointing to another table, or is a direct attribute of the startup itself (name, slug, tagline, description, status, featured).

### How the LaunchPad Schema Demonstrates All Three Forms

Here is a summary of how each table satisfies the normal forms:

Users table (1NF, 2NF, 3NF): All values are atomic. Single-column primary key makes 2NF automatic. No column depends on another non-key column -- name, email, bio, and avatarUrl are all independent attributes of the user.

Categories table (1NF, 2NF, 3NF): Atomic values, single primary key, and each column (name, slug, description) describes the category directly.

Startups table (1NF, 2NF, 3NF): Atomic values, single primary key. The categoryId and founderId columns are foreign keys that reference other tables rather than duplicating their data. Status, featured, name, slug, tagline, and description are all direct attributes of the startup.

Comments table (1NF, 2NF, 3NF): Stores only the comment content and foreign keys to the startup and user. No user name or startup name is duplicated here.

Upvotes table (1NF, 2NF, 3NF): Contains only foreign keys and a timestamp. The unique index on (startupId, userId) enforces the business rule without duplicating data from either table.

### When Normalization Costs Too Much

Normalization optimizes for data integrity and write correctness. But every join costs time. In a fully normalized schema, displaying a startup listing page might require joining startups with users, categories, comments, and upvotes -- five tables in one query.

For most applications with reasonable data volumes (under a few million rows per table), these joins are fast, especially with proper indexes. PostgreSQL is built for this workload.

But there are scenarios where the join cost becomes a problem:

High-traffic read paths: A landing page that shows 20 startups with founder names, category names, comment counts, and upvote counts. If this page receives thousands of requests per second, the five-table join runs thousands of times per second.

Reporting and analytics: Queries that aggregate data across millions of rows. A report that calculates "average upvotes per category per month" might scan the entire upvotes table and join it with startups and categories.

Search results: Full-text search results that need to display data from multiple tables. Joining during search adds latency to an already-expensive operation.

### Denormalization: Breaking Normal Forms on Purpose

Denormalization is the deliberate introduction of redundancy to improve read performance. You store derived or duplicated data in a table to avoid computing it with a join or aggregation at query time.

Common denormalization patterns:

Storing a computed count. Instead of running `SELECT count(*) FROM upvotes WHERE startup_id = ?` every time you display a startup, you could add an upvote_count column to the startups table and increment it when an upvote is added:

```sql
-- Adding a denormalized counter
ALTER TABLE startups ADD COLUMN upvote_count integer DEFAULT 0 NOT NULL;

-- Incrementing on new upvote
UPDATE startups SET upvote_count = upvote_count + 1 WHERE id = ?;
```

The trade-off: you now maintain the count in two places (the upvotes table and the startups.upvote_count column). If they ever get out of sync, you have inconsistent data.

Storing a snapshot of related data. An order table might copy the product name and price at the time of purchase rather than referencing the products table. This is valid because the product name and price might change in the future, and the order should reflect the historical value.

Materialized views. PostgreSQL supports materialized views, which are precomputed query results stored as tables. You refresh them periodically:

```sql
CREATE MATERIALIZED VIEW category_stats AS
SELECT
  c.id AS category_id,
  c.name AS category_name,
  count(s.id) AS startup_count,
  count(DISTINCT s.founder_id) AS founder_count
FROM categories c
LEFT JOIN startups s ON s.category_id = c.id
GROUP BY c.id, c.name;

-- Refresh when data changes
REFRESH MATERIALIZED VIEW category_stats;
```

This is denormalization managed by the database. The view stores redundant data (the counts), but you refresh it explicitly rather than maintaining it on every write.

### Rules of Thumb for Denormalization

Start normalized. Always begin with a normalized schema and only denormalize when you have measured a performance problem. Premature denormalization adds complexity without proven benefit.

Denormalize read-heavy, write-light data. If a value is read 1,000 times for every write, caching or denormalizing it makes sense. If it changes frequently, keeping it normalized and computing it on the fly is simpler and more reliable.

Use database features. PostgreSQL's materialized views, generated columns, and trigger-maintained counters are safer than application-level denormalization because the database keeps the redundant data in sync.

Document every denormalization. When you deliberately break a normal form, leave a comment explaining why and how the data stays in sync. Future developers (including your future self) need to know that a column is redundant and which process maintains it.

### Normalization Beyond 3NF

There are higher normal forms (BCNF, 4NF, 5NF), but they address increasingly rare edge cases. For virtually all web applications, 3NF is sufficient. The patterns that violate BCNF or 4NF involve complex multi-column dependencies that rarely appear in typical application schemas.

If your tables are in 3NF, you have eliminated the vast majority of redundancy and data anomaly risks. That is where the LaunchPad schema sits, and it is the standard to aim for in application development.

## Step by Step

### Step 1: Identify 1NF in the LaunchPad Schema

Open `backend/src/db/schema.ts`. Go through each table and verify that every column holds a single value:

- users: name is one string, email is one string, bio is one string. No arrays, no comma-separated lists.
- categories: name, slug, and description are all single values.
- startups: name, slug, tagline, description are all single values. Status is a single string, not a set of statuses.
- comments: content is one string.
- upvotes: just foreign keys and a timestamp.

None of these tables have columns like tags (comma-separated), phone_numbers (array), or repeated column groups like comment_1, comment_2. The schema is in 1NF.

### Step 2: Verify 2NF by Checking Dependencies

Look at each table with a composite key or unique constraint:

The upvotes table has a unique index on (startupId, userId). Does any non-key column depend on only part of this pair? The only other column is createdAt, which records when the upvote was created. It depends on the full pair (the specific act of user X upvoting startup Y), not on just the startup or just the user. This satisfies 2NF.

All other tables use a single-column primary key (id), so 2NF is automatically satisfied.

### Step 3: Verify 3NF by Checking Transitive Dependencies

Look at the startups table. Does any non-key column determine another non-key column?

- categoryId determines the category name, but the category name is not stored in the startups table. It is in the categories table. No violation.
- founderId determines the founder name, but the founder name is in the users table. No violation.
- status is independent of name, slug, tagline, etc.
- featured is independent of all other columns.

Now check the comments table:

- startupId determines the startup name, but the startup name is not stored here.
- userId determines the user name, but the user name is not stored here.
- content is an independent attribute of the comment itself.

Every table passes the 3NF check. No non-key column depends on another non-key column.

### Step 4: Create a Denormalized Version to See the Difference

For learning purposes, create a denormalized view that flattens the startup data:

```sql
CREATE VIEW startups_denormalized AS
SELECT
  s.id,
  s.name AS startup_name,
  s.tagline,
  s.status,
  u.name AS founder_name,
  u.email AS founder_email,
  c.name AS category_name,
  c.slug AS category_slug,
  (SELECT count(*) FROM comments cm WHERE cm.startup_id = s.id) AS comment_count,
  (SELECT count(*) FROM upvotes up WHERE up.startup_id = s.id) AS upvote_count
FROM startups s
JOIN users u ON s.founder_id = u.id
JOIN categories c ON s.category_id = c.id;
```

Query the view:

```sql
SELECT * FROM startups_denormalized;
```

This gives you a flat, easy-to-read result. But remember: this is a regular view (not materialized), so the joins and subqueries run every time you query it. The normalized source tables are still the single source of truth.

### Step 5: Experiment with a Materialized View

Convert the view to a materialized view for faster reads:

```sql
DROP VIEW startups_denormalized;

CREATE MATERIALIZED VIEW startups_denormalized AS
SELECT
  s.id,
  s.name AS startup_name,
  s.tagline,
  s.status,
  u.name AS founder_name,
  u.email AS founder_email,
  c.name AS category_name,
  c.slug AS category_slug,
  (SELECT count(*) FROM comments cm WHERE cm.startup_id = s.id) AS comment_count,
  (SELECT count(*) FROM upvotes up WHERE up.startup_id = s.id) AS upvote_count
FROM startups s
JOIN users u ON s.founder_id = u.id
JOIN categories c ON s.category_id = c.id;
```

The materialized view stores the result physically. Queries against it are fast because there are no joins at query time. But the data becomes stale when the underlying tables change. To refresh:

```sql
REFRESH MATERIALIZED VIEW startups_denormalized;
```

You would typically refresh materialized views on a schedule (e.g., every minute) or after batch updates.

### Step 6: Compare Query Performance

With the seeded data, run both approaches and compare:

Normalized query (live joins):

```sql
EXPLAIN ANALYZE
SELECT
  s.name, u.name AS founder, c.name AS category,
  count(DISTINCT up.id) AS upvotes
FROM startups s
JOIN users u ON s.founder_id = u.id
JOIN categories c ON s.category_id = c.id
LEFT JOIN upvotes up ON up.startup_id = s.id
GROUP BY s.name, u.name, c.name;
```

Denormalized query (materialized view):

```sql
EXPLAIN ANALYZE
SELECT startup_name, founder_name, category_name, upvote_count
FROM startups_denormalized;
```

With our small dataset, both are fast. The difference becomes significant at scale. The materialized view query does a simple sequential scan with no joins. The normalized query must hash-join four tables and aggregate.

Clean up:

```sql
DROP MATERIALIZED VIEW startups_denormalized;
```

## Exercise

1. Create a deliberately denormalized table called startups_flat that stores startup name, founder name, founder email, category name, and category slug all in one table (no foreign keys). Insert three rows of data.

2. Update a founder's name in the users table. Observe that the denormalized startups_flat table still has the old name. This is the update anomaly that normalization prevents.

3. Write a query that detects inconsistencies between the startups_flat table and the normalized tables. For example, find rows where startups_flat.founder_name does not match the actual user name.

4. Drop the startups_flat table. Think about where in a real application you would use denormalization and document your reasoning.

5. Create a materialized view called category_leaderboard that shows each category with its startup count and total upvote count. Refresh it, then query it to see the results.

## Summary

Normalization is the process of organizing database tables to eliminate redundancy and prevent data anomalies. First Normal Form requires atomic values and no repeating groups. Second Normal Form requires that every non-key column depends on the entire primary key. Third Normal Form requires that no non-key column depends on another non-key column. The LaunchPad schema satisfies all three forms: users, categories, startups, comments, and upvotes each store only their own direct attributes plus foreign keys to reference related data. Denormalization is the deliberate reintroduction of redundancy for read performance. Common patterns include computed counters, snapshot columns, and materialized views. The rule is to start normalized, measure performance, and denormalize only when you have evidence that join costs are a bottleneck. When you do denormalize, use database features like materialized views and triggers to keep redundant data in sync, and document every deviation from the normalized form.
