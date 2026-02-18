// src/resolvers/types.ts
import { startups } from '../data/store.js';
import type { StartupRecord, UserRecord, CategoryRecord, CommentRecord } from '../data/store.js';
import type { GraphQLContext } from '../context.js';

export const typeResolvers = {
  Startup: {
    founder: (
      parent: StartupRecord,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return context.loaders.userLoader.load(parent.founderId);
    },

    category: (
      parent: StartupRecord,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return context.loaders.categoryLoader.load(parent.categoryId);
    },

    comments: (
      parent: StartupRecord,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return context.loaders.commentsByStartupLoader.load(parent.id);
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
    author: (
      parent: CommentRecord,
      _args: unknown,
      context: GraphQLContext
    ) => {
      return context.loaders.userLoader.load(parent.authorId);
    },

    startup: (parent: CommentRecord) => {
      return startups.find((s) => s.id === parent.startupId);
    },
  },
};
