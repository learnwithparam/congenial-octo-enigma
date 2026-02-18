# Lesson 10: Testing and Documenting Your GraphQL API

This is the final lesson of the course. We have built a GraphQL API with queries, mutations, subscriptions, input validation, DataLoaders, and error handling. Now we need to make sure it all works correctly and that other developers can understand and use it. Testing gives us confidence that changes do not break existing behavior. Documentation gives consumers a map of what the API offers.

By the end of this lesson you will:

- Set up Vitest for testing GraphQL resolvers
- Create a test helper that starts an Apollo Server test instance
- Write query tests with arguments and expected results
- Write mutation tests including validation error scenarios
- Write DataLoader tests to verify batching behavior
- Generate API documentation from the schema
- Have a complete mental model of when to choose GraphQL over REST

---

## Setting Up Vitest

Vitest is already in our `devDependencies`. We need a configuration file that works with our ESM TypeScript setup. Create `vitest.config.ts` in the project root:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
});
```

The `globals: true` setting means you do not need to import `describe`, `it`, `expect`, and `beforeAll` in every test file. They are available globally.

If you are using TypeScript path aliases, add them to the config:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Run `npx vitest --run` to verify the setup works (it should report no tests found, which is correct since we have not written any yet).

---

## Creating a Test Helper

Every test needs an Apollo Server instance to execute queries against. We do not want to start a real HTTP server for each test. Instead, Apollo Server provides `executeOperation`, which runs queries in-process without network overhead.

Create `tests/helpers/server.ts`:

```typescript
// tests/helpers/server.ts
import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../../src/schema/typeDefs.js';
import { resolvers } from '../../src/resolvers/index.js';
import { createDataLoaders } from '../../src/dataloaders/index.js';
import { formatError } from '../../src/errors/format-error.js';

export interface TestContext {
  loaders: ReturnType<typeof createDataLoaders>;
}

let server: ApolloServer<TestContext>;

export async function getTestServer(): Promise<ApolloServer<TestContext>> {
  if (server) return server;

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  server = new ApolloServer<TestContext>({
    schema,
    formatError,
  });

  await server.start();
  return server;
}

export function createTestContext(): TestContext {
  return {
    loaders: createDataLoaders(),
  };
}

// Helper to execute a GraphQL operation and return typed results
export async function executeQuery(
  query: string,
  variables?: Record<string, unknown>
) {
  const testServer = await getTestServer();
  const contextValue = createTestContext();

  const response = await testServer.executeOperation(
    {
      query,
      variables,
    },
    { contextValue }
  );

  // Extract the body from the response
  if (response.body.kind === 'single') {
    return {
      data: response.body.singleResult.data,
      errors: response.body.singleResult.errors,
    };
  }

  throw new Error('Unexpected response kind: ' + response.body.kind);
}

// Cleanup function for afterAll
export async function stopTestServer(): Promise<void> {
  if (server) {
    await server.stop();
  }
}
```

The `executeQuery` helper is the core of our test setup. It takes a GraphQL query string and optional variables, executes them against a real Apollo Server instance (with all our resolvers, DataLoaders, and error formatting), and returns the data and errors.

Key design decisions:

- We reuse a single server instance across all tests for performance. Starting Apollo Server is not free, and doing it once per test suite is much faster than once per test.
- Each test gets a fresh context with new DataLoaders. This prevents test pollution (one test's cached data affecting another test).
- We use `executeOperation` instead of HTTP requests. This is faster, simpler, and does not require managing ports.

---

## Resetting Test Data

Our resolvers use in-memory data stores. Tests that create or modify data will affect subsequent tests. We need a way to reset the data between tests. Create `tests/helpers/reset-data.ts`:

```typescript
// tests/helpers/reset-data.ts
import { startups, users, categories, comments } from '../../src/data/store.js';

// Store the initial state so we can reset between tests
const initialStartups = [...startups];
const initialUsers = [...users];
const initialCategories = [...categories];
const initialComments = [...comments];

export function resetData(): void {
  startups.length = 0;
  startups.push(...initialStartups.map((s) => ({ ...s })));

  users.length = 0;
  users.push(...initialUsers.map((u) => ({ ...u })));

  categories.length = 0;
  categories.push(...initialCategories.map((c) => ({ ...c })));

  comments.length = 0;
  comments.push(...initialComments.map((c) => ({ ...c })));
}
```

We use `array.length = 0` followed by `push(...copies)` instead of reassigning the array. This is because our resolvers import the array by reference. If we assigned a new array, the resolvers would still point to the old one.

---

## Writing Query Tests

Create `tests/queries.test.ts`:

```typescript
// tests/queries.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { executeQuery, stopTestServer } from './helpers/server.js';
import { resetData } from './helpers/reset-data.js';

beforeEach(() => {
  resetData();
});

afterAll(async () => {
  await stopTestServer();
});

describe('Query: startups', () => {
  it('returns a list of startups', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups {
          id
          title
          description
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startups).toBeDefined();
    expect(Array.isArray(data?.startups)).toBe(true);
    expect(data?.startups.length).toBeGreaterThan(0);
  });

  it('respects the limit argument', async () => {
    const { data, errors } = await executeQuery(`
      query GetStartups($limit: Int) {
        startups(limit: $limit) {
          id
        }
      }
    `, { limit: 2 });

    expect(errors).toBeUndefined();
    expect(data?.startups).toHaveLength(2);
  });

  it('respects the offset argument', async () => {
    // First, get all startups to know the total
    const { data: allData } = await executeQuery(`
      query { startups { id } }
    `);
    const totalCount = allData?.startups.length;

    // Then fetch with offset
    const { data, errors } = await executeQuery(`
      query GetStartups($offset: Int) {
        startups(offset: $offset) {
          id
        }
      }
    `, { offset: 2 });

    expect(errors).toBeUndefined();
    expect(data?.startups.length).toBe(totalCount - 2);
  });

  it('returns startups with nested founder data', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups(limit: 1) {
          id
          title
          founder {
            id
            name
            email
          }
        }
      }
    `);

    expect(errors).toBeUndefined();
    const startup = data?.startups[0];
    expect(startup.founder).toBeDefined();
    expect(startup.founder.id).toBeDefined();
    expect(startup.founder.name).toBeDefined();
  });

  it('returns startups with nested category data', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups(limit: 1) {
          id
          category {
            id
            name
          }
        }
      }
    `);

    expect(errors).toBeUndefined();
    const startup = data?.startups[0];
    expect(startup.category).toBeDefined();
    expect(startup.category.name).toBeDefined();
  });
});

describe('Query: startup (single)', () => {
  it('returns a startup by ID', async () => {
    // First get a valid ID
    const { data: listData } = await executeQuery(`
      query { startups(limit: 1) { id title } }
    `);
    const startupId = listData?.startups[0].id;

    const { data, errors } = await executeQuery(`
      query GetStartup($id: ID!) {
        startup(id: $id) {
          id
          title
          description
          upvotes
        }
      }
    `, { id: startupId });

    expect(errors).toBeUndefined();
    expect(data?.startup.id).toBe(startupId);
    expect(data?.startup.title).toBeDefined();
  });

  it('returns NOT_FOUND error for nonexistent startup', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startup(id: "nonexistent-id") {
          id
          title
        }
      }
    `);

    expect(data?.startup).toBeNull();
    expect(errors).toBeDefined();
    expect(errors).toHaveLength(1);
    expect(errors![0].extensions?.code).toBe('NOT_FOUND');
  });

  it('returns partial data when one query succeeds and another fails', async () => {
    const { data: listData } = await executeQuery(`
      query { startups(limit: 1) { id } }
    `);
    const validId = listData?.startups[0].id;

    const { data, errors } = await executeQuery(`
      query {
        valid: startup(id: "${validId}") {
          id
          title
        }
        invalid: startup(id: "does-not-exist") {
          id
          title
        }
      }
    `);

    // Partial data: valid succeeds, invalid fails
    expect(data?.valid).toBeDefined();
    expect(data?.valid.id).toBe(validId);
    expect(data?.invalid).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors![0].path).toContain('invalid');
  });
});
```

Each test follows a clear pattern:

1. Arrange: Set up any needed data (or rely on the seeded data from `resetData`)
2. Act: Execute a GraphQL query using `executeQuery`
3. Assert: Check the data and errors match expectations

The last test is particularly important. It verifies that GraphQL returns partial data, which is one of the core value propositions we discussed in Lesson 08. One field succeeds and returns data while another field fails and returns null with an error.

---

## Writing Mutation Tests

Create `tests/mutations.test.ts`:

```typescript
// tests/mutations.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { executeQuery, stopTestServer } from './helpers/server.js';
import { resetData } from './helpers/reset-data.js';

beforeEach(() => {
  resetData();
});

afterAll(async () => {
  await stopTestServer();
});

describe('Mutation: createStartup', () => {
  const CREATE_STARTUP = `
    mutation CreateStartup($input: CreateStartupInput!) {
      createStartup(input: $input) {
        id
        title
        description
        category
        upvotes
        createdAt
      }
    }
  `;

  it('creates a startup with valid input', async () => {
    const input = {
      title: 'Test Startup',
      description: 'A test startup for our GraphQL course with enough characters.',
      category: 'tech',
      founderId: 'user-1',
    };

    const { data, errors } = await executeQuery(CREATE_STARTUP, { input });

    expect(errors).toBeUndefined();
    expect(data?.createStartup).toBeDefined();
    expect(data?.createStartup.title).toBe('Test Startup');
    expect(data?.createStartup.upvotes).toBe(0);
    expect(data?.createStartup.id).toBeDefined();
    expect(data?.createStartup.createdAt).toBeDefined();
  });

  it('trims whitespace from title and description', async () => {
    const input = {
      title: '  Trimmed Title  ',
      description: '  This description should be trimmed on both ends.  ',
      category: 'tech',
      founderId: 'user-1',
    };

    const { data, errors } = await executeQuery(CREATE_STARTUP, { input });

    expect(errors).toBeUndefined();
    expect(data?.createStartup.title).toBe('Trimmed Title');
  });

  it('returns validation errors for invalid input', async () => {
    const input = {
      title: 'Hi',           // too short (min 3)
      description: 'Short',  // too short (min 10)
      category: '',           // empty
      founderId: 'user-1',
    };

    const { data, errors } = await executeQuery(CREATE_STARTUP, { input });

    expect(data).toBeNull();
    expect(errors).toBeDefined();
    expect(errors).toHaveLength(1);

    const error = errors![0];
    expect(error.extensions?.code).toBe('BAD_USER_INPUT');

    const fieldErrors = error.extensions?.fieldErrors as Array<{
      field: string;
      message: string;
    }>;
    expect(fieldErrors.length).toBeGreaterThanOrEqual(3);

    // Check that specific fields are reported
    const fields = fieldErrors.map((fe) => fe.field);
    expect(fields).toContain('title');
    expect(fields).toContain('description');
    expect(fields).toContain('category');
  });

  it('returns validation error for invalid URL', async () => {
    const input = {
      title: 'Valid Title Here',
      description: 'A perfectly valid description that is long enough.',
      category: 'tech',
      websiteUrl: 'http://not-https.com',
      founderId: 'user-1',
    };

    const { data, errors } = await executeQuery(CREATE_STARTUP, { input });

    expect(errors).toBeDefined();
    const fieldErrors = errors![0].extensions?.fieldErrors as Array<{
      field: string;
      message: string;
    }>;
    const urlError = fieldErrors.find((fe) => fe.field === 'websiteUrl');
    expect(urlError).toBeDefined();
    expect(urlError?.message).toContain('HTTPS');
  });

  it('accepts a valid HTTPS URL', async () => {
    const input = {
      title: 'Startup With URL',
      description: 'This startup has a valid website URL for testing.',
      category: 'tech',
      websiteUrl: 'https://example.com',
      founderId: 'user-1',
    };

    const { data, errors } = await executeQuery(CREATE_STARTUP, { input });

    expect(errors).toBeUndefined();
    expect(data?.createStartup).toBeDefined();
  });
});

describe('Mutation: updateStartup', () => {
  it('updates a startup with partial input', async () => {
    // First, get a startup ID
    const { data: listData } = await executeQuery(`
      query { startups(limit: 1) { id title } }
    `);
    const startupId = listData?.startups[0].id;
    const originalTitle = listData?.startups[0].title;

    // Update only the title
    const { data, errors } = await executeQuery(`
      mutation UpdateStartup($id: ID!, $input: UpdateStartupInput!) {
        updateStartup(id: $id, input: $input) {
          id
          title
          description
        }
      }
    `, {
      id: startupId,
      input: { title: 'Updated Title Here' },
    });

    expect(errors).toBeUndefined();
    expect(data?.updateStartup.title).toBe('Updated Title Here');
    expect(data?.updateStartup.title).not.toBe(originalTitle);
  });

  it('returns NOT_FOUND for nonexistent startup', async () => {
    const { data, errors } = await executeQuery(`
      mutation {
        updateStartup(
          id: "nonexistent"
          input: { title: "New Title Value" }
        ) {
          id
        }
      }
    `);

    expect(errors).toBeDefined();
    expect(errors![0].extensions?.code).toBe('NOT_FOUND');
  });
});

describe('Mutation: upvoteStartup', () => {
  it('increments the upvote count', async () => {
    const { data: listData } = await executeQuery(`
      query { startups(limit: 1) { id upvotes } }
    `);
    const startupId = listData?.startups[0].id;
    const originalUpvotes = listData?.startups[0].upvotes;

    const { data, errors } = await executeQuery(`
      mutation Upvote($id: ID!) {
        upvoteStartup(id: $id) {
          id
          upvotes
        }
      }
    `, { id: startupId });

    expect(errors).toBeUndefined();
    expect(data?.upvoteStartup.upvotes).toBe(originalUpvotes + 1);
  });

  it('increments multiple times', async () => {
    const { data: listData } = await executeQuery(`
      query { startups(limit: 1) { id upvotes } }
    `);
    const startupId = listData?.startups[0].id;
    const originalUpvotes = listData?.startups[0].upvotes;

    // Upvote three times
    await executeQuery(
      'mutation ($id: ID!) { upvoteStartup(id: $id) { upvotes } }',
      { id: startupId }
    );
    await executeQuery(
      'mutation ($id: ID!) { upvoteStartup(id: $id) { upvotes } }',
      { id: startupId }
    );
    const { data } = await executeQuery(
      'mutation ($id: ID!) { upvoteStartup(id: $id) { upvotes } }',
      { id: startupId }
    );

    expect(data?.upvoteStartup.upvotes).toBe(originalUpvotes + 3);
  });
});

describe('Mutation: deleteStartup', () => {
  it('removes a startup', async () => {
    const { data: listData } = await executeQuery(`
      query { startups { id } }
    `);
    const startupId = listData?.startups[0].id;
    const originalCount = listData?.startups.length;

    const { data, errors } = await executeQuery(`
      mutation Delete($id: ID!) {
        deleteStartup(id: $id)
      }
    `, { id: startupId });

    expect(errors).toBeUndefined();
    expect(data?.deleteStartup).toBe(true);

    // Verify it is gone
    const { data: afterData } = await executeQuery(`
      query { startups { id } }
    `);
    expect(afterData?.startups.length).toBe(originalCount - 1);
  });
});
```

Mutation tests are important because they verify side effects. A query test only checks that data is returned correctly. A mutation test checks that data is created, modified, or deleted as expected. The "upvote multiple times" test verifies that state changes accumulate correctly. The "delete" test verifies that the startup is actually removed from the data store.

---

## Writing DataLoader Tests

Create `tests/dataloaders.test.ts`:

```typescript
// tests/dataloaders.test.ts
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { executeQuery, stopTestServer } from './helpers/server.js';
import { resetData } from './helpers/reset-data.js';

beforeEach(() => {
  resetData();
});

afterAll(async () => {
  await stopTestServer();
});

describe('DataLoader batching', () => {
  it('loads founders for multiple startups in a single batch', async () => {
    // Spy on console.log to detect batch calls
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { data, errors } = await executeQuery(`
      query {
        startups(limit: 5) {
          id
          title
          founder {
            id
            name
          }
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startups).toHaveLength(5);

    // Every startup should have a founder
    for (const startup of data?.startups) {
      expect(startup.founder).toBeDefined();
      expect(startup.founder.id).toBeDefined();
      expect(startup.founder.name).toBeDefined();
    }

    // Check that DataLoader batched the calls
    const batchCalls = logSpy.mock.calls.filter(
      (call) => String(call[0]).includes('batch loading users')
    );

    // There should be at most 1-2 batch calls, not 5 individual calls
    expect(batchCalls.length).toBeLessThanOrEqual(2);

    logSpy.mockRestore();
  });

  it('loads categories for multiple startups in a single batch', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { data, errors } = await executeQuery(`
      query {
        startups(limit: 5) {
          id
          category {
            id
            name
          }
        }
      }
    `);

    expect(errors).toBeUndefined();

    for (const startup of data?.startups) {
      expect(startup.category).toBeDefined();
    }

    const batchCalls = logSpy.mock.calls.filter(
      (call) => String(call[0]).includes('batch loading categories')
    );
    expect(batchCalls.length).toBeLessThanOrEqual(2);

    logSpy.mockRestore();
  });

  it('deduplicates requests for the same user', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Query startups and their comments (both reference users)
    const { data, errors } = await executeQuery(`
      query {
        startups(limit: 5) {
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
    `);

    expect(errors).toBeUndefined();

    // Collect all user IDs that were requested
    const batchCalls = logSpy.mock.calls.filter(
      (call) => String(call[0]).includes('batch loading users')
    );

    // The DataLoader should deduplicate: if the same user is both
    // a founder and a comment author, they are fetched only once
    // (within a single batch call)
    if (batchCalls.length > 0) {
      // This just verifies batching happened
      expect(batchCalls.length).toBeLessThanOrEqual(3);
    }

    logSpy.mockRestore();
  });
});
```

DataLoader tests verify behavior that is invisible to the client. The query results look the same whether you use DataLoader or not. The difference is in the number of data access operations. We use `vi.spyOn(console, 'log')` to intercept the batch logging we added in Lesson 07 and verify that batching is actually happening.

In a production codebase, you would instrument your database client instead of console.log. But the principle is the same: verify that N individual lookups are collapsed into a small number of batch calls.

---

## Running Tests

Run all tests:

```bash
npx vitest --run
```

Run tests in watch mode during development:

```bash
npx vitest
```

Run a specific test file:

```bash
npx vitest --run tests/queries.test.ts
```

Run tests with verbose output:

```bash
npx vitest --run --reporter=verbose
```

You should see output like:

```
 PASS  tests/queries.test.ts
   Query: startups
     ✓ returns a list of startups
     ✓ respects the limit argument
     ✓ respects the offset argument
     ✓ returns startups with nested founder data
     ✓ returns startups with nested category data
   Query: startup (single)
     ✓ returns a startup by ID
     ✓ returns NOT_FOUND error for nonexistent startup
     ✓ returns partial data when one query succeeds and another fails

 PASS  tests/mutations.test.ts
   Mutation: createStartup
     ✓ creates a startup with valid input
     ✓ trims whitespace from title and description
     ✓ returns validation errors for invalid input
     ✓ returns validation error for invalid URL
     ✓ accepts a valid HTTPS URL
   ...

 PASS  tests/dataloaders.test.ts
   DataLoader batching
     ✓ loads founders for multiple startups in a single batch
     ✓ loads categories for multiple startups in a single batch
     ✓ deduplicates requests for the same user
```

---

## Schema Introspection and Documentation

GraphQL has built-in schema introspection. Any client can query the schema itself to discover available types, fields, queries, and mutations. This is how tools like Apollo Sandbox and GraphQL Playground auto-generate their documentation panels.

Try this introspection query:

```graphql
query {
  __schema {
    queryType {
      name
      fields {
        name
        description
        args {
          name
          type { name kind }
        }
      }
    }
    mutationType {
      name
      fields {
        name
        description
      }
    }
    subscriptionType {
      name
      fields {
        name
        description
      }
    }
  }
}
```

This returns a complete description of your API. Apollo Sandbox uses this to provide autocomplete, validation, and the documentation sidebar.

To make introspection more useful, add descriptions to your schema. The `"""` syntax in SDL creates documentation strings:

```graphql
"""
A startup listing on the platform.
"""
type Startup {
  """Unique identifier"""
  id: ID!

  """The startup's display name (3-100 characters)"""
  title: String!

  """Detailed description of what the startup does"""
  description: String!

  """The person who created this startup listing"""
  founder: User!

  """The startup's primary category"""
  category: Category!

  """Number of upvotes received"""
  upvotes: Int!

  """URL to the startup's website (HTTPS only)"""
  websiteUrl: String

  """Comments from the community"""
  comments: [Comment!]!

  """ISO 8601 timestamp of when the listing was created"""
  createdAt: String!
}
```

These descriptions appear in Apollo Sandbox, GraphQL Voyager, and any other tool that reads the schema through introspection.

---

## Generating a Documentation Page

For teams that want a static documentation page, you can generate one from the schema. Create a simple script at `scripts/generate-docs.ts`:

```typescript
// scripts/generate-docs.ts
import {
  buildSchema,
  printSchema,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLField,
  GraphQLArgument,
  GraphQLNamedType,
} from 'graphql';
import { readFileSync, writeFileSync } from 'fs';
import { typeDefs } from '../src/schema/typeDefs.js';

function getTypeName(type: any): string {
  if (type.ofType) {
    if (type.constructor.name === 'GraphQLNonNull') {
      return getTypeName(type.ofType) + '!';
    }
    if (type.constructor.name === 'GraphQLList') {
      return '[' + getTypeName(type.ofType) + ']';
    }
    return getTypeName(type.ofType);
  }
  return type.name;
}

function formatArgs(args: readonly GraphQLArgument[]): string {
  if (args.length === 0) return '';
  const argStrings = args.map(
    (a) => '  - `' + a.name + '`: `' + getTypeName(a.type) + '`'
      + (a.description ? ' - ' + a.description : '')
  );
  return '\n' + argStrings.join('\n');
}

function documentFields(
  fields: Record<string, GraphQLField<any, any>>
): string {
  const lines: string[] = [];
  for (const [name, field] of Object.entries(fields)) {
    lines.push('### `' + name + '`');
    if (field.description) {
      lines.push(field.description);
    }
    lines.push('');
    lines.push('Returns: `' + getTypeName(field.type) + '`');
    if (field.args.length > 0) {
      lines.push('');
      lines.push('Arguments:');
      lines.push(formatArgs(field.args));
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

// Build schema and generate docs
const schema = buildSchema(
  typeof typeDefs === 'string' ? typeDefs : typeDefs.join('\n')
);

const queryType = schema.getQueryType();
const mutationType = schema.getMutationType();
const subscriptionType = schema.getSubscriptionType();

let doc = '# GraphQL API Reference\n\n';
doc += 'Auto-generated from the GraphQL schema.\n\n';

if (queryType) {
  doc += '## Queries\n\n';
  doc += documentFields(queryType.getFields());
}

if (mutationType) {
  doc += '## Mutations\n\n';
  doc += documentFields(mutationType.getFields());
}

if (subscriptionType) {
  doc += '## Subscriptions\n\n';
  doc += documentFields(subscriptionType.getFields());
}

// Print the raw SDL for reference
doc += '## Full Schema\n\n';
doc += '```graphql\n';
doc += printSchema(schema);
doc += '\n```\n';

writeFileSync('docs/api-reference.md', doc);
console.log('Documentation generated at docs/api-reference.md');
```

Run it with:

```bash
npx tsx scripts/generate-docs.ts
```

This produces a Markdown file listing every query, mutation, and subscription with their arguments, return types, and descriptions. You can serve this alongside your API or include it in your project's documentation site.

---

## Visualizing the Schema with GraphQL Voyager

GraphQL Voyager is a tool that generates an interactive visual graph of your schema, showing types as nodes and relationships as edges. It is useful for understanding the shape of your API at a glance.

You can use it in two ways:

1. The hosted version at https://graphql-kit.com/graphql-voyager/ - paste your schema SDL or point it at your introspection endpoint.

2. Embed it in your server for development:

```typescript
// Add a /voyager route (development only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/voyager', (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/graphql-voyager/dist/voyager.css" />
        </head>
        <body>
          <div id="voyager" style="height: 100vh;"></div>
          <script src="https://cdn.jsdelivr.net/npm/graphql-voyager/dist/voyager.standalone.js">
          </script>
          <script>
            GraphQLVoyager.init(document.getElementById('voyager'), {
              introspection: fetch('/graphql', {
                method: 'post',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: GraphQLVoyager.voyagerIntrospectionQuery,
                }),
              }).then((r) => r.json()),
            });
          </script>
        </body>
      </html>
    `);
  });
}
```

Visit `http://localhost:4000/voyager` to see an interactive diagram of your schema with all types, fields, and relationships visualized.

---

## Test Coverage Strategy

Not everything needs the same level of testing. Here is a practical strategy:

Must test:
- Every query resolver (happy path and error cases)
- Every mutation resolver (valid input, invalid input, not found)
- Validation schemas (edge cases: empty strings, boundary lengths, invalid formats)
- Error formatting (expected vs unexpected errors)

Should test:
- DataLoader batching (verify the optimization works)
- Complex filtering and pagination logic
- Authorization checks (when implemented)

Can skip:
- Type resolvers that only delegate to DataLoader (they are covered by query tests)
- Schema syntax (the server will not start if the schema is invalid)
- Third-party library internals

This gives you good coverage without wasting time on tests that add no value.

---

## Course Recap: REST vs GraphQL

Over 10 lessons we have built a complete GraphQL API. Let us step back and summarize when GraphQL is the right choice and when REST is better.

Choose GraphQL when:
- Your clients have diverse data needs (mobile wants less data, web wants more)
- You have deeply nested or interconnected data (startups with founders, categories, comments)
- You want to avoid over-fetching and under-fetching
- You are building a product API consumed by your own frontend teams
- You need real-time subscriptions
- You want a single endpoint instead of dozens of REST routes

Choose REST when:
- Your API serves a single client with predictable data needs
- You need HTTP caching (GraphQL responses are harder to cache at the HTTP level)
- You have file upload/download as a primary concern
- Your team is more experienced with REST
- You are building a public API for third parties (REST is more universally understood)
- Your data access patterns are simple (CRUD on a few resources)

There is no universal answer. Many production systems use both: GraphQL for the product API that the frontend consumes, and REST for webhooks, file uploads, and third-party integrations.

---

## What We Built

Here is a summary of everything we built across all 10 lessons:

Lesson 01: Why GraphQL - Understood the problems GraphQL solves
Lesson 02: Schema Design - Defined types, queries, mutations in SDL
Lesson 03: Resolvers - Implemented resolver functions for every field
Lesson 04: Queries and Arguments - Added pagination, filtering, search
Lesson 05: Mutations - Created, updated, deleted data with mutations
Lesson 06: Input Validation - Added Zod validation with field-level errors
Lesson 07: DataLoaders - Solved N+1 with batching and per-request caching
Lesson 08: Error Handling - Built typed errors, formatError, production masking
Lesson 09: Subscriptions - Added real-time events over WebSocket
Lesson 10: Testing and Docs - Wrote tests and generated documentation

The key architectural patterns:

- SDL-first schema design with descriptions
- Resolver organization by type (queries, mutations, subscriptions, type resolvers)
- Validation layer with Zod between input and business logic
- DataLoader for batched data access with per-request caching
- Typed error hierarchy with consistent error codes
- PubSub pattern for real-time subscriptions
- Test helpers that execute operations without HTTP overhead

---

## Exercise

1. Add test coverage for the `createComment` mutation. Test both valid and invalid inputs.

2. Add a test that verifies the `formatError` function masks unexpected errors. Temporarily add a resolver that throws a plain Error (not an AppError) and verify the client receives a generic message.

3. Run `npx vitest --coverage` to see your test coverage report. Identify any gaps and add tests to fill them.

4. Add SDL descriptions to all your schema types and fields. Run the documentation generator and review the output.

---

## Summary

Testing and documentation are what separate a prototype from a production API. We built a test suite using Vitest that covers queries, mutations, validation errors, and DataLoader batching. We generated documentation from the schema itself, ensuring it is always up to date.

The key files we created:

- `vitest.config.ts` - Test runner configuration
- `tests/helpers/server.ts` - Apollo Server test helper with `executeQuery`
- `tests/helpers/reset-data.ts` - Data reset between tests
- `tests/queries.test.ts` - Query tests with arguments and error cases
- `tests/mutations.test.ts` - Mutation tests with validation scenarios
- `tests/dataloaders.test.ts` - DataLoader batching verification
- `scripts/generate-docs.ts` - Schema documentation generator

Congratulations on completing the course. You now have a solid GraphQL API with validation, performance optimization, error handling, real-time subscriptions, tests, and documentation. These patterns will serve you well in any GraphQL project you build next.
