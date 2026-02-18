// src/index.ts
//
// NOTE: For full subscription support with WebSockets, you would need to install:
//   npm install graphql-ws ws express @graphql-tools/schema
//   npm install -D @types/ws @types/express
// and use the Express + WebSocket setup shown in Lesson 09.
//
// This entry point uses startStandaloneServer for HTTP queries and mutations.
// Subscriptions are defined in the schema and resolvers but require the
// WebSocket server setup to work at runtime.

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers/index.js';
import { createDataLoaders } from './dataloaders/index.js';
import { formatError } from './errors/format-error.js';
import type { GraphQLContext } from './context.js';

const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  formatError,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async () => ({
    loaders: createDataLoaders(),
  }),
});

console.log('Server ready at ' + url);
