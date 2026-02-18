# CRUD Operations

With your schemas defined and collections initialized, it is time to create, read, update, and delete documents. This lesson walks through every CRUD function in the LaunchPad codebase, including operations on embedded subdocuments like comments and upvotes.

## What You'll Learn

- How to insert documents with `insertOne` and `insertMany`
- How to query documents with `findOne` and `find`
- How to update documents with `updateOne` and the `$set` operator
- How to delete documents with `deleteOne`
- How to manipulate embedded arrays with `$push`, `$pull`, and `$ne`

## Key Concepts

### The CRUD Module

All CRUD operations live in `backend/src/crud.ts`. Each function follows the same pattern:

1. Accept input data
2. Validate with Zod (for creates)
3. Call the appropriate MongoDB driver method
4. Return the result

### Zod Validation on Insert

Every create function validates input through the Zod schema before inserting:

```typescript
export async function createUser(data: Omit<User, '_id' | 'createdAt' | 'updatedAt'>) {
  const parsed = UserSchema.parse(data);
  const result = await getUsersCol().insertOne(parsed);
  return { ...parsed, _id: result.insertedId };
}
```

`UserSchema.parse(data)` does two things: it validates the data and applies defaults (like `createdAt` and `updatedAt`). If validation fails, it throws a `ZodError`. The `Omit` type tells TypeScript callers they do not need to provide `_id`, `createdAt`, or `updatedAt`.

## Step by Step

### Step 1: Creating Documents

There are create functions for users, categories, and startups.

Creating a user:

```typescript
export async function createUser(data: Omit<User, '_id' | 'createdAt' | 'updatedAt'>) {
  const parsed = UserSchema.parse(data);
  const result = await getUsersCol().insertOne(parsed);
  return { ...parsed, _id: result.insertedId };
}
```

Creating a category:

```typescript
export async function createCategory(data: Omit<Category, '_id' | 'createdAt'>) {
  const parsed = CategorySchema.parse(data);
  const result = await getCategoriesCol().insertOne(parsed);
  return { ...parsed, _id: result.insertedId };
}
```

Creating a startup (note that `comments` and `upvotes` are omitted -- they start as empty arrays via the Zod default):

```typescript
export async function createStartup(
  data: Omit<Startup, '_id' | 'comments' | 'upvotes' | 'createdAt' | 'updatedAt'>,
) {
  const parsed = StartupSchema.parse(data);
  const result = await getStartupsCol().insertOne(parsed);
  return { ...parsed, _id: result.insertedId };
}
```

The seed script also demonstrates bulk insertion with `insertMany`:

```typescript
const { insertedIds: userIds } = await getUsersCol().insertMany(usersData);
console.log(`Inserted ${Object.keys(userIds).length} users.`);
```

`insertMany` accepts an array and returns a map of indexes to inserted `ObjectId` values.

### Step 2: Reading Documents

The codebase provides several read patterns.

Find a single document by a specific field:

```typescript
export async function findUserById(id: ObjectId) {
  return getUsersCol().findOne({ _id: id });
}

export async function findUserByEmail(email: string) {
  return getUsersCol().findOne({ email });
}

export async function findStartupBySlug(slug: string) {
  return getStartupsCol().findOne({ slug });
}
```

`findOne` returns the document or `null` if no match is found.

Find multiple documents with filtering and sorting:

```typescript
export async function listStartups(filter: { status?: string; featured?: boolean } = {}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.featured !== undefined) query.featured = filter.featured;
  return getStartupsCol().find(query).sort({ createdAt: -1 }).toArray();
}
```

`find` returns a cursor. Chain `.sort()` to order results and `.toArray()` to collect them into an array. The query object is built dynamically -- only specified filters are included.

Listing categories with alphabetical sorting:

```typescript
export async function listCategories() {
  return getCategoriesCol().find().sort({ name: 1 }).toArray();
}
```

Sort direction: `1` for ascending, `-1` for descending.

### Step 3: Updating Documents

Updates use `updateOne` with the `$set` operator to modify specific fields without overwriting the entire document:

```typescript
export async function updateUser(
  id: ObjectId,
  data: Partial<Pick<User, 'name' | 'bio' | 'avatarUrl'>>,
) {
  return getUsersCol().updateOne(
    { _id: id },
    { $set: { ...data, updatedAt: new Date() } },
  );
}
```

The first argument is the filter (which document to update). The second argument uses `$set` to update only the provided fields. The `updatedAt` timestamp is always refreshed.

Updating a startup allows changing fields like name, tagline, description, status, and featured flag:

```typescript
export async function updateStartup(
  id: ObjectId,
  data: Partial<Pick<Startup, 'name' | 'tagline' | 'description' | 'websiteUrl' | 'status' | 'featured' | 'featuredAt'>>,
) {
  return getStartupsCol().updateOne(
    { _id: id },
    { $set: { ...data, updatedAt: new Date() } },
  );
}
```

`Partial<Pick<...>>` means callers provide any subset of the allowed fields. TypeScript prevents updating fields not in the Pick list.

### Step 4: Deleting Documents

Delete operations use `deleteOne` with a filter:

```typescript
export async function deleteUser(id: ObjectId) {
  return getUsersCol().deleteOne({ _id: id });
}

export async function deleteStartup(id: ObjectId) {
  return getStartupsCol().deleteOne({ _id: id });
}
```

The result includes `deletedCount` so you can check if a document was actually removed.

### Step 5: Manipulating Embedded Arrays

This is where MongoDB shines. Instead of inserting into a separate table, you push items into an embedded array.

Adding a comment to a startup:

```typescript
export async function addComment(startupId: ObjectId, userId: ObjectId, content: string) {
  const comment = EmbeddedCommentSchema.parse({ content, userId });
  await getStartupsCol().updateOne(
    { _id: startupId },
    {
      $push: { comments: comment },
      $set: { updatedAt: new Date() },
    },
  );
  return comment;
}
```

`$push` appends the comment object to the `comments` array. The comment is validated through `EmbeddedCommentSchema` first, which generates a new `_id` and sets `createdAt`.

Removing a comment by its `_id`:

```typescript
export async function removeComment(startupId: ObjectId, commentId: ObjectId) {
  return getStartupsCol().updateOne(
    { _id: startupId },
    {
      $pull: { comments: { _id: commentId } },
      $set: { updatedAt: new Date() },
    },
  );
}
```

`$pull` removes all elements from the array that match the condition. Here it removes the comment whose `_id` matches `commentId`.

Adding an upvote with a uniqueness check:

```typescript
export async function addUpvote(startupId: ObjectId, userId: ObjectId) {
  return getStartupsCol().updateOne(
    { _id: startupId, 'upvotes.userId': { $ne: userId } },
    {
      $push: { upvotes: EmbeddedUpvoteSchema.parse({ userId }) },
      $set: { updatedAt: new Date() },
    },
  );
}
```

The filter includes `'upvotes.userId': { $ne: userId }`, which means "only match if no upvote in the array has this userId." If the user already upvoted, the filter matches nothing and the update is a no-op. This is an atomic uniqueness constraint without needing a separate unique index.

Removing an upvote:

```typescript
export async function removeUpvote(startupId: ObjectId, userId: ObjectId) {
  return getStartupsCol().updateOne(
    { _id: startupId },
    {
      $pull: { upvotes: { userId } },
      $set: { updatedAt: new Date() },
    },
  );
}
```

### Step 6: Run the Application

After seeding the database, run the main script to see CRUD in action:

```bash
cd backend && npx tsx src/index.ts
```

The `index.ts` file calls `listStartups({ status: 'active' })` and displays the results, demonstrating the read operations with filters and sorting.

## Exercise

1. Write a new function `findStartupsByFounder(founderId: ObjectId)` in `crud.ts` that returns all startups created by a specific user, sorted by `createdAt` descending
2. Write a function `updateCategory(id: ObjectId, data: Partial<Pick<Category, 'name' | 'description'>>)` that updates a category
3. Test your functions by calling them from `index.ts` after the seed data is loaded
4. Try adding a comment to a startup using `addComment`, then removing it using `removeComment`
5. Try upvoting a startup twice with the same user and verify the second call does not create a duplicate

## Summary

- `insertOne` and `insertMany` create documents; always validate with Zod first
- `findOne` returns a single document or null; `find` returns a cursor for multiple documents
- `updateOne` with `$set` modifies specific fields without overwriting the whole document
- `deleteOne` removes a single document matching the filter
- `$push` and `$pull` add and remove items from embedded arrays
- The `$ne` operator in a filter enforces uniqueness constraints on embedded array elements
- TypeScript generics on collections give you type safety across all operations
