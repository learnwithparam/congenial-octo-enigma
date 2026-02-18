# Indexes and Performance

Without indexes, every query scans every document in the collection. Indexes let MongoDB jump directly to matching documents, turning slow full-collection scans into fast lookups. This lesson covers the indexing strategy used in the LaunchPad codebase.

## What You'll Learn

- What indexes are and why they matter
- How to create single-field and compound indexes
- How unique indexes enforce data integrity
- How to use `explain()` to analyze query performance
- The indexing strategy in the LaunchPad codebase

## Key Concepts

### What Is an Index?

An index is a data structure that stores a subset of the collection's data in an ordered form. When you query with an indexed field, MongoDB uses the index to find matching documents without scanning every document.

Think of it like a book's index: instead of reading every page to find "aggregation pipelines," you look it up in the back of the book and jump to the right page.

### The Cost of Indexes

Indexes speed up reads but slow down writes. Every time you insert or update a document, MongoDB must also update every index on that collection. For read-heavy applications (like our startup directory), the trade-off is almost always worth it.

### The Indexes Module

All index definitions live in `backend/src/indexes.ts`:

```typescript
import { getUsersCol, getCategoriesCol, getStartupsCol } from './collections.js';

export async function createIndexes() {
  // Users: unique email
  await getUsersCol().createIndex({ email: 1 }, { unique: true });

  // Categories: unique slug, unique name
  await getCategoriesCol().createIndex({ slug: 1 }, { unique: true });
  await getCategoriesCol().createIndex({ name: 1 }, { unique: true });

  // Startups: unique slug
  await getStartupsCol().createIndex({ slug: 1 }, { unique: true });

  // Startups: filter by status + sort by createdAt
  await getStartupsCol().createIndex({ status: 1, createdAt: -1 });

  // Startups: filter by category
  await getStartupsCol().createIndex({ categoryId: 1 });

  // Startups: filter by founder
  await getStartupsCol().createIndex({ founderId: 1 });

  // Startups: featured flag
  await getStartupsCol().createIndex({ featured: 1, status: 1 });

  // Startups: upvote user lookup (for $ne unique upvote check)
  await getStartupsCol().createIndex({ 'upvotes.userId': 1 });

  console.log('Indexes created.');
}
```

This function is called once during seeding (in `seed.ts`). In production, you would run it as part of a migration or deployment script.

## Step by Step

### Step 1: Unique Indexes

Unique indexes enforce that no two documents in a collection have the same value for the indexed field.

```typescript
await getUsersCol().createIndex({ email: 1 }, { unique: true });
```

If you try to insert a second user with `email: 'alice@example.com'`, MongoDB will reject the insert with a duplicate key error. This is enforced at the database level -- it works even if your application code has a bug.

The LaunchPad codebase uses unique indexes on:

- `users.email` -- each user has a unique email address
- `categories.slug` -- each category has a unique URL slug
- `categories.name` -- each category has a unique name
- `startups.slug` -- each startup has a unique URL slug

### Step 2: Single-Field Indexes

A single-field index speeds up queries that filter or sort on one field:

```typescript
await getStartupsCol().createIndex({ categoryId: 1 });
await getStartupsCol().createIndex({ founderId: 1 });
```

The `1` means ascending order. For most single-field indexes, the direction does not matter because MongoDB can traverse the index in either direction.

These indexes support queries like:

```typescript
// Uses the categoryId index
getStartupsCol().find({ categoryId: someCategoryId });

// Uses the founderId index
getStartupsCol().find({ founderId: someUserId });
```

### Step 3: Compound Indexes

A compound index covers multiple fields. MongoDB can use a compound index for queries on any prefix of the indexed fields.

```typescript
await getStartupsCol().createIndex({ status: 1, createdAt: -1 });
```

This index supports:

- Queries filtering on `status` alone
- Queries filtering on `status` and sorting by `createdAt`
- The `listStartups` function that does exactly this:

```typescript
// From crud.ts
getStartupsCol().find({ status: 'active' }).sort({ createdAt: -1 });
```

The `featured` compound index works similarly:

```typescript
await getStartupsCol().createIndex({ featured: 1, status: 1 });
```

This supports the `featuredStartups` aggregation which matches on `{ featured: true, status: 'active' }`.

### Step 4: Indexes on Embedded Fields

You can index fields inside embedded arrays:

```typescript
await getStartupsCol().createIndex({ 'upvotes.userId': 1 });
```

This index uses dot notation to reach into the `upvotes` array. It supports the `addUpvote` function's filter:

```typescript
// From crud.ts
getStartupsCol().updateOne(
  { _id: startupId, 'upvotes.userId': { $ne: userId } },
  { $push: { upvotes: ... } },
);
```

Without this index, MongoDB would scan every document and every element in every upvotes array to check the `$ne` condition.

### Step 5: Understanding explain()

The `explain()` method shows how MongoDB executes a query. You can use it in `mongosh` to verify your indexes are being used:

```javascript
// Connect to mongosh
mongosh mongodb://localhost:27017/launchpad

// Check if the status+createdAt index is used
db.startups.find({ status: 'active' }).sort({ createdAt: -1 }).explain('executionStats')
```

Key fields in the explain output:

- `winningPlan.stage` -- should show `IXSCAN` (index scan), not `COLLSCAN` (collection scan)
- `winningPlan.indexName` -- tells you which index was used
- `executionStats.totalDocsExamined` -- how many documents MongoDB read
- `executionStats.nReturned` -- how many documents matched

A good query has `totalDocsExamined` close to `nReturned`. If you examine 1000 documents but return 5, you need a better index.

### Step 6: List Existing Indexes

You can see all indexes on a collection in `mongosh`:

```javascript
db.startups.getIndexes()
```

This returns an array of index definitions, including the default `_id` index that MongoDB creates automatically.

### Step 7: When to Create Indexes

Create an index when:

- A query filters or sorts on a field that is not `_id`
- A query runs frequently (e.g., every page load)
- The collection has more than a few hundred documents

Do not create an index when:

- The field has very low cardinality (e.g., a boolean with only two values on a small collection)
- The collection is write-heavy and rarely queried on that field
- You already have a compound index whose prefix covers the query

### Step 8: Index Strategy Summary

Here is the complete index map for the LaunchPad database:

| Collection | Index | Type | Purpose |
|------------|-------|------|---------|
| users | `{ email: 1 }` | Unique | Find user by email, prevent duplicates |
| categories | `{ slug: 1 }` | Unique | Find category by slug |
| categories | `{ name: 1 }` | Unique | Prevent duplicate names |
| startups | `{ slug: 1 }` | Unique | Find startup by slug |
| startups | `{ status: 1, createdAt: -1 }` | Compound | List active startups sorted by date |
| startups | `{ categoryId: 1 }` | Single | Filter startups by category |
| startups | `{ founderId: 1 }` | Single | Filter startups by founder |
| startups | `{ featured: 1, status: 1 }` | Compound | Featured startup queries |
| startups | `{ 'upvotes.userId': 1 }` | Embedded | Upvote uniqueness check |

## Exercise

1. Connect to `mongosh` and run `db.startups.getIndexes()` to see all indexes
2. Run an explain on a filtered query: `db.startups.find({ status: 'active' }).sort({ createdAt: -1 }).explain('executionStats')`
3. Verify that `winningPlan.stage` shows `IXSCAN`
4. Now try a query on a non-indexed field: `db.startups.find({ description: /code/ }).explain('executionStats')` -- what stage does the winning plan show?
5. Create an index that would support a hypothetical query: "find all startups in a category, sorted by name"

## Summary

- Indexes speed up reads by letting MongoDB skip full collection scans
- Unique indexes enforce data integrity at the database level
- Compound indexes cover queries on their field prefix and support combined filter + sort operations
- Dot notation lets you index fields inside embedded arrays
- Use `explain('executionStats')` to verify your queries use indexes
- Look for `IXSCAN` in the winning plan and `totalDocsExamined` close to `nReturned`
- Every index adds overhead to writes, so create indexes based on your actual query patterns
