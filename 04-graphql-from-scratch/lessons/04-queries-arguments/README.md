# Queries and Arguments

So far, our `startups` query returns every startup in the data store with no way to filter, paginate, or sort the results. In a real application, a startup directory might have thousands of entries. The homepage shows the top 20 by upvotes. The search page filters by keyword. The category page shows startups in a specific category. All of these require query arguments.

In this lesson, we will add arguments to our queries, implement pagination, filtering, searching, and sorting, and learn about GraphQL variables and input types.

## What You'll Learn

- How to add arguments to GraphQL query fields
- How to implement offset-based pagination with `limit` and `offset`
- How to filter results by category
- How to implement text search across multiple fields
- How to add sorting with enum types
- How GraphQL variables work and why clients use them
- The difference between inline arguments and input types
- How to add a `startupCount` query for totals

## Concepts

### Arguments in GraphQL

Every field in GraphQL can accept arguments. We already use one: `startup(id: ID!)` takes an `id` argument. Arguments let the client control what data the server returns without needing separate endpoints.

In REST, you might express the same thing with query parameters:

```
GET /api/startups?limit=10&offset=0&category=ai-ml&search=deploy&sort=upvotes
```

In GraphQL, arguments are part of the field definition in the schema:

```graphql
type Query {
  startups(limit: Int, offset: Int, categoryId: ID, search: String, sortBy: SortBy): [Startup!]!
}
```

Arguments are typed, validated by the engine, and documented in the schema. A client cannot send an argument that the schema does not define, and the engine validates the types automatically.

### Variables

When clients send queries, they rarely hardcode argument values. Instead, they use variables -- named placeholders that are filled in at execution time:

```graphql
query GetStartups($limit: Int, $search: String) {
  startups(limit: $limit, search: $search) {
    name
    tagline
  }
}
```

The variables are sent as a separate JSON object alongside the query:

```json
{
  "limit": 10,
  "search": "deploy"
}
```

Variables serve several purposes:

- They prevent injection attacks (variable values are never interpolated into the query string)
- They enable query caching (the same query structure can be reused with different variables)
- They make queries reusable across different parts of the application

Apollo Sandbox has a Variables panel where you can pass variables alongside your queries.

### Enum Types

For arguments with a fixed set of valid values (like sort order), GraphQL provides enum types:

```graphql
enum SortBy {
  NEWEST
  OLDEST
  UPVOTES_DESC
  UPVOTES_ASC
}
```

Enums are validated by the schema -- a client cannot send `sortBy: "invalid"`. They are typically written in SCREAMING_SNAKE_CASE by convention.

## Step by Step

### Step 1: Update the Schema With Arguments

Open `src/schema.ts` and update the schema with the new enum type and query arguments:

```typescript
// src/schema.ts

export const typeDefs = `#graphql
  type Startup {
    id: ID!
    name: String!
    slug: String!
    tagline: String!
    description: String!
    url: String!
    upvotes: Int!
    createdAt: String!
    founder: User!
    category: Category!
    comments: [Comment!]!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    avatarUrl: String
    startups: [Startup!]!
  }

  type Category {
    id: ID!
    name: String!
    slug: String!
    startups: [Startup!]!
  }

  type Comment {
    id: ID!
    content: String!
    createdAt: String!
    author: User!
    startup: Startup!
  }

  enum SortBy {
    NEWEST
    OLDEST
    UPVOTES_DESC
    UPVOTES_ASC
    NAME_ASC
    NAME_DESC
  }

  input CreateStartupInput {
    name: String!
    tagline: String!
    description: String!
    url: String!
    categoryId: ID!
    founderId: ID!
  }

  input UpdateStartupInput {
    name: String
    tagline: String
    description: String
    url: String
    categoryId: ID
  }

  type Query {
    startups(
      limit: Int
      offset: Int
      categoryId: ID
      search: String
      sortBy: SortBy
    ): [Startup!]!
    startup(id: ID!): Startup
    startupCount(categoryId: ID, search: String): Int!
    categories: [Category!]!
    category(id: ID!): Category
    user(id: ID!): User
  }

  type Mutation {
    createStartup(input: CreateStartupInput!): Startup!
    updateStartup(id: ID!, input: UpdateStartupInput!): Startup
    deleteStartup(id: ID!): Boolean!
    upvoteStartup(id: ID!): Startup
    createComment(startupId: ID!, content: String!, authorId: ID!): Comment!
  }
`;
```

Here is what changed:

We added a `SortBy` enum with six values covering sort by date, upvotes, and name in both directions.

The `startups` query now accepts five optional arguments: `limit`, `offset`, `categoryId`, `search`, and `sortBy`. All arguments are nullable (no `!`), meaning the client can omit any of them. When omitted, we will use sensible defaults in the resolver.

We added a `startupCount` query that accepts the same filter arguments (`categoryId` and `search`) but returns an `Int!` -- the total count of matching startups. This is essential for building pagination UIs where you need to show "page 1 of 5" or "showing 10 of 47 results."

### Step 2: Define Argument Types

Before writing resolvers, let's define TypeScript interfaces for our query arguments. This keeps our resolver code type-safe. Add these to your `src/data.ts` file, or create a new `src/types.ts` file:

```typescript
// src/types.ts

export interface StartupsArgs {
  limit?: number;
  offset?: number;
  categoryId?: string;
  search?: string;
  sortBy?: 'NEWEST' | 'OLDEST' | 'UPVOTES_DESC' | 'UPVOTES_ASC' | 'NAME_ASC' | 'NAME_DESC';
}

export interface StartupCountArgs {
  categoryId?: string;
  search?: string;
}
```

### Step 3: Implement the Filtering Helper

The `startups` query and `startupCount` query share the same filtering logic (by category and search). Let's extract that into a helper function to avoid duplication. Add this to `src/resolvers.ts`:

```typescript
// src/resolvers.ts

import { startups, users, categories, comments } from './data.js';
import type { StartupRecord, UserRecord, CategoryRecord, CommentRecord } from './data.js';
import type { StartupsArgs, StartupCountArgs } from './types.js';

function filterStartups(
  items: StartupRecord[],
  categoryId?: string,
  search?: string
): StartupRecord[] {
  let result = items;

  // Filter by category
  if (categoryId) {
    result = result.filter((s) => s.categoryId === categoryId);
  }

  // Filter by search term (case-insensitive, matches name or tagline)
  if (search) {
    const term = search.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.tagline.toLowerCase().includes(term)
    );
  }

  return result;
}
```

The `filterStartups` function takes the full startup array and optionally filters by category ID and search term. The search is case-insensitive and checks both the name and tagline fields. This means searching for "ai" would match "CodeBuddy AI" (in the name) and "Personal finance tracking with AI insights" (in the tagline).

### Step 4: Implement Sorting

Add a sorting helper below the filtering helper:

```typescript
function sortStartups(
  items: StartupRecord[],
  sortBy?: string
): StartupRecord[] {
  // Create a copy to avoid mutating the original array
  const sorted = [...items];

  switch (sortBy) {
    case 'NEWEST':
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case 'OLDEST':
      return sorted.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    case 'UPVOTES_DESC':
      return sorted.sort((a, b) => b.upvotes - a.upvotes);
    case 'UPVOTES_ASC':
      return sorted.sort((a, b) => a.upvotes - b.upvotes);
    case 'NAME_ASC':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'NAME_DESC':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    default:
      // Default sort: newest first
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}
```

Notice that we create a copy of the array with `[...items]` before sorting. `Array.sort()` mutates the array in place, and we do not want to permanently reorder our data store. This is a common gotcha.

The default sort (when no `sortBy` argument is provided) is newest first, which makes sense for a startup directory where users want to see the latest submissions.

### Step 5: Implement Pagination

Pagination uses `limit` and `offset`:

- `offset` is how many items to skip (default: 0)
- `limit` is how many items to return (default: all)

This is called offset-based pagination. It is simple to implement and works well for most use cases. (Cursor-based pagination is more robust for large, frequently-changing datasets, but offset-based is sufficient for our needs.)

### Step 6: Update the Query Resolvers

Now let's put it all together in the resolver. Here is the complete updated `src/resolvers.ts`:

```typescript
// src/resolvers.ts

import { startups, users, categories, comments } from './data.js';
import type { StartupRecord, UserRecord, CategoryRecord, CommentRecord } from './data.js';
import type { StartupsArgs, StartupCountArgs } from './types.js';

function filterStartups(
  items: StartupRecord[],
  categoryId?: string,
  search?: string
): StartupRecord[] {
  let result = items;

  if (categoryId) {
    result = result.filter((s) => s.categoryId === categoryId);
  }

  if (search) {
    const term = search.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.tagline.toLowerCase().includes(term)
    );
  }

  return result;
}

function sortStartups(
  items: StartupRecord[],
  sortBy?: string
): StartupRecord[] {
  const sorted = [...items];

  switch (sortBy) {
    case 'NEWEST':
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case 'OLDEST':
      return sorted.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    case 'UPVOTES_DESC':
      return sorted.sort((a, b) => b.upvotes - a.upvotes);
    case 'UPVOTES_ASC':
      return sorted.sort((a, b) => a.upvotes - b.upvotes);
    case 'NAME_ASC':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'NAME_DESC':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    default:
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}

export const resolvers = {
  Query: {
    startups: (_parent: unknown, args: StartupsArgs) => {
      // 1. Filter
      let result = filterStartups(startups, args.categoryId, args.search);

      // 2. Sort
      result = sortStartups(result, args.sortBy);

      // 3. Paginate
      const offset = args.offset ?? 0;
      if (args.limit !== undefined) {
        result = result.slice(offset, offset + args.limit);
      } else if (offset > 0) {
        result = result.slice(offset);
      }

      return result;
    },

    startup: (_parent: unknown, args: { id: string }) => {
      return startups.find((s) => s.id === args.id) || null;
    },

    startupCount: (_parent: unknown, args: StartupCountArgs) => {
      const filtered = filterStartups(startups, args.categoryId, args.search);
      return filtered.length;
    },

    categories: () => {
      return categories;
    },

    category: (_parent: unknown, args: { id: string }) => {
      return categories.find((c) => c.id === args.id) || null;
    },

    user: (_parent: unknown, args: { id: string }) => {
      return users.find((u) => u.id === args.id) || null;
    },
  },

  Startup: {
    founder: (parent: StartupRecord) => {
      return users.find((u) => u.id === parent.founderId);
    },

    category: (parent: StartupRecord) => {
      return categories.find((c) => c.id === parent.categoryId);
    },

    comments: (parent: StartupRecord) => {
      return comments.filter((c) => c.startupId === parent.id);
    },
  },

  User: {
    startups: (parent: UserRecord) => {
      return startups.filter((s) => s.founderId === parent.id);
    },
  },

  Category: {
    startups: (parent: CategoryRecord) => {
      return startups.filter((s) => s.categoryId === parent.id);
    },
  },

  Comment: {
    author: (parent: CommentRecord) => {
      return users.find((u) => u.id === parent.authorId);
    },

    startup: (parent: CommentRecord) => {
      return startups.find((s) => s.id === parent.startupId);
    },
  },

  Mutation: {
    createStartup: () => {
      throw new Error('Not implemented yet');
    },
    updateStartup: () => {
      throw new Error('Not implemented yet');
    },
    deleteStartup: () => {
      throw new Error('Not implemented yet');
    },
    upvoteStartup: () => {
      throw new Error('Not implemented yet');
    },
    createComment: () => {
      throw new Error('Not implemented yet');
    },
  },
};
```

Let's examine the updated `startups` resolver in detail.

The resolver follows a pipeline pattern: filter, then sort, then paginate. This order matters. You want to filter first (reduce the dataset), then sort (order the filtered results), then paginate (take a slice).

For pagination, we use the nullish coalescing operator (`??`) to default `offset` to 0 when not provided. For `limit`, we check if it is defined before slicing. If no limit is provided and no offset is specified, we return all results. If only offset is provided, we skip that many items and return the rest.

The `startupCount` resolver uses the same `filterStartups` helper but returns just the count. This is important for pagination UIs: the client queries both `startups(limit: 10, offset: 0)` and `startupCount()` to know the total.

### Step 7: Test Pagination in Apollo Sandbox

Start your server and try these queries.

Get the first 3 startups:

```graphql
query FirstPage {
  startups(limit: 3) {
    name
    upvotes
    createdAt
  }
  startupCount
}
```

This returns the 3 newest startups (default sort is NEWEST) and the total count (6).

Get the next 3 startups:

```graphql
query SecondPage {
  startups(limit: 3, offset: 3) {
    name
    upvotes
    createdAt
  }
}
```

This skips the first 3 and returns the remaining startups.

### Step 8: Test Filtering

Filter by category (AI/ML, id "1"):

```graphql
query AIStartups {
  startups(categoryId: "1") {
    name
    tagline
    category {
      name
    }
  }
  startupCount(categoryId: "1")
}
```

This returns CodeBuddy AI and SynthVoice (both in the AI/ML category) and a count of 2.

### Step 9: Test Search

Search for startups with "deploy" in the name or tagline:

```graphql
query SearchDeploy {
  startups(search: "deploy") {
    name
    tagline
  }
  startupCount(search: "deploy")
}
```

This returns DeployBot (matches "deploy" in both name and tagline) and a count of 1.

Search for "ai":

```graphql
query SearchAI {
  startups(search: "ai") {
    name
    tagline
  }
}
```

This returns CodeBuddy AI (matches "AI" in name), FinTrack (matches "AI" in tagline), MedNote (matches "AI" in tagline), and SynthVoice (if "AI" appears in tagline). The search is case-insensitive.

### Step 10: Test Sorting

Sort by most upvotes:

```graphql
query TopStartups {
  startups(sortBy: UPVOTES_DESC, limit: 3) {
    name
    upvotes
  }
}
```

Returns CodeBuddy AI (342), MedNote (289), DeployBot (218).

Sort alphabetically:

```graphql
query AlphabeticalStartups {
  startups(sortBy: NAME_ASC) {
    name
  }
}
```

Returns startups in A-Z order.

### Step 11: Combine Everything

The real power comes from combining arguments:

```graphql
query FilteredSortedPaginated {
  startups(
    categoryId: "1"
    sortBy: UPVOTES_DESC
    limit: 5
    offset: 0
  ) {
    name
    tagline
    upvotes
    founder {
      name
    }
  }
  startupCount(categoryId: "1")
}
```

This gets the top AI/ML startups sorted by upvotes, paginated to the first 5, with the total count for pagination controls.

### Step 12: Using Variables

In Apollo Sandbox, switch to the Variables panel (below the query editor). Write a parameterized query:

```graphql
query BrowseStartups(
  $limit: Int
  $offset: Int
  $categoryId: ID
  $search: String
  $sortBy: SortBy
) {
  startups(
    limit: $limit
    offset: $offset
    categoryId: $categoryId
    search: $search
    sortBy: $sortBy
  ) {
    name
    tagline
    upvotes
    category {
      name
    }
    founder {
      name
    }
  }
  startupCount(categoryId: $categoryId, search: $search)
}
```

In the Variables panel, enter:

```json
{
  "limit": 2,
  "offset": 0,
  "sortBy": "UPVOTES_DESC"
}
```

Run it. Then change the variables:

```json
{
  "limit": 2,
  "offset": 0,
  "categoryId": "2",
  "sortBy": "NEWEST"
}
```

Run it again. Same query, different results. This is how a real client application would use GraphQL -- one reusable query with variables that change based on user interaction.

In a React application, this might look like:

```typescript
const { data, loading } = useQuery(BROWSE_STARTUPS, {
  variables: {
    limit: pageSize,
    offset: page * pageSize,
    categoryId: selectedCategory,
    search: searchTerm,
    sortBy: sortOrder,
  },
});
```

The query string stays the same. The variables change as the user interacts with the UI.

## Understanding Default Values

GraphQL SDL supports default values for arguments:

```graphql
type Query {
  startups(
    limit: Int = 20
    offset: Int = 0
    sortBy: SortBy = NEWEST
  ): [Startup!]!
}
```

With defaults, if the client omits `limit`, the resolver receives `20` instead of `undefined`. This is cleaner than handling defaults in the resolver code, but there is a trade-off: the default is part of the public API contract and visible in documentation. For LaunchPad, we handle defaults in the resolver to keep them flexible.

## Input Types for Complex Arguments

Our `startups` query has five arguments listed inline. This is manageable, but if it grew to ten or more arguments, the query definition would become unwieldy. You can use an input type to group them:

```graphql
input StartupsFilter {
  limit: Int
  offset: Int
  categoryId: ID
  search: String
  sortBy: SortBy
}

type Query {
  startups(filter: StartupsFilter): [Startup!]!
}
```

The client query changes slightly:

```graphql
query {
  startups(filter: { limit: 10, search: "ai", sortBy: UPVOTES_DESC }) {
    name
  }
}
```

Input types are a matter of style for queries. For mutations (which we will cover in the next lesson), input types are strongly recommended because mutation arguments tend to be more complex.

## Try It Yourself

Exercise 1: Add a `founderId` filter argument to the `startups` query, so clients can get all startups by a specific founder. Update the schema, the TypeScript type, the filter function, and test it in Sandbox.

Exercise 2: Modify the search to also match against the description field. Test it with a search term that appears in a description but not in the name or tagline.

Exercise 3: Add default values for `limit` (20), `offset` (0), and `sortBy` (NEWEST) directly in the SDL schema. Verify that queries without these arguments still work correctly.

Exercise 4: Combine category filtering, search, and sorting in a single query. For example, search for "ai" within the "Developer Tools" category, sorted by newest. Does the order of operations (filter then sort) produce the expected results?

Exercise 5: Write a query using variables that a pagination component would use. The component should be able to navigate between pages and change the sort order without changing the query string.

## Key Takeaways

- Every GraphQL field can accept typed arguments, validated automatically by the schema.
- Offset-based pagination uses `limit` and `offset` arguments. Filter, then sort, then paginate.
- Enum types (like SortBy) restrict arguments to a fixed set of valid values, preventing invalid input.
- GraphQL variables separate the query structure from the data, enabling query reuse and preventing injection attacks.
- A separate count query (like `startupCount`) is essential for pagination UIs that need to show total results.
- Input types can group related arguments, keeping query definitions clean as complexity grows.
- The same query with different variables can power search, filtering, pagination, and sorting -- all without creating new endpoints.

## Next Steps

Our API can read data with full pagination, filtering, search, and sorting. But reading is only half the story. In the next lesson, we will implement mutations -- the operations that create, update, and delete data.
