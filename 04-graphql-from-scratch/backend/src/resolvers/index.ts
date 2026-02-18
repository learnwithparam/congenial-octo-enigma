// src/resolvers/index.ts
import { queryResolvers } from './queries.js';
import { mutationResolvers } from './mutations.js';
import { subscriptionResolvers } from './subscriptions.js';
import { typeResolvers } from './types.js';

export const resolvers = {
  ...queryResolvers,
  ...mutationResolvers,
  ...subscriptionResolvers,
  ...typeResolvers,
};
