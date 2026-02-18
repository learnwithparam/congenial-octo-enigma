// src/resolvers/subscriptions.ts
import {
  pubsub,
  EVENTS,
} from '../pubsub.js';
import type {
  StartupUpvotedPayload,
  CommentAddedPayload,
} from '../pubsub.js';

export const subscriptionResolvers = {
  Subscription: {
    startupUpvoted: {
      subscribe: (
        _parent: unknown,
        args: { startupId?: string }
      ) => {
        if (args.startupId) {
          // Subscribe to a specific startup's upvote events
          const channel =
            EVENTS.STARTUP_UPVOTED + ':' + args.startupId;
          return pubsub.asyncIterator<StartupUpvotedPayload>(channel);
        }
        // Subscribe to all upvote events
        return pubsub.asyncIterator<StartupUpvotedPayload>(
          EVENTS.STARTUP_UPVOTED
        );
      },
      resolve: (payload: StartupUpvotedPayload) => {
        return payload.startupUpvoted;
      },
    },

    commentAdded: {
      subscribe: (
        _parent: unknown,
        args: { startupId: string }
      ) => {
        // Subscribe to a startup-specific channel
        const channel =
          EVENTS.COMMENT_ADDED + ':' + args.startupId;
        return pubsub.asyncIterator<CommentAddedPayload>(channel);
      },
      resolve: (payload: CommentAddedPayload) => {
        return payload.commentAdded;
      },
    },
  },
};
