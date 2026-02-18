// tests/helpers/server.ts
import { ApolloServer } from '@apollo/server';
import { typeDefs } from '../../src/schema.js';
import { resolvers } from '../../src/resolvers/index.js';
import { createDataLoaders } from '../../src/dataloaders/index.js';
import { formatError } from '../../src/errors/format-error.js';
import type { GraphQLContext } from '../../src/context.js';

let server: ApolloServer<GraphQLContext>;

export async function getTestServer(): Promise<ApolloServer<GraphQLContext>> {
  if (server) return server;

  server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    formatError,
  });

  await server.start();
  return server;
}

export function createTestContext(): GraphQLContext {
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
      data: response.body.singleResult.data as Record<string, any> | null | undefined,
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
