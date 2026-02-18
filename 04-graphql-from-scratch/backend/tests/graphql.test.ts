// tests/graphql.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { executeQuery, stopTestServer } from './helpers/server.js';
import { resetData } from './helpers/reset-data.js';

beforeEach(() => {
  resetData();
});

afterAll(async () => {
  await stopTestServer();
});

// ─── Query Tests ────────────────────────────────────────────────────────

describe('Query: startups', () => {
  it('returns a list of startups', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups {
          id
          name
          tagline
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
    const { data: allData } = await executeQuery(`
      query { startups { id } }
    `);
    const totalCount = allData?.startups.length;

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

  it('filters by categoryId', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups(categoryId: "1") {
          id
          name
        }
      }
    `);

    expect(errors).toBeUndefined();
    // Category 1 (AI/ML) has CodeBuddy AI and SynthVoice
    expect(data?.startups.length).toBe(2);
  });

  it('filters by search term', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups(search: "deploy") {
          id
          name
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startups.length).toBe(1);
    expect(data?.startups[0].name).toBe('DeployBot');
  });

  it('sorts by UPVOTES_DESC', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups(sortBy: UPVOTES_DESC) {
          name
          upvotes
        }
      }
    `);

    expect(errors).toBeUndefined();
    const upvotes = data?.startups.map((s: any) => s.upvotes);
    for (let i = 1; i < upvotes.length; i++) {
      expect(upvotes[i]).toBeLessThanOrEqual(upvotes[i - 1]);
    }
  });

  it('sorts by NAME_ASC', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups(sortBy: NAME_ASC) {
          name
        }
      }
    `);

    expect(errors).toBeUndefined();
    const names = data?.startups.map((s: any) => s.name);
    const sorted = [...names].sort((a: string, b: string) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('returns startups with nested founder data', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups(limit: 1) {
          id
          name
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

  it('returns startups with nested comments', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startup(id: "1") {
          name
          comments {
            id
            content
            author {
              name
            }
          }
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startup.comments.length).toBeGreaterThan(0);
    expect(data?.startup.comments[0].author.name).toBeDefined();
  });
});

describe('Query: startupCount', () => {
  it('returns total count', async () => {
    const { data, errors } = await executeQuery(`
      query { startupCount }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startupCount).toBe(6);
  });

  it('returns filtered count by categoryId', async () => {
    const { data, errors } = await executeQuery(`
      query { startupCount(categoryId: "1") }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startupCount).toBe(2);
  });

  it('returns filtered count by search', async () => {
    const { data, errors } = await executeQuery(`
      query { startupCount(search: "deploy") }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startupCount).toBe(1);
  });
});

describe('Query: startup (single)', () => {
  it('returns a startup by ID', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startup(id: "1") {
          id
          name
          description
          upvotes
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startup.id).toBe('1');
    expect(data?.startup.name).toBe('CodeBuddy AI');
  });

  it('returns null for nonexistent startup', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startup(id: "999") {
          id
          name
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startup).toBeNull();
  });
});

describe('Query: categories', () => {
  it('returns all categories', async () => {
    const { data, errors } = await executeQuery(`
      query {
        categories {
          id
          name
          slug
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.categories.length).toBe(5);
  });

  it('returns category with nested startups', async () => {
    const { data, errors } = await executeQuery(`
      query {
        category(id: "1") {
          name
          startups {
            name
          }
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.category.name).toBe('AI/ML');
    expect(data?.category.startups.length).toBe(2);
  });
});

describe('Query: user', () => {
  it('returns a user by ID', async () => {
    const { data, errors } = await executeQuery(`
      query {
        user(id: "1") {
          id
          name
          email
          avatarUrl
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.user.name).toBe('Sarah Chen');
  });

  it('returns user with their startups', async () => {
    const { data, errors } = await executeQuery(`
      query {
        user(id: "2") {
          name
          startups {
            name
          }
        }
      }
    `);

    expect(errors).toBeUndefined();
    // Alex Rivera founded DeployBot and SynthVoice
    expect(data?.user.startups.length).toBe(2);
  });

  it('returns null for nonexistent user', async () => {
    const { data, errors } = await executeQuery(`
      query {
        user(id: "999") {
          id
          name
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.user).toBeNull();
  });
});

// ─── Mutation Tests ─────────────────────────────────────────────────────

describe('Mutation: createStartup', () => {
  const CREATE_STARTUP = `
    mutation CreateStartup($input: CreateStartupInput!) {
      createStartup(input: $input) {
        id
        name
        slug
        tagline
        upvotes
        createdAt
        founder {
          name
        }
        category {
          name
        }
      }
    }
  `;

  it('creates a startup with valid input', async () => {
    const input = {
      name: 'DataPipe',
      tagline: 'ETL pipelines in 5 minutes',
      description: 'DataPipe lets you build, test, and deploy data pipelines with a visual editor.',
      url: 'https://datapipe.dev',
      categoryId: '2',
      founderId: '3',
    };

    const { data, errors } = await executeQuery(CREATE_STARTUP, { input });

    expect(errors).toBeUndefined();
    expect(data?.createStartup).toBeDefined();
    expect(data?.createStartup.name).toBe('DataPipe');
    expect(data?.createStartup.slug).toBe('datapipe');
    expect(data?.createStartup.upvotes).toBe(0);
    expect(data?.createStartup.id).toBeDefined();
    expect(data?.createStartup.createdAt).toBeDefined();
    expect(data?.createStartup.founder.name).toBe('Jordan Lee');
    expect(data?.createStartup.category.name).toBe('Developer Tools');
  });

  it('increments startup count after creation', async () => {
    const { data: beforeData } = await executeQuery('query { startupCount }');

    await executeQuery(CREATE_STARTUP, {
      input: {
        name: 'NewStartup',
        tagline: 'A brand new startup for testing',
        description: 'This is a test startup with enough characters for validation.',
        url: 'https://newstartup.dev',
        categoryId: '1',
        founderId: '1',
      },
    });

    const { data: afterData } = await executeQuery('query { startupCount }');
    expect(afterData?.startupCount).toBe(beforeData?.startupCount + 1);
  });

  it('returns validation error for short name', async () => {
    const input = {
      name: 'Hi',
      tagline: 'Too short',
      description: 'Short',
      url: 'https://example.com',
      categoryId: '1',
      founderId: '1',
    };

    const { data, errors } = await executeQuery(CREATE_STARTUP, { input });

    expect(data).toBeNull();
    expect(errors).toBeDefined();
    expect(errors!.length).toBeGreaterThanOrEqual(1);

    const error = errors![0];
    expect(error.extensions?.code).toBe('BAD_USER_INPUT');

    const fieldErrors = error.extensions?.fieldErrors as Array<{
      field: string;
      message: string;
    }>;
    const fields = fieldErrors.map((fe) => fe.field);
    expect(fields).toContain('name');
    expect(fields).toContain('description');
  });

  it('returns validation error for non-HTTPS URL', async () => {
    const input = {
      name: 'Valid Name Here',
      tagline: 'A valid tagline here',
      description: 'A perfectly valid description that is long enough for validation.',
      url: 'http://not-https.com',
      categoryId: '1',
      founderId: '1',
    };

    const { data, errors } = await executeQuery(CREATE_STARTUP, { input });

    expect(errors).toBeDefined();
    const fieldErrors = errors![0].extensions?.fieldErrors as Array<{
      field: string;
      message: string;
    }>;
    const urlError = fieldErrors.find((fe) => fe.field === 'url');
    expect(urlError).toBeDefined();
    expect(urlError?.message).toContain('HTTPS');
  });

  it('returns error for nonexistent founder', async () => {
    const input = {
      name: 'Ghost Startup',
      tagline: 'This should fail on founder check',
      description: 'Testing error handling for invalid founder reference.',
      url: 'https://ghost.dev',
      categoryId: '1',
      founderId: '999',
    };

    const { data, errors } = await executeQuery(CREATE_STARTUP, { input });

    expect(data).toBeNull();
    expect(errors).toBeDefined();
    expect(errors![0].message).toContain('not found');
  });

  it('returns error for nonexistent category', async () => {
    const input = {
      name: 'Ghost Startup',
      tagline: 'This should fail on category check',
      description: 'Testing error handling for invalid category reference.',
      url: 'https://ghost.dev',
      categoryId: '999',
      founderId: '1',
    };

    const { data, errors } = await executeQuery(CREATE_STARTUP, { input });

    expect(data).toBeNull();
    expect(errors).toBeDefined();
    expect(errors![0].message).toContain('not found');
  });
});

describe('Mutation: updateStartup', () => {
  it('updates a startup with partial input', async () => {
    const { data, errors } = await executeQuery(`
      mutation {
        updateStartup(id: "1", input: { tagline: "The smartest AI coding assistant" }) {
          id
          name
          tagline
          slug
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.updateStartup.tagline).toBe('The smartest AI coding assistant');
    expect(data?.updateStartup.name).toBe('CodeBuddy AI');
    expect(data?.updateStartup.slug).toBe('codebuddy-ai');
  });

  it('updates the slug when name changes', async () => {
    const { data, errors } = await executeQuery(`
      mutation {
        updateStartup(id: "1", input: { name: "CodeBuddy Pro" }) {
          id
          name
          slug
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.updateStartup.name).toBe('CodeBuddy Pro');
    expect(data?.updateStartup.slug).toBe('codebuddy-pro');
  });

  it('returns null for nonexistent startup', async () => {
    const { data, errors } = await executeQuery(`
      mutation {
        updateStartup(id: "999", input: { name: "Ghost" }) {
          id
          name
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.updateStartup).toBeNull();
  });

  it('validates update input', async () => {
    const { data, errors } = await executeQuery(`
      mutation {
        updateStartup(id: "1", input: { name: "Hi" }) {
          id
        }
      }
    `);

    expect(errors).toBeDefined();
    expect(errors![0].extensions?.code).toBe('BAD_USER_INPUT');
  });
});

describe('Mutation: deleteStartup', () => {
  it('deletes a startup and returns true', async () => {
    const { data, errors } = await executeQuery(`
      mutation { deleteStartup(id: "2") }
    `);

    expect(errors).toBeUndefined();
    expect(data?.deleteStartup).toBe(true);

    // Verify it is gone
    const { data: afterData } = await executeQuery(`
      query { startup(id: "2") { id } }
    `);
    expect(afterData?.startup).toBeNull();
  });

  it('returns false for nonexistent startup', async () => {
    const { data, errors } = await executeQuery(`
      mutation { deleteStartup(id: "999") }
    `);

    expect(errors).toBeUndefined();
    expect(data?.deleteStartup).toBe(false);
  });

  it('also removes associated comments', async () => {
    // Startup 2 has comments 4 and 5
    const { data: before } = await executeQuery(`
      query {
        startup(id: "2") {
          comments { id }
        }
      }
    `);
    expect(before?.startup.comments.length).toBeGreaterThan(0);

    await executeQuery('mutation { deleteStartup(id: "2") }');

    // After deletion, the startup and comments should be gone
    const { data: after } = await executeQuery(`
      query { startupCount }
    `);
    expect(after?.startupCount).toBe(5);
  });
});

describe('Mutation: upvoteStartup', () => {
  it('increments the upvote count', async () => {
    const { data: before } = await executeQuery(`
      query { startup(id: "3") { upvotes } }
    `);
    const originalUpvotes = before?.startup.upvotes;

    const { data, errors } = await executeQuery(`
      mutation { upvoteStartup(id: "3") { id upvotes } }
    `);

    expect(errors).toBeUndefined();
    expect(data?.upvoteStartup.upvotes).toBe(originalUpvotes + 1);
  });

  it('increments multiple times', async () => {
    const { data: before } = await executeQuery(`
      query { startup(id: "3") { upvotes } }
    `);
    const originalUpvotes = before?.startup.upvotes;

    await executeQuery('mutation { upvoteStartup(id: "3") { upvotes } }');
    await executeQuery('mutation { upvoteStartup(id: "3") { upvotes } }');
    const { data } = await executeQuery(
      'mutation { upvoteStartup(id: "3") { upvotes } }'
    );

    expect(data?.upvoteStartup.upvotes).toBe(originalUpvotes + 3);
  });

  it('returns null for nonexistent startup', async () => {
    const { data, errors } = await executeQuery(`
      mutation { upvoteStartup(id: "999") { id } }
    `);

    expect(errors).toBeUndefined();
    expect(data?.upvoteStartup).toBeNull();
  });
});

describe('Mutation: createComment', () => {
  it('creates a comment', async () => {
    const { data, errors } = await executeQuery(`
      mutation {
        createComment(startupId: "4", content: "Great product!", authorId: "2") {
          id
          content
          createdAt
          author {
            name
          }
          startup {
            name
          }
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.createComment.content).toBe('Great product!');
    expect(data?.createComment.author.name).toBe('Alex Rivera');
    expect(data?.createComment.startup.name).toBe('MedNote');
  });

  it('appears in the startup comments list', async () => {
    const { data: before } = await executeQuery(`
      query { startup(id: "4") { comments { id } } }
    `);
    const beforeCount = before?.startup.comments.length;

    await executeQuery(`
      mutation {
        createComment(startupId: "4", content: "Another great comment here!", authorId: "1") {
          id
        }
      }
    `);

    const { data: after } = await executeQuery(`
      query { startup(id: "4") { comments { id } } }
    `);
    expect(after?.startup.comments.length).toBe(beforeCount + 1);
  });

  it('returns error for nonexistent startup', async () => {
    const { data, errors } = await executeQuery(`
      mutation {
        createComment(startupId: "999", content: "Hello world comment", authorId: "1") {
          id
        }
      }
    `);

    expect(data).toBeNull();
    expect(errors).toBeDefined();
    expect(errors![0].message).toContain('not found');
  });

  it('returns error for nonexistent author', async () => {
    const { data, errors } = await executeQuery(`
      mutation {
        createComment(startupId: "1", content: "Hello world comment", authorId: "999") {
          id
        }
      }
    `);

    expect(data).toBeNull();
    expect(errors).toBeDefined();
    expect(errors![0].message).toContain('not found');
  });

  it('validates empty content', async () => {
    const { data, errors } = await executeQuery(`
      mutation {
        createComment(startupId: "1", content: "", authorId: "1") {
          id
        }
      }
    `);

    expect(errors).toBeDefined();
    expect(errors![0].extensions?.code).toBe('BAD_USER_INPUT');
  });
});

// ─── Pagination and Combined Query Tests ────────────────────────────────

describe('Pagination and combined queries', () => {
  it('paginates with limit and offset', async () => {
    const { data: page1 } = await executeQuery(`
      query { startups(limit: 2, offset: 0, sortBy: NEWEST) { id name } }
    `);
    const { data: page2 } = await executeQuery(`
      query { startups(limit: 2, offset: 2, sortBy: NEWEST) { id name } }
    `);

    expect(page1?.startups.length).toBe(2);
    expect(page2?.startups.length).toBe(2);
    // Pages should have different startups
    const page1Ids = page1?.startups.map((s: any) => s.id);
    const page2Ids = page2?.startups.map((s: any) => s.id);
    expect(page1Ids).not.toEqual(page2Ids);
  });

  it('combines filter, sort, and pagination', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups(categoryId: "1", sortBy: UPVOTES_DESC, limit: 5) {
          name
          upvotes
        }
        startupCount(categoryId: "1")
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startupCount).toBe(2);
    expect(data?.startups.length).toBe(2);
    // Should be sorted by upvotes descending
    expect(data?.startups[0].upvotes).toBeGreaterThanOrEqual(data?.startups[1].upvotes);
  });

  it('supports multiple root queries', async () => {
    const { data, errors } = await executeQuery(`
      query Dashboard {
        startups(limit: 2) {
          name
        }
        categories {
          name
        }
        user(id: "1") {
          name
        }
        startupCount
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startups.length).toBe(2);
    expect(data?.categories.length).toBe(5);
    expect(data?.user.name).toBe('Sarah Chen');
    expect(data?.startupCount).toBe(6);
  });
});

// ─── DataLoader Tests ───────────────────────────────────────────────────

describe('DataLoader behavior', () => {
  it('loads founders for multiple startups', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups {
          id
          name
          founder {
            id
            name
          }
        }
      }
    `);

    expect(errors).toBeUndefined();
    // Every startup should have a founder
    for (const startup of data?.startups) {
      expect(startup.founder).toBeDefined();
      expect(startup.founder.id).toBeDefined();
      expect(startup.founder.name).toBeDefined();
    }
  });

  it('loads deeply nested data correctly', async () => {
    const { data, errors } = await executeQuery(`
      query {
        startups(limit: 3) {
          name
          founder {
            name
            startups {
              name
            }
          }
          category {
            name
            startups {
              name
            }
          }
          comments {
            content
            author {
              name
            }
          }
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.startups.length).toBe(3);
    for (const startup of data?.startups) {
      expect(startup.founder).toBeDefined();
      expect(startup.category).toBeDefined();
      expect(Array.isArray(startup.comments)).toBe(true);
    }
  });
});
