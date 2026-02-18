# Schema Design

The schema is the foundation of every GraphQL API. Before writing a single line of resolver code, you define the shape of your data and the operations your API supports. This is one of GraphQL's greatest strengths: the schema serves as a contract, documentation, and type system all in one.

In this lesson, we will learn the Schema Definition Language (SDL), design the complete LaunchPad schema, and set up a running Apollo Server instance that serves it.

## What You'll Learn

- How to write GraphQL types using the Schema Definition Language (SDL)
- The built-in scalar types: String, Int, Float, Boolean, and ID
- How to express required fields with `!` and lists with `[Type]`
- How to design types for Startup, User, Category, and Comment
- How to define Query and Mutation root types
- How to set up Apollo Server 4 with TypeScript and ESM modules

## Understanding SDL

SDL (Schema Definition Language) is the language used to define a GraphQL schema. It is declarative, readable, and looks like a simplified version of TypeScript interfaces.

Here is the simplest possible SDL definition:

```graphql
type Query {
  hello: String
}
```

This defines a schema with one query field called `hello` that returns a String. A client could query it like this:

```graphql
query {
  hello
}
```

And receive:

```json
{
  "data": {
    "hello": "Hello, world!"
  }
}
```

Let's break down the building blocks of SDL.

### Object Types

The most fundamental unit in SDL is the object type. It defines a named type with a set of fields:

```graphql
type Startup {
  id: ID!
  name: String!
  upvotes: Int!
}
```

This says: "A Startup is an object with three fields. The `id` field returns a non-null ID, the `name` field returns a non-null String, and the `upvotes` field returns a non-null Int."

### Scalar Types

GraphQL has five built-in scalar types:

- `String` -- UTF-8 text, like "CodeBuddy AI"
- `Int` -- A 32-bit signed integer, like 342
- `Float` -- A double-precision floating-point number, like 4.5
- `Boolean` -- true or false
- `ID` -- A unique identifier, serialized as a String. It signals to the client that this field is an opaque identifier, not a human-readable string

You can also define custom scalar types (like DateTime), which we will explore later.

### Non-Null Types (the `!` modifier)

By default, every field in GraphQL is nullable. Adding `!` after a type makes it non-null:

```graphql
type User {
  name: String!    # never null -- always returns a String
  avatarUrl: String  # nullable -- might return null
}
```

This is the opposite of TypeScript, where fields are required by default and you add `?` to make them optional. In GraphQL, you add `!` to make them required. The reasoning: in a distributed system, any field might fail to resolve, so nullable-by-default is the safer choice.

A good rule of thumb: use `!` for fields that are guaranteed to have a value (like an id or name), and leave `!` off for fields that might legitimately be absent (like an optional avatar URL or bio).

### List Types

Square brackets indicate a list:

```graphql
type Category {
  startups: [Startup!]!
}
```

The notation `[Startup!]!` means:

- The outer `!` means the field itself is non-null (you always get a list, never null)
- The inner `!` means each item in the list is non-null (no null elements)

Here are the four possible list combinations:

- `[Startup]` -- The list itself can be null, and items can be null
- `[Startup]!` -- The list is always present, but items can be null
- `[Startup!]` -- The list can be null, but if present, items are non-null
- `[Startup!]!` -- The list is always present and items are always non-null

In practice, `[Type!]!` (always a list, never null items) is the most common pattern for collections. Use `[Type]!` if items can legitimately be null (rare).

### Relationships Between Types

GraphQL types can reference each other, forming a graph (hence the name):

```graphql
type Startup {
  id: ID!
  name: String!
  founder: User!
  comments: [Comment!]!
}

type User {
  id: ID!
  name: String!
  startups: [Startup!]!
}

type Comment {
  id: ID!
  content: String!
  author: User!
  startup: Startup!
}
```

Notice how Startup references User and Comment, User references Startup, and Comment references both. This is the "graph" in GraphQL -- types are nodes and references are edges. Clients can traverse this graph to any depth in a single query.

## Designing the LaunchPad Schema

Now let's design the complete schema for our LaunchPad startup directory. We will think through each type carefully.

### The Startup Type

A startup is the core entity in LaunchPad:

```graphql
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
```

Design decisions:

- `slug` is a URL-friendly version of the name (e.g., "codebuddy-ai"). We store it separately so clients can use it for routing.
- `upvotes` is an Int, not a list of users who upvoted. We will track individual upvotes separately if needed, but the count is what most views need.
- `createdAt` is a String for now. We will represent ISO 8601 timestamps as strings. (Custom scalar types like DateTime are possible but add complexity we do not need yet.)
- `founder` is a User reference, not a founderId. In GraphQL, you expose the relationship, not the foreign key. The resolver handles the lookup.
- `category` is a Category reference. Same principle as founder.
- `comments` is a list of Comment objects. Clients can query them in the same request as the startup.

### The User Type

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  avatarUrl: String
  startups: [Startup!]!
}
```

Design decisions:

- `email` is non-null because every user has an email.
- `avatarUrl` is nullable because not every user uploads an avatar.
- `startups` returns all startups this user has founded.

### The Category Type

```graphql
type Category {
  id: ID!
  name: String!
  slug: String!
  startups: [Startup!]!
}
```

Design decisions:

- Categories are simple: a name, a slug, and the list of startups in that category.
- `startups` allows queries like "show me all AI/ML startups" in a single request.

### The Comment Type

```graphql
type Comment {
  id: ID!
  content: String!
  createdAt: String!
  author: User!
  startup: Startup!
}
```

Design decisions:

- `author` links to the User who wrote the comment.
- `startup` links back to the Startup the comment belongs to.
- `content` is the comment text. We keep it simple for now (no rich text, no replies).

### The Query Type

The Query type is special -- it defines the entry points for reading data:

```graphql
type Query {
  startups: [Startup!]!
  startup(id: ID!): Startup
  categories: [Category!]!
  category(id: ID!): Category
  user(id: ID!): User
}
```

Design decisions:

- `startups` returns all startups (we will add pagination in Lesson 04).
- `startup(id: ID!)` returns a single startup by ID. It returns `Startup` (nullable) because the ID might not exist.
- `categories` returns all categories. Since there are typically few categories, we do not need pagination here.
- `category(id: ID!)` returns a single category. Nullable for the same reason as startup.
- `user(id: ID!)` returns a single user by ID. Nullable in case the user does not exist.

Notice the pattern: list queries (startups, categories) return non-null lists, while single-entity queries (startup, category, user) return nullable types. This is a common convention -- it lets the client distinguish between "not found" (null) and an error.

### The Mutation Type

The Mutation type defines operations that change data:

```graphql
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

type Mutation {
  createStartup(input: CreateStartupInput!): Startup!
  updateStartup(id: ID!, input: UpdateStartupInput!): Startup
  deleteStartup(id: ID!): Boolean!
  upvoteStartup(id: ID!): Startup
  createComment(startupId: ID!, content: String!, authorId: ID!): Comment!
}
```

Design decisions:

- We use input types (CreateStartupInput, UpdateStartupInput) to group mutation arguments. This is a GraphQL best practice -- it keeps mutation signatures clean and makes it easy to add new fields later.
- `CreateStartupInput` has all required fields with `!`. You cannot create a startup without a name, tagline, and so on.
- `UpdateStartupInput` has all optional fields (no `!`). You only send the fields you want to change.
- `createStartup` returns `Startup!` (non-null) because a successful creation always produces a startup.
- `updateStartup` returns `Startup` (nullable) because the ID might not exist.
- `deleteStartup` returns `Boolean!` indicating success or failure.
- `upvoteStartup` returns the updated `Startup` (nullable in case the startup does not exist).
- `createComment` takes individual arguments instead of an input type because there are only three fields. Both approaches are valid.

## Step by Step

### Step 1: Initialize the Project

Make sure you have the project dependencies installed. From the course root directory:

```bash
npm install
```

This installs all the packages defined in package.json: @apollo/server, graphql, dataloader, zod, dotenv, TypeScript, tsx, and vitest.

### Step 2: Create the Schema File

Create `src/schema.ts` with the complete type definitions:

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
    startups: [Startup!]!
    startup(id: ID!): Startup
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

A few things to notice about this file:

The template literal is tagged with `#graphql`. This is a comment that tells code editors (like VS Code with the GraphQL extension) to syntax-highlight the contents as GraphQL. It does not affect the runtime behavior.

We export `typeDefs` as a plain string. Apollo Server accepts type definitions as a string, a DocumentNode (parsed AST), or an array of either. A string is the simplest approach.

All our types, inputs, queries, and mutations are defined in one string. For larger schemas, you might split this across multiple files and concatenate them, but for our schema this is perfectly manageable.

### Step 3: Create a Minimal Resolver

Apollo Server requires resolvers for every query field. For now, we will create placeholder resolvers that return empty data. We will implement real resolvers in the next lesson.

Create `src/resolvers.ts`:

```typescript
// src/resolvers.ts

export const resolvers = {
  Query: {
    startups: () => [],
    startup: () => null,
    categories: () => [],
    category: () => null,
    user: () => null,
  },
  Mutation: {
    createStartup: () => {
      throw new Error('Not implemented');
    },
    updateStartup: () => {
      throw new Error('Not implemented');
    },
    deleteStartup: () => {
      throw new Error('Not implemented');
    },
    upvoteStartup: () => {
      throw new Error('Not implemented');
    },
    createComment: () => {
      throw new Error('Not implemented');
    },
  },
};
```

These placeholder resolvers let the server start without errors. The `startups` query returns an empty array, single-entity queries return null (not found), and mutations throw errors since we have not implemented them yet.

### Step 4: Set Up Apollo Server

Create `src/index.ts` -- the entry point for our server:

```typescript
// src/index.ts

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
});

console.log('Server ready at ' + url);
```

Important details about this file:

We import from `./schema.js` and `./resolvers.js` (with the `.js` extension), not `.ts`. This is required for ESM modules with TypeScript's NodeNext module resolution. TypeScript compiles `.ts` files to `.js`, and ESM requires the output extension in import paths.

`ApolloServer` is the core class. You pass it your type definitions and resolvers, and it handles parsing queries, validating them against the schema, and executing resolvers.

`startStandaloneServer` is a convenience function that wraps Apollo Server in a basic HTTP server. It is perfect for development. For production, you would integrate Apollo Server with Express, Fastify, or another HTTP framework.

We use top-level `await` because our project uses ESM modules (`"type": "module"` in package.json). Top-level await is supported in ESM.

### Step 5: Start the Server

Run the development server:

```bash
npm run dev
```

This runs `tsx watch src/index.ts`, which compiles and runs the TypeScript file, restarting on changes. You should see:

```
Server ready at http://localhost:4000/
```

### Step 6: Explore With Apollo Sandbox

Open http://localhost:4000 in your browser. Apollo Server 4 automatically serves Apollo Sandbox in development mode. You will see an interactive IDE where you can:

- Browse the schema in the left panel (click the schema/docs icon)
- Write queries in the center editor
- See results in the right panel

Try running this query in the Sandbox editor:

```graphql
query {
  startups {
    id
    name
  }
}
```

You should get back:

```json
{
  "data": {
    "startups": []
  }
}
```

An empty array, as expected from our placeholder resolver. Now try:

```graphql
query {
  startup(id: "1") {
    name
  }
}
```

You should get:

```json
{
  "data": {
    "startup": null
  }
}
```

Null, because our resolver returns null for all single-entity queries. The schema is working correctly.

Now explore the schema documentation in Sandbox. Click the book icon or the "Schema" tab to see all your types, their fields, and their descriptions. This is one of GraphQL's superpowers -- the schema is self-documenting.

### Step 7: Verify the Schema Is Valid

Apollo Sandbox also validates your schema. If you had a typo in your SDL (like referencing a type that does not exist), the server would fail to start with a clear error message. Try it -- temporarily change `founder: User!` to `founder: Userrr!` in your schema file, save, and watch the console. You will see:

```
Error: Unknown type "Userrr".
```

This is the schema validation at work. Fix the typo and the server restarts automatically.

## Understanding the Type System in Depth

Before we move on, let's go deeper on a few type system concepts that will matter in later lessons.

### Input Types vs Object Types

You might have noticed we used `input` instead of `type` for CreateStartupInput and UpdateStartupInput. In GraphQL, there is a distinction:

- `type` defines output types -- the shape of data returned by the server
- `input` defines input types -- the shape of data sent by the client

You cannot use a `type` as an argument to a query or mutation. You must use `input`. This separation exists because output types can have fields that resolve to other types (like `Startup.founder`), which would not make sense as client-provided input.

```graphql
# This is an output type -- returned by the server
type Startup {
  id: ID!
  name: String!
  founder: User!  # This field requires a resolver
}

# This is an input type -- sent by the client
input CreateStartupInput {
  name: String!
  founderId: ID!  # Client sends an ID, not a full User object
}
```

### Enum Types

GraphQL supports enums for fields with a fixed set of values. We will add these in Lesson 04, but here is a preview:

```graphql
enum SortBy {
  NEWEST
  OLDEST
  UPVOTES_DESC
  UPVOTES_ASC
}

type Query {
  startups(sortBy: SortBy): [Startup!]!
}
```

### The Schema Entry Points

Every GraphQL schema has up to three root types:

- `Query` -- for read operations (required)
- `Mutation` -- for write operations (optional)
- `Subscription` -- for real-time updates (optional)

These are the entry points into your type graph. A client always starts at Query, Mutation, or Subscription and traverses from there.

## Try It Yourself

Now it is your turn to extend the schema.

Exercise 1: Add a `startupCount` field to the Query type that returns an `Int!` representing the total number of startups. Update the resolver to return 0 for now.

Exercise 2: Add a `bio` field to the User type. It should be a nullable String (not every user has a bio).

Exercise 3: Add a `featured` field to the Startup type (a Boolean!) and a `featuredStartups` query that returns `[Startup!]!`. Think about what the resolver should return.

Exercise 4: Look at the schema you have written and consider: if you were building a startup listing page that shows each startup's name, tagline, upvote count, category name, and founder name, what GraphQL query would you write? Write it out in the Sandbox and run it.

## Key Takeaways

- SDL (Schema Definition Language) is the purpose-built language for defining GraphQL schemas. It is readable, declarative, and forms the contract between client and server.
- GraphQL has five built-in scalar types: String, Int, Float, Boolean, and ID.
- The `!` modifier makes a field non-null. Without it, fields are nullable by default.
- List types use square brackets: `[Type!]!` means a non-null list of non-null items.
- Object types (type) define output shapes. Input types (input) define argument shapes for queries and mutations.
- The Query type defines read operations. The Mutation type defines write operations.
- Apollo Server takes your typeDefs and resolvers, validates the schema, and serves it over HTTP with an interactive Sandbox for exploration.
- Always design your schema from the client's perspective: what data does each view need?

## Next Steps

Our schema is defined and our server is running, but every query returns empty data. In the next lesson, we will bring the schema to life by writing resolvers -- the functions that fetch actual data for each field.
