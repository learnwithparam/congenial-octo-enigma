# 09 — Complex Queries

You have tables, relationships, indexes, and seed data. Now it is time to write queries that answer real questions about your data. Simple SELECT statements get you started, but production applications need joins across multiple tables, aggregations with GROUP BY, subqueries, common table expressions (CTEs), and window functions. In this lesson you will learn each of these techniques using the LaunchPad schema, writing them first in raw SQL to understand the fundamentals, then translating them to Drizzle ORM's query builder.

## What You Will Learn

- INNER JOIN, LEFT JOIN, and RIGHT JOIN -- when to use each and what data they include or exclude
- Subqueries in SELECT, WHERE, and FROM clauses
- Common Table Expressions (CTEs) with the WITH keyword for readable multi-step queries
- Window functions for ranking, running totals, and comparisons within groups
- How to write each pattern using Drizzle's query builder
- When to use Drizzle's relational API vs. the select-join builder vs. raw SQL

## Key Concepts

### JOIN Types

A JOIN combines rows from two tables based on a condition. The type of join determines what happens when a row in one table has no matching row in the other.

INNER JOIN returns only rows where both tables have a match. If a category has no startups, the category row is excluded entirely:

```sql
SELECT s.name AS startup, c.name AS category
FROM startups s
INNER JOIN categories c ON s.category_id = c.id;
```

This returns every startup with its category. If a startup somehow had a null category_id (it cannot in our schema because of NOT NULL, but hypothetically), it would be excluded.

LEFT JOIN returns all rows from the left table, plus matched rows from the right table. If there is no match, the right-side columns are null:

```sql
SELECT c.name AS category, s.name AS startup
FROM categories c
LEFT JOIN startups s ON s.category_id = c.id;
```

This returns every category, even those with no startups. Categories without startups have null in the startup column. LEFT JOIN is the workhorse of reporting queries because it preserves the "base" table completely.

RIGHT JOIN is the mirror of LEFT JOIN -- it returns all rows from the right table. In practice, most developers rewrite RIGHT JOINs as LEFT JOINs by swapping the table order. You will rarely see RIGHT JOIN in production code.

FULL OUTER JOIN returns all rows from both tables, with nulls where there is no match on either side. It is useful for finding orphaned records but rarely needed in application queries.

The LaunchPad codebase uses LEFT JOIN in index.ts for counting startups per category:

```ts
const categoryCounts = await db
  .select({
    category: categories.name,
    count: count(startups.id),
  })
  .from(categories)
  .leftJoin(startups, eq(startups.categoryId, categories.id))
  .groupBy(categories.name)
  .orderBy(desc(count(startups.id)));
```

The LEFT JOIN ensures categories with zero startups appear in the results with a count of 0.

### Aggregation with GROUP BY

GROUP BY collapses rows that share the same value into a single row, allowing aggregate functions like count(), sum(), avg(), min(), and max() to compute values over each group.

Count startups per category:

```sql
SELECT c.name AS category, count(s.id) AS startup_count
FROM categories c
LEFT JOIN startups s ON s.category_id = c.id
GROUP BY c.name
ORDER BY startup_count DESC;
```

Every column in the SELECT must either be in the GROUP BY clause or inside an aggregate function. You cannot select s.name here because there are multiple startup names per category, and PostgreSQL does not know which one to show.

HAVING filters groups after aggregation (unlike WHERE, which filters rows before aggregation):

```sql
SELECT c.name AS category, count(s.id) AS startup_count
FROM categories c
LEFT JOIN startups s ON s.category_id = c.id
GROUP BY c.name
HAVING count(s.id) >= 2
ORDER BY startup_count DESC;
```

This returns only categories with two or more startups.

In Drizzle, HAVING uses the `.having()` method:

```ts
const popularCategories = await db
  .select({
    category: categories.name,
    startupCount: count(startups.id),
  })
  .from(categories)
  .leftJoin(startups, eq(startups.categoryId, categories.id))
  .groupBy(categories.name)
  .having(sql`count(${startups.id}) >= 2`)
  .orderBy(desc(count(startups.id)));
```

### Subqueries

A subquery is a SELECT statement nested inside another query. Subqueries can appear in three places:

In the WHERE clause (filter based on another query):

```sql
-- Find startups with more than the average number of upvotes
SELECT s.name, s.tagline
FROM startups s
WHERE (
  SELECT count(*) FROM upvotes u WHERE u.startup_id = s.id
) > (
  SELECT avg(upvote_count) FROM (
    SELECT count(*) AS upvote_count
    FROM upvotes
    GROUP BY startup_id
  ) sub
);
```

In the SELECT clause (compute a value per row):

```sql
SELECT
  s.name,
  s.tagline,
  (SELECT count(*) FROM upvotes u WHERE u.startup_id = s.id) AS upvote_count,
  (SELECT count(*) FROM comments c WHERE c.startup_id = s.id) AS comment_count
FROM startups s
WHERE s.status = 'active'
ORDER BY upvote_count DESC;
```

This is called a correlated subquery because the inner query references the outer query's row (s.id). PostgreSQL runs the subquery once for each row in the outer query. For small tables this is fine; for large tables, a JOIN with GROUP BY is usually faster.

In the FROM clause (treat a query result as a temporary table):

```sql
SELECT ranked.name, ranked.upvote_count
FROM (
  SELECT s.name, count(u.id) AS upvote_count
  FROM startups s
  LEFT JOIN upvotes u ON u.startup_id = s.id
  GROUP BY s.name
) AS ranked
WHERE ranked.upvote_count > 2;
```

In Drizzle, you can write subqueries using the `sql` template literal:

```ts
import { sql, eq, desc } from 'drizzle-orm';

const startupsWithCounts = await db
  .select({
    name: startups.name,
    tagline: startups.tagline,
    upvoteCount: sql<number>`(SELECT count(*) FROM upvotes WHERE startup_id = ${startups.id})`,
    commentCount: sql<number>`(SELECT count(*) FROM comments WHERE startup_id = ${startups.id})`,
  })
  .from(startups)
  .where(eq(startups.status, 'active'))
  .orderBy(desc(sql`(SELECT count(*) FROM upvotes WHERE startup_id = ${startups.id})`));
```

The `sql<number>` generic tells TypeScript that the result is a number.

### Common Table Expressions (CTEs)

A CTE (Common Table Expression) uses the WITH keyword to define a named temporary result set that you can reference later in the query. CTEs make complex queries readable by breaking them into logical steps.

Find the top startup in each category by upvote count:

```sql
WITH upvote_counts AS (
  SELECT
    s.id AS startup_id,
    s.name AS startup_name,
    s.category_id,
    count(u.id) AS upvotes
  FROM startups s
  LEFT JOIN upvotes u ON u.startup_id = s.id
  WHERE s.status = 'active'
  GROUP BY s.id, s.name, s.category_id
),
ranked AS (
  SELECT
    uc.startup_name,
    uc.category_id,
    uc.upvotes,
    ROW_NUMBER() OVER (PARTITION BY uc.category_id ORDER BY uc.upvotes DESC) AS rank
  FROM upvote_counts uc
)
SELECT r.startup_name, c.name AS category, r.upvotes
FROM ranked r
JOIN categories c ON r.category_id = c.id
WHERE r.rank = 1
ORDER BY r.upvotes DESC;
```

This query has three logical steps:

1. upvote_counts: Count upvotes per startup.
2. ranked: Assign a rank within each category using a window function.
3. Final SELECT: Pick the rank-1 startup from each category.

Without CTEs, you would nest subqueries inside subqueries, making the query much harder to read and debug.

In Drizzle, you write CTEs using raw SQL because Drizzle's query builder does not have native CTE support:

```ts
const topPerCategory = await db.execute(sql`
  WITH upvote_counts AS (
    SELECT
      s.id AS startup_id,
      s.name AS startup_name,
      s.category_id,
      count(u.id) AS upvotes
    FROM startups s
    LEFT JOIN upvotes u ON u.startup_id = s.id
    WHERE s.status = 'active'
    GROUP BY s.id, s.name, s.category_id
  ),
  ranked AS (
    SELECT
      uc.startup_name,
      uc.category_id,
      uc.upvotes,
      ROW_NUMBER() OVER (PARTITION BY uc.category_id ORDER BY uc.upvotes DESC) AS rank
    FROM upvote_counts uc
  )
  SELECT r.startup_name, c.name AS category, r.upvotes
  FROM ranked r
  JOIN categories c ON r.category_id = c.id
  WHERE r.rank = 1
  ORDER BY r.upvotes DESC
`);
```

### Window Functions

Window functions perform calculations across a set of rows related to the current row, without collapsing rows like GROUP BY does. Every row in the result keeps its identity, but each row also gets the computed value.

The syntax is:

```sql
function_name() OVER (
  PARTITION BY column   -- optional: divide rows into groups
  ORDER BY column       -- optional: define ordering within each group
)
```

ROW_NUMBER() assigns a sequential number to rows within each partition:

```sql
SELECT
  s.name,
  c.name AS category,
  count(u.id) AS upvotes,
  ROW_NUMBER() OVER (PARTITION BY s.category_id ORDER BY count(u.id) DESC) AS category_rank
FROM startups s
JOIN categories c ON s.category_id = c.id
LEFT JOIN upvotes u ON u.startup_id = s.id
WHERE s.status = 'active'
GROUP BY s.id, s.name, c.name, s.category_id
ORDER BY c.name, category_rank;
```

This shows every active startup with its rank within its category by upvote count. CodeFlow might be rank 1 in Developer Tools while PromptLab is rank 1 in AI & Machine Learning.

RANK() is similar to ROW_NUMBER() but assigns the same rank to ties. If two startups have 3 upvotes, they both get rank 1, and the next startup gets rank 3 (skipping 2).

DENSE_RANK() is like RANK() but does not skip numbers. Two startups tied at rank 1 are followed by rank 2.

Running totals with SUM() OVER:

```sql
SELECT
  s.name,
  s.created_at::date AS launch_date,
  count(u.id) AS daily_upvotes,
  SUM(count(u.id)) OVER (ORDER BY s.created_at::date) AS running_total
FROM startups s
LEFT JOIN upvotes u ON u.startup_id = s.id
GROUP BY s.id, s.name, s.created_at
ORDER BY s.created_at;
```

The SUM() OVER (ORDER BY ...) computes a cumulative sum. Each row shows the total upvotes up to and including that day.

LAG() and LEAD() access values from previous or next rows:

```sql
SELECT
  s.name,
  count(u.id) AS upvotes,
  LAG(count(u.id)) OVER (ORDER BY count(u.id) DESC) AS prev_startup_upvotes,
  count(u.id) - LAG(count(u.id)) OVER (ORDER BY count(u.id) DESC) AS gap
FROM startups s
LEFT JOIN upvotes u ON u.startup_id = s.id
GROUP BY s.id, s.name
ORDER BY upvotes DESC;
```

LAG() shows the upvote count of the previous startup in the ranking, and the gap column shows the difference. This is useful for leaderboard-style displays.

### Practical Query Patterns for LaunchPad

Here are queries that solve real feature requirements.

Users who submitted a startup in the last 7 days:

```sql
SELECT DISTINCT u.name, u.email, s.name AS startup_name, s.created_at
FROM users u
JOIN startups s ON s.founder_id = u.id
WHERE s.created_at >= now() - interval '7 days'
ORDER BY s.created_at DESC;
```

In Drizzle:

```ts
import { gte, desc } from 'drizzle-orm';

const recentFounders = await db
  .selectDistinct({
    userName: users.name,
    email: users.email,
    startupName: startups.name,
    createdAt: startups.createdAt,
  })
  .from(users)
  .innerJoin(startups, eq(startups.founderId, users.id))
  .where(gte(startups.createdAt, sql`now() - interval '7 days'`))
  .orderBy(desc(startups.createdAt));
```

Most active commenters (users ranked by comment count):

```sql
SELECT u.name, count(c.id) AS comment_count
FROM users u
LEFT JOIN comments c ON c.user_id = u.id
GROUP BY u.id, u.name
ORDER BY comment_count DESC
LIMIT 10;
```

In Drizzle:

```ts
const topCommenters = await db
  .select({
    name: users.name,
    commentCount: count(comments.id),
  })
  .from(users)
  .leftJoin(comments, eq(comments.userId, users.id))
  .groupBy(users.id, users.name)
  .orderBy(desc(count(comments.id)))
  .limit(10);
```

Trending startups (most upvoted in the last 24 hours):

```sql
SELECT s.name, s.tagline, count(u.id) AS recent_upvotes
FROM startups s
JOIN upvotes u ON u.startup_id = s.id
WHERE u.created_at >= now() - interval '24 hours'
GROUP BY s.id, s.name, s.tagline
ORDER BY recent_upvotes DESC
LIMIT 10;
```

Category leaderboard with CTE:

```sql
WITH category_stats AS (
  SELECT
    c.id AS category_id,
    c.name AS category_name,
    count(DISTINCT s.id) AS startup_count,
    count(DISTINCT u.id) AS upvote_count
  FROM categories c
  LEFT JOIN startups s ON s.category_id = c.id AND s.status = 'active'
  LEFT JOIN upvotes u ON u.startup_id = s.id
  GROUP BY c.id, c.name
)
SELECT
  category_name,
  startup_count,
  upvote_count,
  ROUND(upvote_count::numeric / NULLIF(startup_count, 0), 2) AS avg_upvotes_per_startup
FROM category_stats
ORDER BY upvote_count DESC;
```

The NULLIF(startup_count, 0) prevents division by zero for categories with no startups.

### Drizzle Query Builder vs. Relational API vs. Raw SQL

Drizzle gives you three ways to query data. Each has a sweet spot.

The relational API (db.query) is best for fetching entities with their related data. Use it when you want "a startup with its founder, category, and comments." It generates efficient queries and gives you typed results:

```ts
const startup = await db.query.startups.findFirst({
  where: eq(startups.slug, 'codeflow'),
  with: {
    founder: true,
    category: true,
    comments: { with: { user: true } },
    upvotes: true,
  },
});
```

The select-join builder (db.select().from().join()) is best for aggregations, counts, and queries that do not map to a single entity. Use it when you need GROUP BY, HAVING, or custom column selections:

```ts
const categoryCounts = await db
  .select({
    category: categories.name,
    count: count(startups.id),
  })
  .from(categories)
  .leftJoin(startups, eq(startups.categoryId, categories.id))
  .groupBy(categories.name);
```

Raw SQL (db.execute(sql`...`)) is best for CTEs, window functions, and queries that are awkward or impossible to express with the builder. Use it when the query is complex enough that the builder adds more confusion than clarity:

```ts
const result = await db.execute(sql`
  WITH ranked AS (
    SELECT name, category_id,
      ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at DESC) AS rn
    FROM startups
    WHERE status = 'active'
  )
  SELECT * FROM ranked WHERE rn <= 3
`);
```

There is no shame in using raw SQL for complex queries. The query builder is a convenience, not a requirement. If the SQL is clearer, use the SQL.

## Step by Step

### Step 1: Set Up and Verify Data

Make sure the database is running and seeded:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
```

Connect to psql to experiment with raw SQL:

```bash
docker compose exec postgres psql -U postgres -d launchpad
```

Verify the data:

```sql
SELECT count(*) FROM startups;   -- should be 8
SELECT count(*) FROM users;      -- should be 5
SELECT count(*) FROM upvotes;    -- should be 21
SELECT count(*) FROM comments;   -- should be 10
```

### Step 2: Write JOIN Queries

Start with a basic INNER JOIN to see startups with their founders:

```sql
SELECT s.name AS startup, s.tagline, u.name AS founder
FROM startups s
INNER JOIN users u ON s.founder_id = u.id
WHERE s.status = 'active'
ORDER BY s.name;
```

Now use a LEFT JOIN to include categories that might not have startups:

```sql
SELECT c.name AS category, count(s.id) AS startup_count
FROM categories c
LEFT JOIN startups s ON s.category_id = c.id
GROUP BY c.name
ORDER BY startup_count DESC;
```

Try an INNER JOIN for the same query and compare. Categories with zero startups will disappear from the result.

### Step 3: Write Subqueries

Find startups that have more upvotes than the overall average:

```sql
SELECT s.name, s.tagline,
  (SELECT count(*) FROM upvotes u WHERE u.startup_id = s.id) AS upvotes
FROM startups s
WHERE (SELECT count(*) FROM upvotes u WHERE u.startup_id = s.id) > (
  SELECT avg(cnt) FROM (
    SELECT count(*) AS cnt FROM upvotes GROUP BY startup_id
  ) sub
)
ORDER BY upvotes DESC;
```

Use an EXISTS subquery to find users who have both commented and upvoted:

```sql
SELECT u.name
FROM users u
WHERE EXISTS (SELECT 1 FROM comments c WHERE c.user_id = u.id)
  AND EXISTS (SELECT 1 FROM upvotes up WHERE up.user_id = u.id);
```

EXISTS is often faster than IN for this kind of check because it stops scanning as soon as it finds one match.

### Step 4: Write a CTE

Build a category summary with multiple metrics:

```sql
WITH startup_metrics AS (
  SELECT
    s.id,
    s.name,
    s.category_id,
    (SELECT count(*) FROM upvotes u WHERE u.startup_id = s.id) AS upvotes,
    (SELECT count(*) FROM comments c WHERE c.startup_id = s.id) AS comments
  FROM startups s
  WHERE s.status = 'active'
)
SELECT
  c.name AS category,
  count(sm.id) AS startups,
  COALESCE(sum(sm.upvotes), 0) AS total_upvotes,
  COALESCE(sum(sm.comments), 0) AS total_comments,
  ROUND(COALESCE(avg(sm.upvotes), 0), 1) AS avg_upvotes
FROM categories c
LEFT JOIN startup_metrics sm ON sm.category_id = c.id
GROUP BY c.name
ORDER BY total_upvotes DESC;
```

The CTE (startup_metrics) computes per-startup metrics once, and the final query aggregates them by category. Without the CTE, you would either nest subqueries or repeat the aggregation logic.

### Step 5: Write Window Function Queries

Rank startups within their category:

```sql
SELECT
  s.name,
  c.name AS category,
  count(u.id) AS upvotes,
  RANK() OVER (PARTITION BY s.category_id ORDER BY count(u.id) DESC) AS category_rank,
  RANK() OVER (ORDER BY count(u.id) DESC) AS overall_rank
FROM startups s
JOIN categories c ON s.category_id = c.id
LEFT JOIN upvotes u ON u.startup_id = s.id
WHERE s.status = 'active'
GROUP BY s.id, s.name, c.name, s.category_id
ORDER BY category, category_rank;
```

Each startup gets two ranks: one within its category and one overall.

Compute each startup's share of total upvotes:

```sql
SELECT
  s.name,
  count(u.id) AS upvotes,
  ROUND(
    100.0 * count(u.id) / SUM(count(u.id)) OVER (),
    1
  ) AS percentage_of_total
FROM startups s
LEFT JOIN upvotes u ON u.startup_id = s.id
GROUP BY s.id, s.name
ORDER BY upvotes DESC;
```

The `SUM(count(u.id)) OVER ()` computes the grand total of all upvotes across all rows. Each row then divides its own count by this total to get a percentage.

### Step 6: Translate to Drizzle

Open `backend/src/index.ts` and add the trending startups query using the Drizzle query builder:

```ts
// Trending startups - most upvoted this week
const trending = await db
  .select({
    name: startups.name,
    tagline: startups.tagline,
    upvotes: count(upvotes.id),
  })
  .from(startups)
  .innerJoin(upvotes, eq(upvotes.startupId, startups.id))
  .where(eq(startups.status, 'active'))
  .groupBy(startups.id, startups.name, startups.tagline)
  .orderBy(desc(count(upvotes.id)))
  .limit(5);

console.log('\nTrending startups:');
for (const row of trending) {
  console.log(`  - ${row.name}: ${row.upvotes} upvotes`);
}
```

For the CTE-based query, use raw SQL through Drizzle:

```ts
const categoryLeaderboard = await db.execute(sql`
  WITH startup_metrics AS (
    SELECT
      s.id, s.category_id,
      count(u.id) AS upvotes
    FROM startups s
    LEFT JOIN upvotes u ON u.startup_id = s.id
    WHERE s.status = 'active'
    GROUP BY s.id, s.category_id
  )
  SELECT
    c.name AS category,
    count(sm.id) AS startups,
    COALESCE(sum(sm.upvotes), 0) AS total_upvotes
  FROM categories c
  LEFT JOIN startup_metrics sm ON sm.category_id = c.id
  GROUP BY c.name
  ORDER BY total_upvotes DESC
`);
```

### Step 7: Run and Verify

Execute the application:

```bash
npm run dev
```

Review the output. Each query should return results that make sense given the seed data. Cross-check a few numbers manually in psql to verify correctness.

## Exercise

1. Write a query that finds the top 3 startups per category by upvote count, using a CTE and ROW_NUMBER(). Return the startup name, category name, and upvote count.

2. Write a query that finds users who have submitted a startup but never received any upvotes on any of their startups. Use a LEFT JOIN and IS NULL check.

3. Write a query that shows each startup alongside its "competitor" -- the startup with the next-highest upvote count in the same category. Use the LEAD() window function.

4. Write a query that calculates the cumulative number of startups launched per day (a running total). Use SUM() OVER with ORDER BY.

5. Translate at least two of the above queries into Drizzle -- one using the query builder and one using raw SQL via db.execute().

6. Run EXPLAIN ANALYZE on the CTE query and the equivalent nested subquery version. Compare the execution plans.

## Summary

Complex queries turn raw data into meaningful insights. INNER JOIN returns only matched rows; LEFT JOIN preserves all rows from the left table and fills nulls where there is no match. Subqueries let you nest one query inside another for filtering, computing per-row values, or creating derived tables. CTEs with the WITH keyword break complex queries into named, readable steps. Window functions like ROW_NUMBER(), RANK(), SUM() OVER, and LAG() compute values across related rows without collapsing the result set. Drizzle supports these patterns through its select-join builder for straightforward joins and aggregations, and through raw SQL via db.execute() for CTEs and window functions. Choose the approach that produces the clearest, most maintainable code for each query.
