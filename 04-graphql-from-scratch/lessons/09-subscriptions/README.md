# Lesson 09: Real-Time Subscriptions

So far our API follows a request-response pattern. The client asks a question and the server answers. But some features need the server to push data to the client: live notifications when someone upvotes your startup, new comments appearing without refreshing the page, real-time activity feeds. GraphQL subscriptions enable this with a third operation type alongside queries and mutations.

By the end of this lesson you will:

- Understand the pub/sub pattern and how it maps to GraphQL subscriptions
- Add subscription types to your schema
- Set up WebSocket transport with graphql-ws
- Create a PubSub instance and publish events from mutations
- Implement subscription resolvers with filtering
- Test subscriptions in Apollo Sandbox
- Understand scaling considerations for production

---

## When to Use Subscriptions

Subscriptions are the right choice when:

- Users need to see changes within seconds (chat messages, live notifications)
- Multiple users are looking at the same data (collaborative editing, shared dashboards)
- Events are frequent and unpredictable (stock prices, real-time analytics)

Subscriptions are not the right choice when:

- Data changes rarely (user profile, settings). Use polling every 30 seconds instead.
- You need guaranteed delivery. Subscriptions are fire-and-forget over WebSockets. If the connection drops, you miss events.
- The client does not need real-time data. A simple refetch on user action is simpler and cheaper.

For our startup platform, subscriptions make sense for upvote notifications (so you see your startup getting traction in real time) and new comments (so discussions feel live).

---

## The Pub/Sub Pattern

Subscriptions use the publish/subscribe pattern:

1. A client subscribes to an event channel (e.g., "comments on startup-5").
2. When a mutation creates a new comment on startup-5, the server publishes an event to that channel.
3. The subscription system delivers the event to all subscribed clients.

The key abstraction is a PubSub system that decouples publishers (mutations) from subscribers (clients). The mutation does not need to know which clients are listening. It just publishes an event. The PubSub system handles routing.

```
Client A subscribes to "commentAdded" for startup-5
Client B subscribes to "commentAdded" for startup-5
Client C subscribes to "startupUpvoted" for startup-5

Someone creates a comment on startup-5:
  Mutation -> PubSub.publish("COMMENT_ADDED", comment)
    -> Client A receives the comment
    -> Client B receives the comment
    (Client C does not receive it - different event type)

Someone upvotes startup-5:
  Mutation -> PubSub.publish("STARTUP_UPVOTED", startup)
    -> Client C receives the startup
    (Client A and B do not receive it - different event type)
```

---

## Installing Dependencies

We need two additional packages for WebSocket-based subscriptions:

```bash
npm install graphql-ws ws express @graphql-tools/schema
npm install -D @types/ws @types/express
```

- `graphql-ws` implements the GraphQL over WebSocket protocol. It handles connection setup, keep-alive pings, and message framing.
- `ws` is a WebSocket server for Node.js. Apollo Server does not include one, so we provide our own.
- `express` is needed because we switch from `startStandaloneServer` to a custom HTTP + WebSocket setup.
- `@graphql-tools/schema` provides `makeExecutableSchema`, which both Apollo Server and graphql-ws need.

---

## Adding Subscription Types to the Schema

Update your schema to include subscription types. Open `src/schema/typeDefs.ts` and add:

```typescript
// Add to your existing type definitions
const subscriptionTypeDefs = `
  type Subscription {
    """
    Fires when any startup receives an upvote.
    Pass startupId to filter for a specific startup.
    """
    startupUpvoted(startupId: ID): Startup!

    """
    Fires when a new comment is added to the specified startup.
    """
    commentAdded(startupId: ID!): Comment!
  }
`;
```

The `startupUpvoted` subscription accepts an optional `startupId` argument. If provided, the client only receives events for that specific startup. If omitted, the client receives all upvote events. This is useful for a global activity feed.

The `commentAdded` subscription requires a `startupId`. There is no use case for receiving every comment on every startup, so we make it required.

Make sure to include `subscriptionTypeDefs` in your type definitions array or template literal, wherever you assemble them:

```typescript
export const typeDefs = `
  ${queryTypeDefs}
  ${mutationTypeDefs}
  ${subscriptionTypeDefs}
  ${typeTypeDefs}
  ${inputTypeDefs}
`;
```

---

## Creating the PubSub System

For development and single-server deployments, we will use an in-memory PubSub based on Node.js EventEmitter. Create `src/pubsub.ts`:

```typescript
// src/pubsub.ts
import { EventEmitter } from 'events';

// Event names as constants to prevent typos
export const EVENTS = {
  STARTUP_UPVOTED: 'STARTUP_UPVOTED',
  COMMENT_ADDED: 'COMMENT_ADDED',
} as const;

// Payload types for type safety
export interface StartupUpvotedPayload {
  startupUpvoted: {
    id: string;
    title: string;
    description: string;
    category: string;
    founderId: string;
    upvotes: number;
    websiteUrl: string | null;
    createdAt: string;
  };
}

export interface CommentAddedPayload {
  commentAdded: {
    id: string;
    startupId: string;
    authorId: string;
    text: string;
    createdAt: string;
  };
}

// Simple in-memory PubSub using EventEmitter
class PubSub {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Allow many subscribers (default is 10)
    this.emitter.setMaxListeners(100);
  }

  publish(event: string, payload: unknown): void {
    this.emitter.emit(event, payload);
  }

  asyncIterator<T = unknown>(event: string): AsyncIterableIterator<T> {
    const emitter = this.emitter;
    const pullQueue: Array<(value: IteratorResult<T>) => void> = [];
    const pushQueue: T[] = [];
    let done = false;

    function pushValue(value: T) {
      if (pullQueue.length > 0) {
        // A consumer is waiting, resolve immediately
        const resolve = pullQueue.shift()!;
        resolve({ value, done: false });
      } else {
        // No consumer waiting, buffer the value
        pushQueue.push(value);
      }
    }

    // Listen for events
    const listener = (data: T) => {
      pushValue(data);
    };
    emitter.on(event, listener);

    return {
      [Symbol.asyncIterator]() {
        return this;
      },

      next(): Promise<IteratorResult<T>> {
        if (done) {
          return Promise.resolve({ value: undefined as any, done: true });
        }

        if (pushQueue.length > 0) {
          // There is a buffered value, return it immediately
          return Promise.resolve({
            value: pushQueue.shift()!,
            done: false,
          });
        }

        // Wait for the next event
        return new Promise((resolve) => {
          pullQueue.push(resolve);
        });
      },

      return(): Promise<IteratorResult<T>> {
        done = true;
        emitter.removeListener(event, listener);
        // Resolve any waiting consumers
        for (const resolve of pullQueue) {
          resolve({ value: undefined as any, done: true });
        }
        pullQueue.length = 0;
        pushQueue.length = 0;
        return Promise.resolve({ value: undefined as any, done: true });
      },

      throw(error: unknown): Promise<IteratorResult<T>> {
        done = true;
        emitter.removeListener(event, listener);
        return Promise.reject(error);
      },
    };
  }
}

// Single instance shared across the application
export const pubsub = new PubSub();
```

Let us walk through the key parts of this implementation.

The `publish` method simply emits an event on the EventEmitter. Any listeners registered for that event will receive the payload.

The `asyncIterator` method is more complex. It creates an async iterator that bridges the EventEmitter world (push-based) with the async iteration world (pull-based). It uses two queues:

- `pullQueue`: consumers waiting for data (when `next()` is called but no event has arrived yet)
- `pushQueue`: events that arrived but no consumer is waiting for them yet

When an event arrives and a consumer is waiting, the event goes directly to the consumer. When an event arrives and no consumer is waiting, it gets buffered. When a consumer calls `next()` and there is a buffered event, it gets that event immediately. When a consumer calls `next()` and there is no buffered event, it waits.

The `return()` method is called when the client disconnects. It removes the event listener and resolves any waiting consumers with `done: true`.

---

## Implementing Subscription Resolvers

Create `src/resolvers/subscriptions.ts`:

```typescript
// src/resolvers/subscriptions.ts
import {
  pubsub,
  EVENTS,
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
```

Subscription resolvers have a different structure than query and mutation resolvers. They have two functions:

`subscribe`: Returns an async iterator. This determines which events the client receives. It runs once when the client first subscribes.

`resolve`: Transforms the published payload into the shape the client expects. It runs for each event. This is where you extract data from the raw payload or do additional processing.

For `commentAdded`, we use a dynamic channel name that includes the startup ID. When a client subscribes to comments on startup-5, they listen on channel `COMMENT_ADDED:startup-5`. When a comment is created on startup-5, the mutation publishes to that same channel. Comments on other startups go to different channels and do not reach this client.

For `startupUpvoted`, we support both filtered and unfiltered subscriptions. If the client passes a `startupId`, they get a specific channel. If they omit it, they get the global channel.

---

## Publishing Events from Mutations

Update your mutation resolvers to publish events when relevant data changes:

```typescript
// src/resolvers/mutations.ts (add these imports and update the mutations)
import { pubsub, EVENTS } from '../pubsub.js';
import { startups, comments } from '../data/store.js';
import { NotFoundError } from '../errors/index.js';
import { validate } from '../validation/validate.js';
import { CreateCommentInputSchema } from '../validation/schemas.js';

// Inside your mutationResolvers.Mutation object:

    upvoteStartup: (_parent: unknown, args: { id: string }) => {
      const startup = startups.find((s) => s.id === args.id);
      if (!startup) {
        throw new NotFoundError('Startup', args.id);
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

    createComment: (_parent: unknown, args: { input: unknown }) => {
      const input = validate(CreateCommentInputSchema, args.input);

      // Verify the startup exists
      const startup = startups.find((s) => s.id === input.startupId);
      if (!startup) {
        throw new NotFoundError('Startup', input.startupId);
      }

      const comment = {
        id: 'comment-' + Date.now(),
        startupId: input.startupId,
        authorId: input.authorId,
        text: input.text,
        createdAt: new Date().toISOString(),
      };

      comments.push(comment);

      // Publish to the startup-specific channel
      pubsub.publish(
        EVENTS.COMMENT_ADDED + ':' + input.startupId,
        { commentAdded: comment }
      );

      return comment;
    },
```

The pattern is straightforward: after the mutation succeeds, publish an event. The payload structure must match what the `resolve` function in the subscription resolver expects. We wrap the data in an object with a key matching the subscription field name (`startupUpvoted`, `commentAdded`).

For `upvoteStartup`, we publish to both the global channel and the startup-specific channel. This way, clients subscribed to all upvotes and clients subscribed to a specific startup both receive the event.

For `createComment`, we only publish to the startup-specific channel since our schema requires a `startupId` argument.

---

## Setting Up the WebSocket Server

Apollo Server 4 does not include built-in subscription support. We need to set up a separate WebSocket server using `graphql-ws` and run it alongside the HTTP server. Replace the contents of `src/index.ts`:

```typescript
// src/index.ts
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import {
  ApolloServerPluginDrainHttpServer,
} from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './resolvers/index.js';
import { createDataLoaders, DataLoaders } from './dataloaders/index.js';
import { formatError } from './errors/format-error.js';

export interface GraphQLContext {
  loaders: DataLoaders;
}

// Build executable schema (needed by both Apollo Server and graphql-ws)
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Create Express app and HTTP server
const app = express();
const httpServer = createServer(app);

// Create WebSocket server for subscriptions
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

// Set up graphql-ws on the WebSocket server
const serverCleanup = useServer(
  {
    schema,
    context: async () => ({
      loaders: createDataLoaders(),
    }),
    onConnect: async (ctx) => {
      console.log('WebSocket client connected');
      // You can authenticate here using ctx.connectionParams
      // const token = ctx.connectionParams?.authToken;
      // if (!token) return false; // reject the connection
    },
    onDisconnect: async () => {
      console.log('WebSocket client disconnected');
    },
  },
  wsServer
);

// Create Apollo Server with drain plugins for graceful shutdown
const server = new ApolloServer<GraphQLContext>({
  schema,
  formatError,
  plugins: [
    // Drain the HTTP server on shutdown
    ApolloServerPluginDrainHttpServer({ httpServer }),
    // Drain the WebSocket server on shutdown
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

await server.start();

// Mount Apollo middleware on Express
app.use(
  '/graphql',
  express.json(),
  expressMiddleware(server, {
    context: async () => ({
      loaders: createDataLoaders(),
    }),
  })
);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(
    'HTTP server ready at http://localhost:' + PORT + '/graphql'
  );
  console.log(
    'WebSocket server ready at ws://localhost:' + PORT + '/graphql'
  );
});
```

This is more setup than our previous `startStandaloneServer` approach, but it is necessary because subscriptions require WebSocket support. Let us walk through the key parts.

`makeExecutableSchema`: We build the schema object manually because both Apollo Server and graphql-ws need access to it. Previously Apollo Server built it internally from `typeDefs` and `resolvers`, but now we need the schema object directly.

`WebSocketServer`: A raw WebSocket server from the `ws` package, attached to the same HTTP server and listening on the same `/graphql` path. HTTP requests go through Express; WebSocket upgrade requests go through the WebSocket server. The upgrade handshake is automatic.

`useServer`: From `graphql-ws`, this connects the GraphQL subscription engine to the WebSocket server. It handles the subscription protocol, including connection init, subscribe, next, complete, and error messages.

Drain plugins: These ensure that when the server shuts down, it waits for in-flight HTTP requests and active WebSocket connections to complete before closing. Without these, shutting down the server would abruptly disconnect all subscribed clients.

`onConnect`: This callback runs when a WebSocket client connects. It receives `connectionParams` that the client sends during the handshake. This is where you would validate an auth token. Return `false` to reject the connection.

---

## Merging All Resolvers

Make sure your resolver index file exports all resolver types:

```typescript
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
```

---

## Testing Subscriptions in Apollo Sandbox

Start your server with `npm run dev`. Open Apollo Sandbox at `http://localhost:4000/graphql`.

First, set up a subscription in one tab. Click the "+" button to open a new operation tab, then enter:

```graphql
subscription {
  commentAdded(startupId: "startup-1") {
    id
    text
    authorId
    createdAt
  }
}
```

Click the play button. The subscription will start and show a "Listening..." status. The tab stays open, waiting for events.

Now, open a second operation tab and run a mutation:

```graphql
mutation {
  createComment(input: {
    startupId: "startup-1"
    authorId: "user-2"
    text: "This startup looks amazing!"
  }) {
    id
    text
  }
}
```

Switch back to the subscription tab. You should see the new comment appear in real time:

```json
{
  "data": {
    "commentAdded": {
      "id": "comment-1708100000000",
      "text": "This startup looks amazing!",
      "authorId": "user-2",
      "createdAt": "2026-02-17T10:30:00.000Z"
    }
  }
}
```

Now test filtering. Run the same mutation but with `startupId: "startup-2"`. The subscription tab should not receive anything because it is only listening for startup-1 comments.

Test the upvote subscription too:

```graphql
subscription {
  startupUpvoted(startupId: "startup-1") {
    id
    title
    upvotes
  }
}
```

Then in the second tab:

```graphql
mutation {
  upvoteStartup(id: "startup-1") {
    upvotes
  }
}
```

The subscription tab should show the updated startup with the new upvote count. Run the mutation multiple times and watch the upvote count increase with each event.

---

## Connection Lifecycle and Authentication

WebSocket subscriptions have a lifecycle that differs from HTTP requests.

1. Connection init: The client opens a WebSocket and sends a `connection_init` message. This happens once per connection, not once per subscription. A single WebSocket connection can support multiple simultaneous subscriptions.

2. Subscribe: For each subscription the client wants, it sends a subscribe message with the GraphQL query and variables. The server starts the async iterator.

3. Next: When an event is published, the server sends a `next` message with the subscription data.

4. Complete: When the client unsubscribes or the server ends the subscription, a `complete` message is sent.

5. Connection close: When the WebSocket connection closes, all subscriptions on that connection are terminated.

Authentication for subscriptions is different from HTTP requests. With HTTP, you send an auth header with every request. With WebSockets, you authenticate once during the connection handshake using `connectionParams`:

```typescript
// Client-side (for reference)
import { createClient } from 'graphql-ws';

const client = createClient({
  url: 'ws://localhost:4000/graphql',
  connectionParams: {
    authToken: 'your-jwt-token-here',
  },
});
```

```typescript
// Server-side (in useServer config)
onConnect: async (ctx) => {
  const token = ctx.connectionParams?.authToken as string;
  if (!token) {
    // Reject the connection
    return false;
  }
  // Validate the token
  // const user = await verifyToken(token);
  // if (!user) return false;
  console.log('Authenticated WebSocket connection');
},
```

---

## Scaling Subscriptions in Production

Our in-memory PubSub has a limitation: it only works on a single server. If you run multiple server instances behind a load balancer, a publish on server A does not reach subscribers on server B.

The standard solution is Redis PubSub:

```
Server A (has Client 1 subscribed)
  \
   Redis PubSub  <-- mutation on Server B publishes here
  /
Server B (has Client 2 subscribed)

Both Client 1 and Client 2 receive the event
```

Popular libraries for this include `graphql-redis-subscriptions` and `ioredis`. The application code barely changes: you swap the PubSub implementation, and mutations on any server instance reach subscribers on any other server instance.

Other scaling considerations:

Connection limits: Each WebSocket connection holds server memory. A server with 10,000 active subscriptions uses significantly more memory than one serving only HTTP requests. Monitor connection counts and set limits.

Heartbeats: The graphql-ws library sends periodic ping/pong messages to detect dead connections. This prevents "ghost" connections from consuming resources.

Load balancing: WebSocket connections are long-lived and stateful. Your load balancer must support WebSocket upgrade (most modern ones do: nginx, ALB, CloudFlare). Once connected, the client stays on the same server for the life of that connection.

---

## Subscriptions vs Polling vs Server-Sent Events

Three approaches to getting updates from the server:

Subscriptions (WebSocket):
- Bidirectional communication
- Lowest latency (events arrive immediately)
- Most complex to set up and scale
- Best for: chat, live collaboration, gaming

Polling (periodic refetch):
- Uses standard HTTP queries on an interval
- Simplest to implement (just `setInterval` with a query)
- Higher latency (depends on poll interval)
- Wastes bandwidth when data has not changed
- Best for: dashboards that update every 30-60 seconds

Server-Sent Events (SSE):
- Unidirectional (server to client only)
- Simpler than WebSockets (works over HTTP)
- Good browser support, automatic reconnection
- Best for: notification feeds, live logs

For most applications, start with polling. Switch to subscriptions only when the latency or bandwidth cost of polling becomes unacceptable. Premature optimization toward WebSockets adds complexity that is often unnecessary.

---

## Exercise

1. Add a `startupCreated` subscription that fires whenever a new startup is created via the `createStartup` mutation. It should not require any arguments.

2. Add authentication to the WebSocket connection. Check for `connectionParams.authToken` in the `onConnect` callback. If missing, reject the connection by returning `false`.

3. Modify the `commentAdded` subscription to include the comment author's information. Hint: in the `resolve` function, use the DataLoader from the context to load the author.

4. Open two subscription tabs in Apollo Sandbox with different `startupId` values. Verify that each tab only receives events for its own startup.

---

## Summary

Subscriptions add real-time capabilities to your GraphQL API using the publish/subscribe pattern over WebSockets. We built a complete subscription system with:

- Schema types for `startupUpvoted` and `commentAdded`
- An in-memory PubSub system for event routing
- Subscription resolvers that return async iterators
- Mutations that publish events after successful operations
- WebSocket transport via graphql-ws alongside the HTTP server
- Channel-based filtering for startup-specific subscriptions

The key files we created or updated:

- `src/pubsub.ts` - PubSub event system with async iterators
- `src/resolvers/subscriptions.ts` - Subscription resolvers
- `src/index.ts` - HTTP + WebSocket server setup
- Updated mutation resolvers with publish calls
- `src/resolvers/index.ts` - Merged all resolver types

In the next and final lesson we will write tests for our entire API and generate documentation, bringing everything together.
