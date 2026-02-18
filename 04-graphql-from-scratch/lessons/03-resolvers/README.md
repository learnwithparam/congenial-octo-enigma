# Resolvers

A schema defines what data your API can return. Resolvers define how to get that data. Every field in your schema can have a resolver -- a function that the GraphQL execution engine calls when a client requests that field. In this lesson, we will write resolvers for the entire LaunchPad schema, starting with in-memory data stores and building up from simple Query resolvers to nested type resolvers that traverse the graph.

## What You'll Learn

- How the GraphQL resolver chain works: from Query root to nested type fields
- The four arguments every resolver receives: parent, args, context, and info
- How to create in-memory data stores for development
- How to write Query resolvers for listing and finding entities
- How to write type resolvers that connect related entities (Startup.founder, User.startups, etc.)
- How to test your resolvers interactively in Apollo Sandbox

## Concepts

### How Resolvers Work

When a client sends a query, the GraphQL engine walks through it field by field. For each field, it calls the corresponding resolver function. Consider this query:

```graphql
query {
  startup(id: "1") {
    name
    founder {
      name
    }
  }
}
```

The execution follows these steps:

1. Call the `Query.startup` resolver with args `{ id: "1" }`. It returns a startup object.
2. The `name` field is a scalar (String). The engine reads `startup.name` directly from the object returned in step 1. No resolver needed.
3. The `founder` field is a User type. The engine calls the `Startup.founder` resolver, passing the startup object from step 1 as the `parent` argument.
4. The inner `name` field is a scalar. The engine reads `founder.name` from the object returned in step 3.

This is the resolver chain. The engine starts at the root (Query), resolves each field, and for non-scalar fields, recursively resolves their sub-fields.

### Default Resolvers

You do not need to write a resolver for every field. If a field name matches a property on the parent object, GraphQL uses a default resolver that simply returns `parent[fieldName]`. For example, if your `Query.startup` resolver returns:

```typescript
{ id: '1', name: 'CodeBuddy AI', slug: 'codebuddy-ai', upvotes: 342 }
```

Then the `Startup.id`, `Startup.name`, `Startup.slug`, and `Startup.upvotes` fields all resolve automatically via default resolvers. You only need explicit resolvers for fields that require computation or a lookup -- like `Startup.founder`, which needs to find a User by ID.

### The Resolver Signature

Every resolver function receives four arguments:

```typescript
(parent, args, context, info) => result
```

- `parent` (also called `root` or `source`) -- The return value of the parent resolver. For root Query resolvers, this is undefined. For `Startup.founder`, this is the Startup object returned by `Query.startup`.
- `args` -- The arguments passed to this field. For `startup(id: "1")`, args is `{ id: "1" }`.
- `context` -- A shared object available to all resolvers in a single request. Commonly used for database connections, authenticated user info, and DataLoaders.
- `info` -- Metadata about the query execution (AST, field name, return type, etc.). Rarely used in application code, but useful for advanced optimization.

In practice, you will use `parent` and `args` constantly, `context` frequently, and `info` almost never.

## Step by Step

### Step 1: Create the In-Memory Data Store

Before writing resolvers, we need data to resolve. Create `src/data.ts` with sample data for all four entity types:

```typescript
// src/data.ts

export interface StartupRecord {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  url: string;
  upvotes: number;
  categoryId: string;
  founderId: string;
  createdAt: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
}

export interface CommentRecord {
  id: string;
  content: string;
  startupId: string;
  authorId: string;
  createdAt: string;
}

export const users: UserRecord[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
  },
  {
    id: '2',
    name: 'Alex Rivera',
    email: 'alex@example.com',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
  },
  {
    id: '3',
    name: 'Jordan Lee',
    email: 'jordan@example.com',
    avatarUrl: null,
  },
  {
    id: '4',
    name: 'Maya Patel',
    email: 'maya@example.com',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maya',
  },
  {
    id: '5',
    name: 'Chris Nakamura',
    email: 'chris@example.com',
    avatarUrl: null,
  },
];

export const categories: CategoryRecord[] = [
  { id: '1', name: 'AI/ML', slug: 'ai-ml' },
  { id: '2', name: 'Developer Tools', slug: 'developer-tools' },
  { id: '3', name: 'Fintech', slug: 'fintech' },
  { id: '4', name: 'Health Tech', slug: 'health-tech' },
  { id: '5', name: 'Education', slug: 'education' },
];

export const startups: StartupRecord[] = [
  {
    id: '1',
    name: 'CodeBuddy AI',
    slug: 'codebuddy-ai',
    tagline: 'Your AI pair programming partner',
    description:
      'CodeBuddy AI uses large language models to help you write, review, and debug code faster. It integrates with VS Code, JetBrains, and Neovim.',
    url: 'https://codebuddy.ai',
    upvotes: 342,
    categoryId: '1',
    founderId: '1',
    createdAt: '2026-01-15T10:30:00Z',
  },
  {
    id: '2',
    name: 'DeployBot',
    slug: 'deploybot',
    tagline: 'One-click deployments for any stack',
    description:
      'DeployBot automates your deployment pipeline. Connect your repo, configure your stack, and deploy with a single click. Supports Docker, Kubernetes, and serverless.',
    url: 'https://deploybot.dev',
    upvotes: 218,
    categoryId: '2',
    founderId: '2',
    createdAt: '2026-01-20T14:00:00Z',
  },
  {
    id: '3',
    name: 'FinTrack',
    slug: 'fintrack',
    tagline: 'Personal finance tracking with AI insights',
    description:
      'FinTrack connects to your bank accounts and uses AI to categorize spending, predict bills, and suggest savings opportunities.',
    url: 'https://fintrack.io',
    upvotes: 175,
    categoryId: '3',
    founderId: '3',
    createdAt: '2026-01-25T09:15:00Z',
  },
  {
    id: '4',
    name: 'MedNote',
    slug: 'mednote',
    tagline: 'AI-powered medical note transcription',
    description:
      'MedNote listens to doctor-patient conversations and generates structured medical notes automatically, saving physicians hours of documentation time.',
    url: 'https://mednote.health',
    upvotes: 289,
    categoryId: '4',
    founderId: '4',
    createdAt: '2026-02-01T11:45:00Z',
  },
  {
    id: '5',
    name: 'LearnPath',
    slug: 'learnpath',
    tagline: 'Personalized learning roadmaps',
    description:
      'LearnPath creates custom learning paths based on your goals, current skills, and preferred learning style. Aggregates content from across the web.',
    url: 'https://learnpath.edu',
    upvotes: 156,
    categoryId: '5',
    founderId: '5',
    createdAt: '2026-02-05T16:20:00Z',
  },
  {
    id: '6',
    name: 'SynthVoice',
    slug: 'synthvoice',
    tagline: 'Generate natural-sounding voices for any content',
    description:
      'SynthVoice turns text into natural-sounding speech in over 40 languages. Perfect for podcasts, video narration, and accessibility.',
    url: 'https://synthvoice.ai',
    upvotes: 203,
    categoryId: '1',
    founderId: '2',
    createdAt: '2026-02-08T13:00:00Z',
  },
];

export const comments: CommentRecord[] = [
  {
    id: '1',
    content: 'Love this tool! Saved me hours on code review.',
    startupId: '1',
    authorId: '2',
    createdAt: '2026-02-08T09:15:00Z',
  },
  {
    id: '2',
    content: 'The VS Code integration is seamless. Great work.',
    startupId: '1',
    authorId: '3',
    createdAt: '2026-02-09T11:30:00Z',
  },
  {
    id: '3',
    content: 'How does this compare to GitHub Copilot?',
    startupId: '1',
    authorId: '4',
    createdAt: '2026-02-10T14:45:00Z',
  },
  {
    id: '4',
    content: 'Deployed our staging environment in under 2 minutes. Impressed.',
    startupId: '2',
    authorId: '1',
    createdAt: '2026-02-11T10:00:00Z',
  },
  {
    id: '5',
    content: 'Would love to see Terraform support added.',
    startupId: '2',
    authorId: '5',
    createdAt: '2026-02-12T15:30:00Z',
  },
  {
    id: '6',
    content: 'The AI categorization is surprisingly accurate.',
    startupId: '3',
    authorId: '1',
    createdAt: '2026-02-13T08:20:00Z',
  },
  {
    id: '7',
    content: 'This will transform clinical documentation. Amazing.',
    startupId: '4',
    authorId: '5',
    createdAt: '2026-02-14T12:10:00Z',
  },
  {
    id: '8',
    content: 'As a doctor, I can confirm this saves at least 2 hours per day.',
    startupId: '4',
    authorId: '3',
    createdAt: '2026-02-15T09:45:00Z',
  },
];
```

Notice the data structure. Each record uses flat foreign keys (`founderId`, `categoryId`, `startupId`, `authorId`) rather than nested objects. This mirrors how data is stored in a real database. The resolvers are responsible for looking up related entities.

### Step 2: Write Query Resolvers

Now let's write the resolvers that power our Query type. Update `src/resolvers.ts`:

```typescript
// src/resolvers.ts

import { startups, users, categories, comments } from './data.js';

export const resolvers = {
  Query: {
    startups: () => {
      return startups;
    },

    startup: (_parent: unknown, args: { id: string }) => {
      return startups.find((s) => s.id === args.id) || null;
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
};
```

Let's walk through each resolver:

The `startups` resolver returns the entire startups array. Since it is a root Query resolver, the `parent` argument is undefined (we ignore it). No arguments are needed -- we just return all startups.

The `startup` resolver takes an `id` argument and finds the matching startup. It uses `Array.find()` and returns null if no startup matches. This is why the schema defines `startup(id: ID!): Startup` as nullable -- we return null for "not found."

The `categories` and `category` resolvers follow the same pattern as startups.

The `user` resolver finds a user by ID.

### Step 3: Write Type Resolvers for Startup

Our Query resolvers return flat records with `founderId` and `categoryId`, but the schema expects `founder: User!` and `category: Category!`. We need type resolvers to bridge this gap.

Add the Startup type resolvers to your resolvers object:

```typescript
// src/resolvers.ts

import { startups, users, categories, comments } from './data.js';
import type { StartupRecord, UserRecord, CategoryRecord, CommentRecord } from './data.js';

export const resolvers = {
  Query: {
    startups: () => {
      return startups;
    },

    startup: (_parent: unknown, args: { id: string }) => {
      return startups.find((s) => s.id === args.id) || null;
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

Let's examine how these type resolvers work.

The `Startup.founder` resolver receives the startup record as `parent`. The startup record has a `founderId` field (from our data store), so the resolver looks up the corresponding user. When a client queries `startup { founder { name } }`, the execution goes:

1. `Query.startup` returns a StartupRecord with `founderId: "1"`
2. `Startup.founder` receives that record as parent, finds User with id "1", returns the UserRecord
3. `User.name` uses the default resolver -- reads `name` from the UserRecord

The `Startup.category` resolver works identically, looking up the category by `categoryId`.

The `Startup.comments` resolver uses `filter` instead of `find` because a startup can have multiple comments. It returns all comments whose `startupId` matches the startup's id.

The `User.startups` resolver finds all startups where `founderId` matches the user's id. This enables queries like: "get user 1, and all their startups."

The `Category.startups` resolver finds all startups in a given category.

The `Comment.author` and `Comment.startup` resolvers follow the same pattern, looking up the related entity by foreign key.

### Step 4: Understanding the Resolver Chain in Action

Let's trace through a complete query to solidify your understanding. Consider this query:

```graphql
query {
  startup(id: "1") {
    name
    tagline
    upvotes
    founder {
      name
      email
    }
    category {
      name
    }
    comments {
      content
      author {
        name
      }
    }
  }
}
```

Here is exactly what happens:

Step 1: The engine calls `Query.startup` with args `{ id: "1" }`. This returns:

```
{ id: '1', name: 'CodeBuddy AI', slug: 'codebuddy-ai', tagline: 'Your AI pair programming partner', ..., founderId: '1', categoryId: '1' }
```

Step 2: For `name`, `tagline`, and `upvotes`, the default resolver reads these properties directly from the object.

Step 3: For `founder`, the engine calls `Startup.founder` with the startup as parent. The resolver finds user with id "1" and returns:

```
{ id: '1', name: 'Sarah Chen', email: 'sarah@example.com', avatarUrl: '...' }
```

Step 4: For `founder.name` and `founder.email`, default resolvers read from the user object.

Step 5: For `category`, the engine calls `Startup.category`. Returns:

```
{ id: '1', name: 'AI/ML', slug: 'ai-ml' }
```

Step 6: For `comments`, the engine calls `Startup.comments`. Returns an array of comments with `startupId: "1"`.

Step 7: For each comment, the `content` field uses the default resolver. For `author`, the engine calls `Comment.author` with the comment as parent, which finds the user by `authorId`.

Step 8: For `author.name`, the default resolver reads from the user object.

The final response:

```json
{
  "data": {
    "startup": {
      "name": "CodeBuddy AI",
      "tagline": "Your AI pair programming partner",
      "upvotes": 342,
      "founder": {
        "name": "Sarah Chen",
        "email": "sarah@example.com"
      },
      "category": {
        "name": "AI/ML"
      },
      "comments": [
        {
          "content": "Love this tool! Saved me hours on code review.",
          "author": { "name": "Alex Rivera" }
        },
        {
          "content": "The VS Code integration is seamless. Great work.",
          "author": { "name": "Jordan Lee" }
        },
        {
          "content": "How does this compare to GitHub Copilot?",
          "author": { "name": "Maya Patel" }
        }
      ]
    }
  }
}
```

One request. Nine resolvers called behind the scenes. The client got exactly the data it asked for.

### Step 5: Test in Apollo Sandbox

Start your server with `npm run dev` and open http://localhost:4000 in your browser. Try these queries:

Query 1: List all startups with their categories.

```graphql
query AllStartups {
  startups {
    id
    name
    tagline
    upvotes
    category {
      name
    }
  }
}
```

This calls `Query.startups` (returns 6 startups), then for each startup, calls `Startup.category` (returns the category object), then default resolvers read `name`.

Query 2: Get a single startup with full details.

```graphql
query StartupDetail {
  startup(id: "4") {
    name
    description
    url
    upvotes
    createdAt
    founder {
      name
      avatarUrl
    }
    category {
      name
    }
    comments {
      content
      createdAt
      author {
        name
      }
    }
  }
}
```

Query 3: Get a user and their startups.

```graphql
query UserProfile {
  user(id: "2") {
    name
    email
    startups {
      name
      tagline
      upvotes
    }
  }
}
```

User "2" (Alex Rivera) founded both DeployBot and SynthVoice. The `User.startups` resolver filters the startups array to find both.

Query 4: Browse a category.

```graphql
query CategoryBrowse {
  category(id: "1") {
    name
    startups {
      name
      tagline
      upvotes
      founder {
        name
      }
    }
  }
}
```

Category "1" (AI/ML) has CodeBuddy AI and SynthVoice. Notice how we can traverse: Category -> startups -> founder, three levels deep.

Query 5: Query that returns null.

```graphql
query NotFound {
  startup(id: "999") {
    name
  }
}
```

This returns `{ "data": { "startup": null } }` because no startup has id "999". The client can check for null to handle "not found" cases.

### Step 6: Multiple Root Queries

A client can request multiple root fields in a single query:

```graphql
query Dashboard {
  startups {
    name
    upvotes
  }
  categories {
    name
    slug
  }
  user(id: "1") {
    name
  }
}
```

This calls `Query.startups`, `Query.categories`, and `Query.user` all in one request. The response includes all three at the top level:

```json
{
  "data": {
    "startups": [...],
    "categories": [...],
    "user": { "name": "Sarah Chen" }
  }
}
```

This is another advantage of GraphQL -- you can fetch data for an entire page in one request, even if the data comes from different root queries.

## Why This Pattern Matters

You might have noticed something: our type resolvers make individual lookups for each item. When we query all startups with their founders, the `Startup.founder` resolver runs once per startup -- that is 6 individual `Array.find()` calls.

With in-memory arrays, this is fast. But if these were database queries, we would have an N+1 problem: 1 query to get all startups, plus N queries (one per startup) to get each founder. For 100 startups, that is 101 database queries.

We will solve this in Lesson 07 with DataLoader, which batches those individual lookups into a single query. For now, understand the pattern: resolvers are called per-field, and the parent argument is how data flows through the resolver chain.

## The Context Object

We have not used the `context` argument yet, but it is important to understand. Context is shared across all resolvers in a single request. You typically set it up when creating the server:

```typescript
const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req }) => {
    return {
      // Database connection, authenticated user, DataLoaders, etc.
    };
  },
});
```

In later lessons, we will use context to pass DataLoaders and authentication info. For now, our resolvers use the imported data arrays directly.

## Try It Yourself

Exercise 1: Write a query that gets all comments for startup "2" (DeployBot), including each comment's author name and avatar URL.

Exercise 2: Write a query that gets all categories, and for each category, gets the list of startups with their founder names. How many resolver calls does the engine make?

Exercise 3: Add a new startup to the data array in `src/data.ts`. Put it in the "Developer Tools" category (id: "3") and make user "3" (Jordan Lee) the founder. Verify it appears in query results.

Exercise 4: Add a `commentCount` field to the Startup type. You will need to:
- Add the field to the schema in `src/schema.ts`: `commentCount: Int!`
- Add a resolver in the Startup type resolvers that counts comments for that startup
- Test it in Sandbox

## Key Takeaways

- Resolvers are functions that fetch data for each field in the schema. The GraphQL engine calls them as it walks through the query.
- The default resolver reads `parent[fieldName]` automatically. You only need explicit resolvers for fields that require lookups or computation.
- Every resolver receives four arguments: parent (the return value from the parent resolver), args (field arguments), context (shared per-request state), and info (query metadata).
- Type resolvers (like Startup.founder) bridge the gap between flat data records (with foreign keys) and the graph structure clients expect.
- The resolver chain flows from root (Query) through types to scalars, with the parent argument carrying data down the chain.
- Multiple root fields can be queried in a single request, letting clients fetch everything a page needs at once.

## Next Steps

Our resolvers work, but the `startups` query returns all startups with no way to filter, paginate, or sort them. In the next lesson, we will add arguments to our queries -- pagination, search, category filtering, and sorting -- to make our API practical for real applications.
