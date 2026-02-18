# Aggregation Pipelines

Simple CRUD queries get you far, but when you need to group, join, reshape, or compute derived data, MongoDB aggregation pipelines are the tool. This lesson breaks down every pipeline in the LaunchPad codebase.

## What You'll Learn

- What an aggregation pipeline is and how stages work
- How to filter with `$match`
- How to group and count with `$group`
- How to join collections with `$lookup`
- How to flatten arrays with `$unwind`
- How to reshape output with `$project`
- How to order results with `$sort`
- How to compute values from embedded arrays with `$size`

## Key Concepts

### What Is an Aggregation Pipeline?

An aggregation pipeline is a sequence of stages. Each stage transforms the documents and passes the result to the next stage. Think of it like piping data through a series of filters and transformers:

```
documents -> $match -> $group -> $lookup -> $project -> $sort -> results
```

In code, you call `.aggregate([...stages])` on a collection. Each stage is an object with a single operator key.

### The Aggregations Module

All pipelines live in `backend/src/aggregations.ts`. There are four pipelines in the codebase, each demonstrating different stage combinations.

## Step by Step

### Step 1: Count Startups Per Category ($match, $group, $lookup)

This pipeline answers: "How many active startups are in each category?"

```typescript
// backend/src/aggregations.ts

export async function startupsPerCategory() {
  return getStartupsCol()
    .aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      { $project: { _id: 0, category: '$category.name', count: 1 } },
      { $sort: { count: -1 } },
    ])
    .toArray();
}
```

Breaking down each stage:

1. `$match: { status: 'active' }` -- filters to only active startups. Always put `$match` early to reduce the number of documents flowing through the pipeline.

2. `$group: { _id: '$categoryId', count: { $sum: 1 } }` -- groups by `categoryId` and counts documents in each group. The `$` prefix in `'$categoryId'` references a field value.

3. `$lookup` -- joins with the `categories` collection. `localField: '_id'` (the grouped `categoryId`) matches against `foreignField: '_id'` in `categories`. The result is stored in an array field called `category`.

4. `$unwind: '$category'` -- flattens the `category` array. Since each `categoryId` matches exactly one category, `$unwind` converts the single-element array into a plain object.

5. `$project: { _id: 0, category: '$category.name', count: 1 }` -- reshapes the output. `_id: 0` hides the `_id` field. `category: '$category.name'` renames the field. `count: 1` keeps the count.

6. `$sort: { count: -1 }` -- orders by count descending (most startups first).

The output looks like:

```json
[
  { "category": "Developer Tools", "count": 2 },
  { "category": "AI & Machine Learning", "count": 2 },
  { "category": "Productivity", "count": 2 },
  { "category": "SaaS", "count": 1 },
  { "category": "Design", "count": 1 }
]
```

### Step 2: Rank Startups by Upvotes ($size)

This pipeline answers: "Which active startups have the most upvotes?"

```typescript
export async function startupsByUpvotes() {
  return getStartupsCol()
    .aggregate([
      { $match: { status: 'active' } },
      { $project: { name: 1, upvoteCount: { $size: '$upvotes' } } },
      { $sort: { upvoteCount: -1 } },
    ])
    .toArray();
}
```

Stage breakdown:

1. `$match` -- filters to active startups only
2. `$project` -- keeps only `name` and computes `upvoteCount` using `$size`, which returns the length of the `upvotes` array
3. `$sort` -- orders by upvote count, highest first

This is a common pattern for computing derived values from embedded arrays without needing to unwind them.

### Step 3: Recent Comments Across All Startups ($unwind, $limit)

This pipeline answers: "What are the most recent comments across all startups?"

```typescript
export async function recentComments(limit = 10) {
  return getStartupsCol()
    .aggregate([
      { $unwind: '$comments' },
      { $sort: { 'comments.createdAt': -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'comments.userId',
          foreignField: '_id',
          as: 'commentUser',
        },
      },
      { $unwind: '$commentUser' },
      {
        $project: {
          _id: 0,
          startup: '$name',
          comment: '$comments.content',
          user: '$commentUser.name',
          createdAt: '$comments.createdAt',
        },
      },
    ])
    .toArray();
}
```

Stage breakdown:

1. `$unwind: '$comments'` -- each startup document produces one document per comment. A startup with 3 comments becomes 3 documents.
2. `$sort` -- orders all comments by their `createdAt` date, newest first
3. `$limit` -- takes only the top N comments
4. `$lookup` -- joins with `users` to get the commenter's details
5. `$unwind: '$commentUser'` -- flattens the user lookup result
6. `$project` -- reshapes the output into a clean format with startup name, comment text, user name, and date

The output looks like:

```json
[
  {
    "startup": "CodeFlow",
    "comment": "This is exactly what our team needed.",
    "user": "Bob Smith",
    "createdAt": "2026-01-15T00:00:00Z"
  }
]
```

### Step 4: Featured Startups with Founder Details (Multiple $lookup)

This pipeline answers: "Show featured startups with their founder name, category, and upvote count."

```typescript
export async function featuredStartups() {
  return getStartupsCol()
    .aggregate([
      { $match: { featured: true, status: 'active' } },
      {
        $lookup: {
          from: 'users',
          localField: 'founderId',
          foreignField: '_id',
          as: 'founder',
        },
      },
      { $unwind: '$founder' },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $project: {
          name: 1,
          tagline: 1,
          founder: '$founder.name',
          category: '$category.name',
          upvoteCount: { $size: '$upvotes' },
        },
      },
      { $sort: { upvoteCount: -1 } },
    ])
    .toArray();
}
```

This pipeline uses two `$lookup` stages to join with both `users` and `categories`. Each lookup is followed by `$unwind` to flatten the result. The final `$project` cherry-picks fields and computes the upvote count.

### Step 5: See It All in Action

The `backend/src/index.ts` file calls all four pipelines and prints the results:

```typescript
const featured = await featuredStartups();
console.log('\nFeatured startups:');
for (const s of featured) {
  console.log(`  - ${s.name} (${s.category}) by ${s.founder} — ${s.upvoteCount} upvotes`);
}

const perCategory = await startupsPerCategory();
console.log('\nActive startups per category:');
for (const row of perCategory) {
  console.log(`  - ${row.category}: ${row.count}`);
}

const leaderboard = await startupsByUpvotes();
console.log('\nUpvote leaderboard:');
for (const row of leaderboard) {
  console.log(`  - ${row.name}: ${row.upvoteCount}`);
}

const comments = await recentComments(5);
console.log('\nRecent comments:');
for (const c of comments) {
  console.log(`  - [${c.startup}] ${c.user}: ${c.comment}`);
}
```

Run it with `cd backend && npx tsx src/index.ts` to see the output.

## Exercise

Write a new aggregation pipeline function called `startupsPerFounder()` that:

1. Groups startups by `founderId`
2. Counts how many startups each founder has
3. Uses `$lookup` to join with the `users` collection to get the founder's name
4. Projects the output as `{ founder: string, startupCount: number }`
5. Sorts by `startupCount` descending

Add the function to `aggregations.ts` and call it from `index.ts` to verify the output.

## Summary

- Aggregation pipelines are sequences of stages that transform documents step by step
- `$match` filters documents early to reduce pipeline work
- `$group` groups documents by a field and computes aggregates like `$sum`
- `$lookup` performs left outer joins between collections (MongoDB's equivalent of SQL JOIN)
- `$unwind` flattens arrays into individual documents
- `$project` reshapes output, renames fields, and computes derived values
- `$size` computes the length of an array field without unwinding it
- `$sort` and `$limit` order and cap results
- Place `$match` as early as possible in the pipeline for best performance
