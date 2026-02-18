// src/resolvers/mutations.ts
import {
  startups,
  users,
  categories,
  comments,
  generateStartupId,
  generateCommentId,
  createSlug,
} from '../data/store.js';
import type { StartupRecord, CommentRecord } from '../data/store.js';
import type {
  CreateStartupArgs,
  UpdateStartupArgs,
  CreateCommentArgs,
} from '../types.js';
import { validate } from '../validation/validate.js';
import {
  CreateStartupInputSchema,
  UpdateStartupInputSchema,
  CreateCommentInputSchema,
} from '../validation/schemas.js';
import { NotFoundError } from '../errors/index.js';
import { pubsub, EVENTS } from '../pubsub.js';

export const mutationResolvers = {
  Mutation: {
    createStartup: (_parent: unknown, args: CreateStartupArgs) => {
      // Validate input
      const input = validate(CreateStartupInputSchema, args.input);

      // Verify the founder exists
      const founder = users.find((u) => u.id === input.founderId);
      if (!founder) {
        throw new NotFoundError('User', input.founderId);
      }

      // Verify the category exists
      const category = categories.find((c) => c.id === input.categoryId);
      if (!category) {
        throw new NotFoundError('Category', input.categoryId);
      }

      // Create the new startup record
      const newStartup: StartupRecord = {
        id: generateStartupId(),
        name: input.name,
        slug: createSlug(input.name),
        tagline: input.tagline,
        description: input.description,
        url: input.url,
        upvotes: 0,
        categoryId: input.categoryId,
        founderId: input.founderId,
        createdAt: new Date().toISOString(),
      };

      // Add to the data store
      startups.push(newStartup);

      return newStartup;
    },

    updateStartup: (_parent: unknown, args: UpdateStartupArgs) => {
      // Validate input
      const input = validate(UpdateStartupInputSchema, args.input);

      const index = startups.findIndex((s) => s.id === args.id);
      if (index === -1) {
        return null;
      }

      const existing = startups[index];

      // Apply partial updates -- only update fields that were provided
      const updated: StartupRecord = {
        ...existing,
        name: input.name ?? existing.name,
        tagline: input.tagline ?? existing.tagline,
        description: input.description ?? existing.description,
        url: input.url ?? existing.url,
        categoryId: input.categoryId ?? existing.categoryId,
      };

      // Update the slug if the name changed
      if (input.name && input.name !== existing.name) {
        updated.slug = createSlug(input.name);
      }

      // Verify the new category exists if it was changed
      if (input.categoryId) {
        const category = categories.find((c) => c.id === input.categoryId);
        if (!category) {
          throw new NotFoundError('Category', input.categoryId);
        }
      }

      // Replace the record in the data store
      startups[index] = updated;

      return updated;
    },

    deleteStartup: (_parent: unknown, args: { id: string }) => {
      const index = startups.findIndex((s) => s.id === args.id);
      if (index === -1) {
        return false;
      }

      // Remove the startup
      startups.splice(index, 1);

      // Also remove associated comments
      for (let i = comments.length - 1; i >= 0; i--) {
        if (comments[i].startupId === args.id) {
          comments.splice(i, 1);
        }
      }

      return true;
    },

    upvoteStartup: (_parent: unknown, args: { id: string }) => {
      const startup = startups.find((s) => s.id === args.id);
      if (!startup) {
        return null;
      }

      startup.upvotes += 1;

      const payload = { startupUpvoted: { ...startup } };

      // Publish to the global channel (all upvote subscribers)
      pubsub.publish(EVENTS.STARTUP_UPVOTED, payload);

      // Publish to the startup-specific channel (filtered subscribers)
      pubsub.publish(
        EVENTS.STARTUP_UPVOTED + ':' + startup.id,
        payload
      );

      return startup;
    },

    createComment: (_parent: unknown, args: CreateCommentArgs) => {
      // Validate input
      const input = validate(CreateCommentInputSchema, {
        startupId: args.startupId,
        authorId: args.authorId,
        content: args.content,
      });

      // Verify the startup exists
      const startup = startups.find((s) => s.id === input.startupId);
      if (!startup) {
        throw new NotFoundError('Startup', input.startupId);
      }

      // Verify the author exists
      const author = users.find((u) => u.id === input.authorId);
      if (!author) {
        throw new NotFoundError('User', input.authorId);
      }

      const newComment: CommentRecord = {
        id: generateCommentId(),
        content: input.content,
        startupId: input.startupId,
        authorId: input.authorId,
        createdAt: new Date().toISOString(),
      };

      comments.push(newComment);

      // Publish to the startup-specific channel
      pubsub.publish(
        EVENTS.COMMENT_ADDED + ':' + input.startupId,
        { commentAdded: newComment }
      );

      return newComment;
    },
  },
};
