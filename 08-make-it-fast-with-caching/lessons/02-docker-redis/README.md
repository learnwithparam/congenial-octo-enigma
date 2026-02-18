# 02 — Docker Redis

Redis is the backbone of everything we build in this course: application caching, rate limiting, and session storage all run through it. In this lesson you will spin up Redis using Docker Compose, learn the essential redis-cli commands for inspecting and manipulating data, and connect to Redis from TypeScript using the ioredis library. By the end, you will have a running Redis instance and a working client ready for the caching patterns in the next lesson.

## What You'll Learn

- How to run Redis in Docker using docker-compose
- Essential redis-cli commands: SET, GET, DEL, TTL, KEYS, EXPIRE, SCAN
- How to create an ioredis client in TypeScript with connection handling
- Redis data types and when to use each one
- Graceful connection management and error handling

## Key Concepts

### What Redis Is and Why It Matters

Redis is an in-memory data store. Unlike PostgreSQL or MySQL, which persist data to disk and optimize for durability, Redis keeps everything in RAM. This gives it sub-millisecond read and write latency for most operations. A typical Redis GET takes less than 1 millisecond. Compare that to the 200ms simulated database latency in our project, and you understand why Redis is the go-to caching layer.

Redis is not just a key-value store, though. It supports strings, hashes, lists, sets, sorted sets, and streams. For caching purposes, you will primarily use strings (which can hold serialized JSON). For rate limiting, you will use sorted sets. The data structure you choose affects both performance and the operations available to you.

### Docker Compose for Redis

Our project includes a `docker-compose.yml` at the root of the course directory:

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

The key details:

The `redis:7-alpine` image is a minimal Redis 7 build based on Alpine Linux. It is about 30MB, starts in under a second, and includes all the features you need for development.

Port 6379 is the default Redis port. The mapping `"6379:6379"` means your host machine can connect to Redis at `localhost:6379`, which is exactly what the `REDIS_URL` environment variable in `.env.example` specifies.

The `redisdata` volume persists Redis data across container restarts. Without it, stopping the container would erase everything. For development this is convenient but not critical. In production, you would configure Redis persistence policies (RDB snapshots or AOF logging) depending on your durability requirements.

The `depends_on: redis` on the api service ensures Redis starts before the API server. Note that `depends_on` only waits for the container to start, not for Redis to be ready to accept connections. The ioredis client handles this by automatically retrying connections.

### Redis CLI Essentials

Once Redis is running, you can interact with it directly using redis-cli. This is invaluable for debugging cache issues, inspecting stored data, and testing patterns before writing code.

To connect to Redis running in Docker:

```bash
docker compose exec redis redis-cli
```

Or if Redis is running locally:

```bash
redis-cli
```

Here are the commands you will use most often:

SET and GET are the foundation. SET writes a value, GET reads it:

```
SET greeting "hello world"
OK

GET greeting
"hello world"
```

SET with EX sets a TTL (time to live) in seconds. After the TTL expires, the key is automatically deleted:

```
SET session:abc "user data" EX 3600
OK

TTL session:abc
(integer) 3599

GET session:abc
"user data"
```

TTL returns the remaining lifetime in seconds. It returns -1 if the key exists but has no expiry, and -2 if the key does not exist.

DEL removes a key immediately:

```
DEL greeting
(integer) 1

GET greeting
(nil)
```

KEYS lists all keys matching a pattern. Useful for development, but never use it in production code because it blocks Redis while scanning all keys:

```
KEYS *
1) "session:abc"

KEYS products:*
1) "products:all"
2) "products:1"
3) "products:category:electronics"
```

SCAN is the production-safe alternative to KEYS. It iterates through keys without blocking:

```
SCAN 0 MATCH products:* COUNT 10
1) "0"
2) 1) "products:all"
   2) "products:1"
```

The first element of the result is the cursor for the next iteration. When it returns "0", the scan is complete. Our `invalidatePattern` function in `backend/src/cache.ts` uses exactly this approach:

```typescript
export async function invalidatePattern(pattern: string): Promise<number> {
  let cursor = "0";
  let deleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== "0");

  return deleted;
}
```

EXPIRE sets a TTL on an existing key:

```
SET mykey "data"
EXPIRE mykey 120
TTL mykey
(integer) 119
```

TYPE tells you what data structure a key holds:

```
TYPE products:all
string

TYPE rl:global:127.0.0.1
zset
```

INFO provides server statistics. For caching, the memory section is most relevant:

```
INFO memory
# Memory
used_memory:1234567
used_memory_human:1.18M
```

FLUSHDB clears all keys in the current database. Useful during development to reset state:

```
FLUSHDB
OK
```

### The ioredis Client

Our project uses ioredis, the most popular Redis client for Node.js. It supports all Redis commands, automatic reconnection, pipelining, and Lua scripting.

The client setup lives in `backend/src/redis.ts`:

```typescript
import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL);

redis.on("connect", () => {
  console.log("Connected to Redis");
});

redis.on("error", (err: Error) => {
  console.error("Redis connection error:", err.message);
});

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
```

Several design decisions here are worth understanding:

The connection URL comes from an environment variable with a localhost fallback. In Docker Compose, the API service gets `REDIS_URL=redis://redis:6379` where `redis` is the service name that Docker's internal DNS resolves. When running outside Docker, it falls back to `localhost:6379`.

The `connect` and `error` event listeners provide visibility into connection state. ioredis automatically reconnects when the connection drops, using exponential backoff. The error handler prevents unhandled errors from crashing the process.

The `disconnectRedis` function calls `redis.quit()`, which sends a QUIT command to Redis and waits for pending operations to complete. This is used in our graceful shutdown handler in `backend/src/index.ts`:

```typescript
const shutdown = async () => {
  console.log("\nShutting down...");
  server.close();
  await disconnectRedis();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

Without this, stopping the server could leave connections open or interrupt in-flight cache writes.

### Connection Options

When creating the ioredis client, you can pass options beyond just the URL:

```typescript
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: false,
  enableReadyCheck: true,
});
```

`maxRetriesPerRequest` limits how many times a single command retries before throwing. Setting it to `null` means infinite retries, which can cause requests to hang forever.

`retryStrategy` controls the delay between reconnection attempts. The default is exponential backoff. Return `null` to stop retrying.

`lazyConnect` when set to true, ioredis does not connect until the first command is issued. This can speed up application startup.

`enableReadyCheck` when true (the default), ioredis waits for a successful INFO command before marking the connection as ready.

### Redis Data Types for Caching

For this course, you will use three Redis data types:

Strings hold serialized JSON for cache-aside. When you call `redis.set(key, JSON.stringify(data), "EX", 60)`, you are storing a string. This is the simplest and most common pattern.

Sorted sets (zsets) power the rate limiter. Each request is added with its timestamp as the score, and old entries are removed by score range. This naturally implements a sliding window.

Strings also store session data. Each session is a JSON blob keyed by session ID.

You will see hashes used in larger applications where you want to read or update individual fields of a cached object without deserializing the entire value. For our scope, plain strings with JSON are sufficient.

## Step by Step

### Step 1: Start Redis with Docker Compose

From the course root directory:

```bash
docker compose up -d redis
```

The `-d` flag runs it in the background. Verify it is running:

```bash
docker compose ps
```

You should see the redis service with status "Up" and port 6379 mapped.

### Step 2: Connect with redis-cli

```bash
docker compose exec redis redis-cli
```

You should see the Redis prompt:

```
127.0.0.1:6379>
```

Test basic operations:

```
PING
PONG

SET test:hello "world"
OK

GET test:hello
"world"

TTL test:hello
(integer) -1

SET test:temp "expires soon" EX 10
OK

TTL test:temp
(integer) 9

DEL test:hello test:temp
(integer) 2
```

Type `exit` to leave redis-cli.

### Step 3: Install Dependencies

In the backend directory:

```bash
cd backend
npm install
```

This installs ioredis along with express, cookie-parser, uuid, and dotenv.

### Step 4: Set Up Environment Variables

Copy the example env file:

```bash
cp .env.example .env
```

The contents are straightforward:

```
REDIS_URL=redis://localhost:6379
PORT=3001
```

If you are running the API outside Docker (using `npm run dev` directly), keep `localhost`. If you are running inside Docker Compose, the compose file overrides this with `redis://redis:6379`.

### Step 5: Start the Server and Verify Connection

```bash
npm run dev
```

You should see:

```
Connected to Redis
Server running on http://localhost:3001
```

The "Connected to Redis" message comes from the event listener in `redis.ts`. If you see a connection error instead, verify Redis is running with `docker compose ps`.

### Step 6: Test the Connection from the API

Hit the health endpoint:

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{ "status": "ok", "timestamp": "2026-02-18T10:00:00.000Z" }
```

Then hit the products endpoint and check for Redis-related headers:

```bash
curl -v http://localhost:3001/products 2>&1 | grep -E "X-Cache|X-Latency"
```

On the first request you should see `X-Cache: MISS`. On the second request, `X-Cache: HIT`. This confirms the entire pipeline is working: Express receives the request, the cache-aside function checks Redis, misses on the first call, populates Redis, and hits on the second call.

### Step 7: Inspect What is Stored in Redis

After making a products request, go back to redis-cli and look at what was cached:

```bash
docker compose exec redis redis-cli
```

```
KEYS *
1) "products:all"

GET products:all
"[{\"id\":\"1\",\"name\":\"Mechanical Keyboard\",...}]"

TTL products:all
(integer) 58

TYPE products:all
string
```

You can see the serialized JSON, the remaining TTL, and that it is stored as a string type. This is the data that the cache-aside function put there.

## Exercise

1. Use redis-cli to manually SET a key called `products:all` with a custom JSON value, then hit `GET /products`. Observe that the API returns your custom data (because it reads from cache first). Then delete the key and hit the endpoint again to see the real data restored. This demonstrates how the cache-aside pattern trusts whatever is in Redis.

2. Experiment with TTL. Set a key with `SET mykey "data" EX 5` and then run `TTL mykey` repeatedly to watch the countdown. What happens when TTL reaches 0?

3. Use SCAN to iterate through all keys with the `products:` prefix. How does the cursor-based iteration work? Run `SCAN 0 MATCH products:* COUNT 2` and follow the cursor until it returns "0".

4. Shut down Redis with `docker compose stop redis`, then try to hit the API. What happens? Check the error handling in `redis.ts` and the rate limiter's fail-open behavior in `backend/src/middleware/rate-limiter.ts`.

5. Explore the INFO command. Run `INFO keyspace` to see how many keys exist. Run `INFO stats` to see total commands processed and cache hit rates at the Redis server level.

## Summary

Redis is fast because it lives in memory, and ioredis makes it accessible from TypeScript with automatic reconnection and a clean async API. In this lesson you set up Redis with Docker Compose, learned the essential redis-cli commands for inspecting and manipulating cached data, and verified that the ioredis client in `backend/src/redis.ts` connects and handles errors gracefully. The graceful shutdown in `backend/src/index.ts` ensures connections are cleaned up when the server stops. With Redis running and connected, you are ready to implement the cache-aside pattern in the next lesson.
