# Embedding vs Referencing

The most important design decision in MongoDB is choosing between embedding data inside a document and referencing it from another collection. Our LaunchPad codebase uses both patterns, and this lesson explains why each was chosen.

## What You'll Learn

- The difference between embedding and referencing in MongoDB
- Rules of thumb for when to use each approach
- How the LaunchPad startup schema uses embedded subdocuments
- How cross-collection references work with ObjectId
- The trade-offs of each approach

## Key Concepts

### Embedding: Data Lives Inside the Document

Embedding means storing related data as nested objects or arrays directly inside a parent document. In our `Startup` schema, comments and upvotes are embedded:

```typescript
// backend/src/types.ts

export const EmbeddedCommentSchema = z.object({
  _id: z.instanceof(ObjectId).default(() => new ObjectId()),
  content: z.string().min(1),
  userId: z.instanceof(ObjectId),
  createdAt: z.date().default(() => new Date()),
});

export const EmbeddedUpvoteSchema = z.object({
  userId: z.instanceof(ObjectId),
  createdAt: z.date().default(() => new Date()),
});

export const StartupSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  // ... other fields
  // Embedded sub-documents
  comments: z.array(EmbeddedCommentSchema).default([]),
  upvotes: z.array(EmbeddedUpvoteSchema).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
```

A startup document in the database looks like this:

```json
{
  "_id": ObjectId("..."),
  "name": "CodeFlow",
  "slug": "codeflow",
  "comments": [
    {
      "_id": ObjectId("..."),
      "content": "This is exactly what our team needed.",
      "userId": ObjectId("..."),
      "createdAt": ISODate("2026-01-15")
    },
    {
      "_id": ObjectId("..."),
      "content": "Been using the beta for two weeks.",
      "userId": ObjectId("..."),
      "createdAt": ISODate("2026-01-15")
    }
  ],
  "upvotes": [
    { "userId": ObjectId("..."), "createdAt": ISODate("2026-01-15") },
    { "userId": ObjectId("..."), "createdAt": ISODate("2026-01-15") }
  ]
}
```

### Referencing: Data Lives in Another Collection

Referencing means storing just an `ObjectId` that points to a document in a different collection. In our schema, a startup references its founder and category:

```typescript
export const StartupSchema = z.object({
  // ...
  categoryId: z.instanceof(ObjectId),
  founderId: z.instanceof(ObjectId),
  // ...
});
```

To get the founder's details, you either run a second query or use `$lookup` in an aggregation pipeline (covered in a later lesson).

### Why Comments Are Embedded

Comments are embedded inside startups because:

1. They are always displayed with the startup (you never show a comment without its parent startup)
2. A comment belongs to exactly one startup (no sharing across documents)
3. The number of comments per startup is bounded (dozens to low hundreds, not millions)
4. Adding or removing a comment is a single atomic update on one document

### Why Categories Are Referenced

Categories are referenced instead of embedded because:

1. A category is shared across many startups (Developer Tools, SaaS, etc.)
2. If you change a category name, you only update one document instead of every startup
3. Categories exist as independent entities with their own slugs and descriptions
4. You need to list all categories separately (for navigation menus, filters)

### The Decision Framework

Use embedding when:

- The child data is always read with the parent
- The child belongs to only one parent (one-to-few or one-to-many with a bound)
- The child data is relatively small
- You want atomic updates (reading and writing in a single operation)

Use referencing when:

- The child data is shared across multiple parents
- The child data grows without bound
- You need to query the child data independently
- The child data is large and would bloat the parent document

### The 16 MB Document Limit

MongoDB documents have a maximum size of 16 MB. This is another reason to reference rather than embed when data can grow without bound. If a startup could accumulate millions of comments, embedding would eventually hit this limit. For our application, where startups have a reasonable number of comments, embedding is safe and fast.

## Step by Step

### Step 1: Examine the Seed Data

Look at how the seed script in `backend/src/seed.ts` creates startups with embedded data:

```typescript
const startupsData: Startup[] = [
  {
    name: 'CodeFlow',
    slug: 'codeflow',
    tagline: 'Collaborative code review for modern teams',
    description: 'CodeFlow brings real-time collaboration...',
    categoryId: c(0),   // Reference to a category
    founderId: u(0),    // Reference to a user
    status: 'active',
    featured: true,
    comments: [          // Embedded subdocuments
      {
        _id: new ObjectId(),
        content: 'This is exactly what our team needed.',
        userId: u(1),    // Reference to the commenter
        createdAt: now,
      },
    ],
    upvotes: [           // Embedded subdocuments
      { userId: u(1), createdAt: now },
      { userId: u(2), createdAt: now },
    ],
    createdAt: now,
    updatedAt: now,
  },
  // ... more startups
];
```

Notice the hybrid approach: `categoryId` and `founderId` are references (ObjectIds pointing to other collections), while `comments` and `upvotes` are embedded arrays.

### Step 2: Understanding the Embedded Comment Schema

Each embedded comment has its own `_id` field. This is important because you need a way to identify individual comments when removing them:

```typescript
export const EmbeddedCommentSchema = z.object({
  _id: z.instanceof(ObjectId).default(() => new ObjectId()),
  content: z.string().min(1),
  userId: z.instanceof(ObjectId),
  createdAt: z.date().default(() => new Date()),
});
```

The `userId` inside a comment is itself a reference. This is a common pattern: embed the subdocument but reference external entities within it. To get the commenter's name, you would use a `$lookup` in an aggregation.

### Step 3: Understanding the Upvote Schema

Upvotes are even simpler -- they do not need their own `_id` because they are identified by `userId`:

```typescript
export const EmbeddedUpvoteSchema = z.object({
  userId: z.instanceof(ObjectId),
  createdAt: z.date().default(() => new Date()),
});
```

A user can only upvote a startup once. This constraint is enforced at the query level, as you will see in the CRUD lesson.

### Step 4: Think About Alternatives

What if comments were in their own collection instead?

```typescript
// Hypothetical separate comments collection
const CommentSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  startupId: z.instanceof(ObjectId),
  userId: z.instanceof(ObjectId),
  content: z.string().min(1),
  createdAt: z.date().default(() => new Date()),
});
```

This would work, but every time you load a startup page, you need a second query (or a `$lookup`) to fetch its comments. With embedding, one `findOne` call returns everything.

The trade-off: if you needed to search across all comments globally (e.g., "show me all comments by user X across all startups"), a separate collection would make that query simpler. With embedding, you would need an aggregation pipeline with `$unwind`.

## Exercise

Consider adding a "reviews" feature to the LaunchPad app where users write detailed reviews (up to 2000 characters) with a 1-5 star rating.

1. Would you embed reviews inside the startup document or create a separate `reviews` collection? Write down your reasoning.
2. What if the requirement changes and you need a page that shows "all reviews by a specific user" across all startups? Does that change your decision?
3. What if each review could have replies (creating a thread)? How would that affect your design?

Sketch out the Zod schema for your chosen approach.

## Summary

- Embedding stores related data inside the parent document for single-query reads
- Referencing stores an ObjectId that points to a document in another collection
- Our LaunchPad schema embeds comments and upvotes inside startups (one-to-bounded-many, always read together)
- Categories and users are referenced because they are shared across many startups
- The 16 MB document limit means unbounded arrays should not be embedded
- Hybrid approaches (embedding some data, referencing other data) are the most common pattern in real applications
