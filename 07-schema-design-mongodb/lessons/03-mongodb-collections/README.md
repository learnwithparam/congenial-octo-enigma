# MongoDB Collections and Schemas

MongoDB is schema-flexible, not schema-less. In production applications you define the shape of your documents with TypeScript types and validate them before they reach the database. This lesson covers how to create collections, define schemas with Zod, and get typed collection handles with the native MongoDB driver.

## What You'll Learn

- How to define document schemas using Zod
- How to infer TypeScript types from Zod schemas
- How to create typed collection handles with the MongoDB driver
- How collections are initialized in the LaunchPad codebase
- The role of `ObjectId` in MongoDB documents

## Key Concepts

### Schema Validation with Zod

Even though MongoDB does not enforce schemas at the database level by default, your application should validate data before inserting it. Our codebase uses Zod to define the shape of every document.

In `backend/src/types.ts`, each collection has a corresponding Zod schema:

```typescript
import { ObjectId } from 'mongodb';
import { z } from 'zod';

export const UserSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  name: z.string().min(1),
  email: z.string().email(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export const CategorySchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
});
```

Key patterns here:

- `_id` is optional because MongoDB generates it automatically on insert
- `z.string().min(1)` ensures names and slugs are not empty strings
- `z.string().email()` validates email format
- `z.date().default(() => new Date())` provides automatic timestamps
- Optional fields use `.optional()` so they can be omitted

### Inferring TypeScript Types

Rather than defining types manually and keeping them in sync with your schemas, Zod lets you infer types directly:

```typescript
export type User = z.infer<typeof UserSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Startup = z.infer<typeof StartupSchema>;
```

This means your runtime validation and your compile-time types are always in agreement. If you change the Zod schema, the TypeScript type updates automatically.

### ObjectId

Every MongoDB document has an `_id` field. By default, this is an `ObjectId` -- a 12-byte identifier that is globally unique and contains a timestamp. You import it from the `mongodb` package:

```typescript
import { ObjectId } from 'mongodb';

const id = new ObjectId();          // Generate a new one
const existing = new ObjectId('665f1234abcd5678ef901234'); // From a string
```

In our schemas, references between collections use `ObjectId`:

```typescript
categoryId: z.instanceof(ObjectId),
founderId: z.instanceof(ObjectId),
```

### Typed Collection Handles

The MongoDB Node.js driver supports generics on collections. When you call `db.collection<User>('users')`, all operations on that collection are typed to your `User` interface.

In `backend/src/collections.ts`, we initialize and export typed collection handles:

```typescript
import { Collection, Db } from 'mongodb';
import type { User, Category, Startup } from './types.js';

let users: Collection<User>;
let categories: Collection<Category>;
let startups: Collection<Startup>;

export function initCollections(db: Db) {
  users = db.collection<User>('users');
  categories = db.collection<Category>('categories');
  startups = db.collection<Startup>('startups');
}

export function getUsersCol(): Collection<User> {
  return users;
}

export function getCategoriesCol(): Collection<Category> {
  return categories;
}

export function getStartupsCol(): Collection<Startup> {
  return startups;
}
```

The `initCollections` function is called once after connecting to the database. The getter functions provide access to typed collections throughout the codebase. This pattern keeps the database connection logic in `db.ts` and the collection setup in `collections.ts`, giving each module a single responsibility.

### How It All Connects

The initialization flow in `backend/src/index.ts` shows how these pieces fit together:

```typescript
import { connectDb, closeDb } from './db.js';
import { initCollections } from './collections.js';

async function main() {
  const db = await connectDb();
  initCollections(db);

  // Now you can use getUsersCol(), getStartupsCol(), etc.
}
```

1. `connectDb()` establishes the MongoDB connection and returns the `Db` instance
2. `initCollections(db)` creates typed collection handles
3. The rest of the application uses getter functions to access collections

## Step by Step

### Step 1: Define a New Schema

Say you wanted to add a `tags` collection. You would add a Zod schema to `types.ts`:

```typescript
export const TagSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  createdAt: z.date().default(() => new Date()),
});

export type Tag = z.infer<typeof TagSchema>;
```

### Step 2: Register the Collection

Add the collection handle to `collections.ts`:

```typescript
import type { User, Category, Startup, Tag } from './types.js';

let tags: Collection<Tag>;

export function initCollections(db: Db) {
  // ... existing collections
  tags = db.collection<Tag>('tags');
}

export function getTagsCol(): Collection<Tag> {
  return tags;
}
```

### Step 3: Validate Before Inserting

When creating documents, always parse through the Zod schema first:

```typescript
import { TagSchema } from './types.js';
import { getTagsCol } from './collections.js';

async function createTag(data: { name: string; slug: string }) {
  const parsed = TagSchema.parse(data); // Validates and applies defaults
  const result = await getTagsCol().insertOne(parsed);
  return { ...parsed, _id: result.insertedId };
}
```

If the data is invalid (empty name, wrong types), `parse` throws a `ZodError` with details about what failed.

### Step 4: Run the Tests

The codebase includes tests for all schemas in `backend/tests/types.test.ts`. Run them with:

```bash
cd backend && npm test
```

The tests verify that valid data passes validation and invalid data is rejected:

```typescript
describe('UserSchema', () => {
  it('should validate a correct user', () => {
    const data = { name: 'Alice', email: 'alice@example.com', bio: 'Hello' };
    const result = UserSchema.parse(data);
    expect(result.name).toBe('Alice');
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('should reject an invalid email', () => {
    const data = { name: 'Alice', email: 'not-an-email' };
    expect(() => UserSchema.parse(data)).toThrow();
  });
});
```

## Exercise

1. Add a `TagSchema` to `backend/src/types.ts` with fields for `name`, `slug`, and `createdAt`
2. Export the inferred `Tag` type
3. Register a `tags` collection in `backend/src/collections.ts`
4. Write a test in `backend/tests/types.test.ts` that validates a correct tag and rejects an empty name
5. Run `npm test` to confirm your tests pass

## Summary

- Zod schemas define the shape and validation rules for each collection's documents
- `z.infer` derives TypeScript types from Zod schemas, keeping types and validation in sync
- The MongoDB driver's generic `Collection<T>` gives you typed queries and inserts
- `collections.ts` initializes typed collection handles; `db.ts` manages the connection
- Always validate data through the Zod schema before inserting into MongoDB
- `ObjectId` is MongoDB's default identifier type, used for `_id` fields and cross-collection references
