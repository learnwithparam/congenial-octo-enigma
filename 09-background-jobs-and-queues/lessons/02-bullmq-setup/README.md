# 02 — BullMQ Setup

Now that you understand why background processing matters, it is time to set up the infrastructure. BullMQ is a Node.js library that provides robust job queues backed by Redis. In this lesson, you will install BullMQ, connect to Redis, create your first queue, and configure docker-compose to run Redis alongside your application.

## What You'll Learn

- How to install BullMQ and its dependencies
- How to configure a shared Redis connection for queues and workers
- How to create a Queue instance with default job options
- How to run Redis using docker-compose
- The role of the Queue class in the BullMQ architecture

## Key Concepts

### BullMQ Architecture

BullMQ has three main classes:

- **Queue** -- used by producers to add jobs. Lives in your API server process.
- **Worker** -- used by consumers to process jobs. Lives in a separate worker process.
- **Job** -- the unit of work, containing a name and a data payload.

All three communicate through Redis. The Queue writes jobs to Redis. The Worker reads jobs from Redis. The Job object is what gets passed to your processing function.

### Redis as the Backbone

BullMQ uses Redis for everything: storing job data, managing queue state, scheduling delayed jobs, and coordinating between multiple workers. Without Redis, there is no queue.

Our project uses docker-compose to run Redis. Look at the `docker-compose.yml` at the project root:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    volumes:
      - ./backend/src:/app/src
    environment:
      - REDIS_URL=redis://redis:6379
      - PORT=3001
    depends_on:
      - redis

volumes:
  redisdata:
```

Key points:
- Redis 7 Alpine is a small, fast Redis image
- The `redisdata` volume persists queue data across container restarts
- The `depends_on` directive ensures Redis starts before the API
- The `REDIS_URL` environment variable tells the application where Redis is

### The Connection Module

Every queue and worker needs a Redis connection. Rather than duplicating connection config, we centralize it in `backend/src/queues/connection.ts`:

```typescript
import type { ConnectionOptions } from "bullmq";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
    maxRetriesPerRequest: null,
  };
}

// Shared connection config for queues and workers
export const connection: ConnectionOptions = parseRedisUrl(REDIS_URL);
```

There are a few important details here:

- **`maxRetriesPerRequest: null`** -- BullMQ requires this setting. Without it, the ioredis client will throw errors when a Redis command times out instead of retrying indefinitely, which breaks BullMQ's internal polling.
- **Environment variable** -- the `REDIS_URL` defaults to `localhost:6379` for local development but can be overridden for Docker or production environments.
- **Shared export** -- both queues and workers import this same `connection` object, ensuring they all point to the same Redis instance.

### Creating a Queue

With the connection ready, creating a queue is straightforward. Look at `backend/src/queues/email.ts`:

```typescript
import { Queue } from "bullmq";
import { connection } from "./connection.js";
import type { EmailJobData } from "../types.js";

export const emailQueue = new Queue<EmailJobData>("email", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 500,
    },
  },
});
```

Let's break down each option:

- **`"email"`** -- the queue name. Workers subscribe to queues by name. The name must match between the Queue and the Worker.
- **`connection`** -- the shared Redis connection config.
- **`defaultJobOptions`** -- applied to every job added to this queue unless overridden.
  - **`attempts: 3`** -- retry a failed job up to 3 times.
  - **`backoff`** -- wait between retries. Exponential backoff with a 1-second base means retries happen at 1s, 2s, 4s.
  - **`removeOnComplete: { count: 100 }`** -- keep the last 100 completed jobs in Redis for inspection, then clean up older ones.
  - **`removeOnFail: { count: 500 }`** -- keep the last 500 failed jobs for debugging.

### Type Safety with Generics

Notice the generic parameter `Queue<EmailJobData>`. This is defined in `backend/src/types.ts`:

```typescript
export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

export interface ReportJobData {
  reportType: "daily" | "weekly" | "monthly";
  userId?: string;
}
```

Using TypeScript generics means that when you call `emailQueue.add()`, the compiler enforces that the job data matches the `EmailJobData` interface. You get autocomplete and type checking at every step.

## Step by Step

### Step 1: Install Dependencies

The project uses these packages for the queue system:

```bash
npm install bullmq express resend dotenv
npm install -D typescript tsx @types/node @types/express
```

The full dependency list is in `backend/package.json`:

```json
{
  "dependencies": {
    "bullmq": "^5.0.0",
    "express": "^4.18.0",
    "resend": "^3.0.0",
    "dotenv": "^16.0.0",
    "@bull-board/api": "^6.0.0",
    "@bull-board/express": "^6.0.0"
  }
}
```

### Step 2: Start Redis

The easiest way to run Redis locally is through Docker:

```bash
make docker-up
```

This starts Redis on port 6379 with a persistent volume. You can verify Redis is running:

```bash
docker compose exec redis redis-cli ping
# PONG
```

If you prefer running without Docker, install Redis directly and start it with `redis-server`.

### Step 3: Configure Environment Variables

Copy the example environment file and set your values:

```bash
cp backend/.env.example backend/.env
```

The `.env.example` contains:

```
REDIS_URL=redis://localhost:6379
PORT=3002
RESEND_API_KEY=your-key-here
```

For local development, the defaults work fine. The `RESEND_API_KEY` is optional -- without it, the email worker runs in mock mode and logs to the console instead of sending real emails.

### Step 4: Create the Connection Module

The connection module in `backend/src/queues/connection.ts` parses the `REDIS_URL` environment variable into the format BullMQ expects. The `parseRedisUrl` function extracts the hostname and port from the URL string and returns a `ConnectionOptions` object.

This module is imported by every queue definition and every worker, ensuring a single source of truth for the Redis connection.

### Step 5: Create the Queue

Create the email queue in `backend/src/queues/email.ts`. The queue is exported as a singleton -- it is created once when the module loads and reused across the application. The API routes import this queue to add jobs, and the Bull Board dashboard imports it for monitoring.

### Step 6: Verify the Setup

Start the development server:

```bash
make dev
```

You should see output like:

```
[server] API running on http://localhost:3002
[server] Dashboard at http://localhost:3002/dashboard
[scheduler] Report jobs scheduled
```

If the server starts without Redis connection errors, your setup is working correctly.

## Exercise

Create a second queue for a hypothetical "category-sync" feature. The queue should be named `"category-sync"`, use the shared connection, and have these default options: 5 retry attempts, fixed backoff with a 2-second delay, keep the last 200 completed jobs, and keep the last 1000 failed jobs. Define a `CategorySyncJobData` interface with `categoryId: string` and `action: "create" | "update" | "delete"` fields.

## Summary

- BullMQ uses Redis as the communication layer between producers and consumers
- The `connection` module centralizes Redis configuration and is shared by all queues and workers
- A Queue instance is created with a name, a connection, and default job options
- TypeScript generics on the Queue class enforce type safety on job data
- docker-compose provides Redis with persistent storage for local development
- The `maxRetriesPerRequest: null` setting is required by BullMQ's ioredis dependency
