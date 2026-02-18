# Lesson 07: Solving the N+1 Problem with DataLoader

The N+1 problem is the most common performance pitfall in GraphQL. It is so common that Facebook created DataLoader specifically to solve it. In this lesson we will see the problem in action, understand why it happens, and fix it using the `dataloader` package that is already in our dependencies.

By the end of this lesson you will:

- Understand the N+1 problem and why GraphQL is especially susceptible to it
- Use DataLoader to batch multiple database lookups into a single call
- Wire DataLoader into the Apollo Server context with per-request instances
- Update type resolvers to use DataLoader instead of direct lookups
- Understand DataLoader's caching behavior and its scope

---

## The N+1 Problem Explained

Consider this query:

```graphql
query {
  startups(limit: 10) {
    id
    title
    founder {
      id
      name
      email
    }
  }
}
```

This looks simple. Fetch 10 startups and include each founder. But watch what happens in our resolvers.

First, the `startups` query resolver runs. It fetches 10 startups from the data store. That is 1 operation.

Then, for each of the 10 startups, GraphQL calls the `Startup.founder` field resolver. Each one looks up a user by ID. That is 10 more operations.

Total: 1 + 10 = 11 operations. This is the N+1 problem. One query to get the list, plus N queries to resolve a field on each item.

Let us add logging to see this in action. Update your resolvers temporarily:

```typescript
// In your Startup type resolver
Startup: {
  founder: (parent) => {
    console.log('Fetching founder for startup:', parent.id);
    return users.find((u) => u.id === parent.founderId);
  },
  category: (parent) => {
    console.log('Fetching category for startup:', parent.id);
    return categories.find((c) => c.id === parent.category);
  },
},
```

Run the query above and check your terminal. You will see:

```
Fetching founder for startup: startup-1
Fetching founder for startup: startup-2
Fetching founder for startup: startup-3
Fetching founder for startup: startup-4
Fetching founder for startup: startup-5
Fetching founder for startup: startup-6
Fetching founder for startup: startup-7
Fetching founder for startup: startup-8
Fetching founder for startup: startup-9
Fetching founder for startup: startup-10
```

Ten separate lookups. If this were hitting a real database, that is 10 separate SQL queries. Now imagine the query also asks for `category` on each startup. That adds another 10 lookups. And if comments each have an `author` field, you get even more. A deeply nested query can generate hundreds of database calls.

The problem gets worse when the same user founded multiple startups. If user-1 founded 5 of the 10 startups, we look up user-1 five separate times. That is wasteful.

---

## How DataLoader Solves This

DataLoader solves both problems at once: it batches and it caches.

Batching: Instead of executing each lookup immediately, DataLoader collects all the IDs requested during a single tick of the event loop. Then it calls your batch function once with all the IDs. Instead of 10 calls to `findUserById`, you get one call to `findUsersByIds([id1, id2, ..., id10])`.

Caching: If the same ID is requested multiple times within a single request, DataLoader returns the cached result from the first lookup. If user-1 is the founder of 5 startups, DataLoader fetches user-1 once and returns that same object 5 times.

Here is the mental model:

```
Without DataLoader:
  startup-1 -> fetch user-1
  startup-2 -> fetch user-2
  startup-3 -> fetch user-1  (duplicate!)
  startup-4 -> fetch user-3
  startup-5 -> fetch user-1  (duplicate!)
  = 5 individual fetches

With DataLoader:
  startup-1 -> request user-1
  startup-2 -> request user-2
  startup-3 -> request user-1  (already requested)
  startup-4 -> request user-3
  startup-5 -> request user-1  (already requested)
  ... event loop tick ...
  = 1 batch fetch for [user-1, user-2, user-3]
```

That takes us from 5 operations to 1. When you multiply this across all the fields in a complex query, the savings are enormous.

---

## Creating DataLoader Instances

Create a new file at `src/dataloaders/index.ts`:

```typescript
// src/dataloaders/index.ts
import DataLoader from 'dataloader';
import { users, categories, comments } from '../data/store.js';

// Types for our data
interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Comment {
  id: string;
  startupId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

// Batch function for users
// Takes an array of user IDs, returns an array of users in the same order
async function batchUsers(
  ids: readonly string[]
): Promise<(User | Error)[]> {
  console.log('DataLoader: batch loading users:', ids);

  // In a real app this would be: SELECT * FROM users WHERE id IN (...)
  const userMap = new Map<string, User>();
  for (const user of users) {
    if (ids.includes(user.id)) {
      userMap.set(user.id, user);
    }
  }

  // CRITICAL: return results in the same order as the input IDs
  return ids.map(
    (id) => userMap.get(id) || new Error('User not found: ' + id)
  );
}

// Batch function for categories
async function batchCategories(
  ids: readonly string[]
): Promise<(Category | Error)[]> {
  console.log('DataLoader: batch loading categories:', ids);

  const categoryMap = new Map<string, Category>();
  for (const category of categories) {
    if (ids.includes(category.id)) {
      categoryMap.set(category.id, category);
    }
  }

  return ids.map(
    (id) => categoryMap.get(id) || new Error('Category not found: ' + id)
  );
}

// Batch function for comments by startup ID (one-to-many)
async function batchCommentsByStartupId(
  startupIds: readonly string[]
): Promise<Comment[][]> {
  console.log('DataLoader: batch loading comments for startups:', startupIds);

  const commentsByStartup = new Map<string, Comment[]>();
  for (const comment of comments) {
    if (startupIds.includes(comment.startupId)) {
      const existing = commentsByStartup.get(comment.startupId) || [];
      existing.push(comment);
      commentsByStartup.set(comment.startupId, existing);
    }
  }

  // Return arrays in the same order as input IDs
  return startupIds.map(
    (id) => commentsByStartup.get(id) || []
  );
}

// Factory function: creates fresh loaders for each request
export function createDataLoaders() {
  return {
    userLoader: new DataLoader<string, User>(batchUsers),
    categoryLoader: new DataLoader<string, Category>(batchCategories),
    commentsByStartupLoader: new DataLoader<string, Comment[]>(
      batchCommentsByStartupId
    ),
  };
}

export type DataLoaders = ReturnType<typeof createDataLoaders>;
```

There are several important things to understand here.

The batch function signature: A DataLoader batch function receives an array of keys (IDs in our case) and must return an array of values (or Errors) in the exact same order. If the input is `['user-3', 'user-1', 'user-2']`, the output must be `[user3Object, user1Object, user2Object]`. The order matters because DataLoader matches results to requests by position, not by ID.

Returning Errors for missing items: When an ID does not match any record, we return a `new Error()` instead of `null` or `undefined`. This is a DataLoader convention. It means "this specific key failed" without breaking the entire batch. The resolver that asked for that ID will receive the Error, and you can handle it appropriately.

The factory function: We export a `createDataLoaders()` function rather than a single set of loaders. This is critical. DataLoader instances cache results, and that cache must be scoped to a single request. If you reuse a loader across requests, one user's data could leak to another user. Creating fresh loaders per request prevents this.

One-to-many batch function: The `batchCommentsByStartupId` function returns `Comment[][]` instead of `(Comment | Error)[]`. Each position corresponds to one startup ID, and the value is an array of all comments for that startup. An empty array means the startup has no comments, which is different from "not found."

---

## Wiring DataLoader into the Context

Apollo Server's context is the right place for per-request dependencies. Update your server setup to create DataLoaders for each request.

```typescript
// src/index.ts
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './resolvers/index.js';
import { createDataLoaders, DataLoaders } from './dataloaders/index.js';

// Define the context type
export interface GraphQLContext {
  loaders: DataLoaders;
}

const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async () => {
    // Fresh loaders for every request
    return {
      loaders: createDataLoaders(),
    };
  },
});

console.log('Server ready at ' + url);
```

Every incoming GraphQL request now gets its own set of DataLoaders. The loaders are created in the context factory function and passed through to every resolver via the third argument.

---

## Updating Type Resolvers

Now update the `Startup` type resolvers to use DataLoader instead of direct lookups. Open your resolvers file:

```typescript
// src/resolvers/types.ts
import { GraphQLContext } from '../index.js';

interface StartupParent {
  id: string;
  title: string;
  description: string;
  founderId: string;
  category: string;
  upvotes: number;
  createdAt: string;
  websiteUrl: string | null;
}

interface CommentParent {
  id: string;
  startupId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export const typeResolvers = {
  Startup: {
    founder: (
      parent: StartupParent,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return context.loaders.userLoader.load(parent.founderId);
    },

    category: (
      parent: StartupParent,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return context.loaders.categoryLoader.load(parent.category);
    },

    comments: (
      parent: StartupParent,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return context.loaders.commentsByStartupLoader.load(parent.id);
    },
  },

  Comment: {
    author: (
      parent: CommentParent,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return context.loaders.userLoader.load(parent.authorId);
    },
  },
};
```

The change is minimal but powerful. Instead of:

```typescript
founder: (parent) => users.find((u) => u.id === parent.founderId)
```

We now have:

```typescript
founder: (parent, _args, context) => context.loaders.userLoader.load(parent.founderId)
```

The `load()` method does not fetch immediately. It registers the ID and waits for the current event loop tick to complete. Once all resolvers at the same depth have called `load()`, DataLoader fires the batch function with all the collected IDs.

Notice that both `Startup.founder` and `Comment.author` use the same `userLoader`. If the same user is both a startup founder and a comment author, the loader fetches them only once.

---

## Seeing the Improvement

Run the same query from before:

```graphql
query {
  startups(limit: 10) {
    id
    title
    founder {
      id
      name
      email
    }
    category {
      id
      name
    }
    comments {
      text
      author {
        name
      }
    }
  }
}
```

Check your terminal output. Instead of 10 individual log lines for founders, 10 for categories, and 10 for comments, you will see:

```
DataLoader: batch loading users: ['user-1', 'user-2', 'user-3']
DataLoader: batch loading categories: ['tech', 'health', 'finance']
DataLoader: batch loading comments for startups: ['startup-1', 'startup-2', ...]
DataLoader: batch loading users: ['user-4', 'user-5']
```

The first three lines batch the startup-level fields. The fourth line batches the comment authors. Notice that user IDs from the first batch are not repeated in the second batch thanks to the per-request cache.

In a production application with a real database, this is the difference between 30+ SQL queries and 4 SQL queries. With larger page sizes and deeper nesting, the savings grow dramatically.

---

## Understanding DataLoader Cache Scope

DataLoader has a built-in cache, but it is not like Redis or Memcached. Here is what you need to know.

Per-request scope: Because we create new loaders in the context factory, each request starts with an empty cache. This means:
- Request A fetches user-1. The loader caches user-1 for the duration of request A.
- Request B starts. It gets fresh loaders. It knows nothing about user-1.
- This is correct behavior. It prevents stale data and data leakage between users.

Within a request: If the same user ID is requested multiple times in a single query, DataLoader returns the cached result. This is useful for deeply nested queries:

```graphql
query {
  startups(limit: 10) {
    founder {
      id
      name
    }
    comments {
      author {
        id
        name
      }
    }
  }
}
```

If user-1 is both a founder and a comment author, DataLoader fetches them only once. The second `load('user-1')` call returns the cached promise immediately.

No TTL or expiration: The cache lives only as long as the request. There is no time-based expiration. This is by design. For longer-lived caches, you would use a separate caching layer (Redis, in-memory LRU, etc.) in front of your data source.

---

## DataLoader with a Real Database

Our examples use in-memory arrays, but in a real application you would use SQL. Here is what the batch function looks like with a SQL database:

```typescript
async function batchUsers(
  ids: readonly string[]
): Promise<(User | Error)[]> {
  // One SQL query for all requested users
  const rows = await db.query(
    'SELECT * FROM users WHERE id = ANY($1)',
    [ids]
  );

  // Build a map for O(1) lookup
  const userMap = new Map<string, User>();
  for (const row of rows) {
    userMap.set(row.id, row);
  }

  // Return in order, with Errors for missing IDs
  return ids.map(
    (id) => userMap.get(id) || new Error('User not found: ' + id)
  );
}
```

The `WHERE id = ANY($1)` clause (PostgreSQL syntax) fetches all requested users in a single query. The `IN (...)` clause works the same way in MySQL. The key insight is that any database can handle "fetch these N records" efficiently with a single query, which is exactly the interface DataLoader needs.

---

## How DataLoader Batching Works Under the Hood

Understanding the event loop interaction helps you debug unexpected behavior. Here is what happens step by step:

1. GraphQL starts resolving `startups(limit: 10)`. The query resolver returns an array of 10 startups.

2. GraphQL resolves the first level of fields on each startup. For each startup, it calls the `founder` resolver. Each call to `context.loaders.userLoader.load(founderId)` returns a Promise but does not trigger the batch function yet. DataLoader queues the ID.

3. All 10 `founder` resolvers have been called. The current event loop tick is about to end. DataLoader uses `process.nextTick` (or `Promise.resolve().then(...)`) to schedule the batch function.

4. The batch function runs with all 10 (deduplicated) IDs. It returns the results. DataLoader resolves each queued Promise with the correct result.

5. GraphQL now has all 10 founder objects. If there are deeper nested fields, the process repeats at the next level.

This means DataLoader batches by execution depth. All resolvers at the same depth in the query tree are batched together. Resolvers at different depths trigger separate batches. This is why you sometimes see multiple batch calls for the same loader, as shown in our example where comment authors are in a separate batch from startup founders.

---

## Common DataLoader Mistakes

Returning results in the wrong order: This is the most common mistake. If DataLoader requests `['a', 'b', 'c']` and you return `[objC, objA, objB]`, the results will be mismatched. Always build a Map from your results and then map over the input IDs to produce the output array in the correct order.

Sharing loaders across requests: If you define loaders outside the context factory, all requests share the same cache. This means user A might see data that was fetched for user B. Always create loaders inside the context function.

Not handling missing keys: If an ID does not exist in your data source, you must return an `Error` for that position, not skip it. Skipping it shifts all subsequent results out of alignment. Use the Map-then-map pattern shown above to handle this safely.

Returning the wrong number of results: The batch function must return exactly the same number of results as input keys. If you receive 5 IDs, you must return an array of length 5. Returning 4 or 6 results will cause DataLoader to throw an error.

Using DataLoader for writes: DataLoader is designed for reads. Do not use it to batch inserts or updates. Those operations should be explicit and sequential so you can handle errors and maintain data integrity.

---

## Exercise

1. Add query logging to your resolvers (a simple `console.log` before each data access). Run a complex nested query without DataLoader and count the log lines.

2. Switch to DataLoader and run the same query. Compare the log counts.

3. Create a DataLoader for loading startups by their founder ID (one-to-many). Use it in a `User.startups` field resolver so that when you query for a user, you can see all their startups efficiently.

4. Run this query and verify that the user loader is only called once even though it is used in two different places:

```graphql
query {
  startups(limit: 5) {
    title
    founder {
      name
    }
    comments {
      text
      author {
        name
      }
    }
  }
}
```

---

## Summary

The N+1 problem is inherent to GraphQL's resolver architecture, where each field resolver runs independently. DataLoader solves this by batching all lookups from a single event loop tick into one batch call and caching results within a request.

The key files we created:

- `src/dataloaders/index.ts` - Batch functions and DataLoader factory
- Updated `src/index.ts` - Context with per-request DataLoaders
- Updated `src/resolvers/types.ts` - Type resolvers using `context.loaders`

The critical rules to remember:

- Batch functions must return results in the same order as the input IDs
- Create new DataLoader instances for each request (put them in the context)
- Return `Error` objects for missing keys, never skip or return undefined
- DataLoader works for both one-to-one and one-to-many relationships

In the next lesson we will build a comprehensive error handling strategy that gracefully handles everything from validation errors to unexpected server failures.
