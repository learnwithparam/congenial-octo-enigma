# 03 — Cache-Aside Pattern

Cache-aside is the most common caching pattern in web applications. The application checks the cache first, and only goes to the database when the cache does not have the data. After fetching from the database, the application writes the result back into the cache so the next request is fast. This lesson walks through our implementation in `backend/src/cache.ts`, explains TTL strategy and key naming conventions, and shows you how to apply the pattern to real route handlers.

## What You'll Learn

- How the cache-aside (lazy-loading) pattern works step by step
- The role of TTL in balancing freshness and performance
- Cache key naming conventions that prevent collisions and enable targeted invalidation
- How to implement a generic cache wrapper function in TypeScript
- The difference between cache hits and cache misses and what each costs

## Key Concepts

### How Cache-Aside Works

The cache-aside pattern follows three steps on every read:

1. Check the cache. If the data exists (cache hit), return it immediately.
2. If the cache is empty (cache miss), fetch the data from the origin (database, API, etc.).
3. Store the fetched data in the cache with a TTL, then return it.

The "aside" in the name refers to the fact that the cache sits alongside the database rather than in front of it. The application is responsible for managing both the cache and the database. It reads from the cache, but it also decides when to populate and when to invalidate.

This is different from a read-through cache, where the cache layer itself fetches from the database on a miss. Cache-aside gives you more control, which is why it is the most widely used pattern in application-level caching.

### The Implementation

Our cache-aside function lives in `backend/src/cache.ts`:

```typescript
import { redis } from "./redis.js";
import type { CacheResult } from "./types.js";

const DEFAULT_TTL = 60; // seconds

export async function cacheAside<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<CacheResult<T>> {
  const start = Date.now();

  // 1. Try cache
  const cached = await redis.get(key);
  if (cached !== null) {
    return {
      data: JSON.parse(cached) as T,
      source: "cache",
      latencyMs: Date.now() - start,
    };
  }

  // 2. Cache miss — fetch from origin
  const data = await fetchFn();

  // 3. Populate cache
  await redis.set(key, JSON.stringify(data), "EX", ttl);

  return {
    data,
    source: "origin",
    latencyMs: Date.now() - start,
  };
}
```

Let us walk through each piece.

The function is generic: `cacheAside<T>` works with any data type. You pass in the cache key, a function that fetches the data from the origin, and an optional TTL.

Step 1 calls `redis.get(key)`. Redis returns `null` if the key does not exist or has expired. If it returns a string, we parse it as JSON and return immediately. The `source: "cache"` flag tells the caller this was a cache hit.

Step 2 runs only on a cache miss. The `fetchFn` parameter is a closure that the caller provides. This is where the database query or API call happens. In our product routes, this is something like `() => getProductsByCategory(category)`.

Step 3 writes the fetched data into Redis. `redis.set(key, value, "EX", ttl)` is the ioredis equivalent of `SET key value EX 60` in redis-cli. The `"EX"` flag means the TTL is in seconds.

The `CacheResult<T>` type from `backend/src/types.ts` carries metadata alongside the data:

```typescript
export interface CacheResult<T> {
  data: T;
  source: "cache" | "origin";
  latencyMs: number;
}
```

This metadata is valuable for monitoring and debugging. The route handlers use it to set response headers that tell you whether a particular request was served from cache or origin.

### TTL Strategy

TTL (time to live) is the expiration time you set on a cached key. When the TTL elapses, Redis automatically deletes the key. The next request triggers a cache miss, fetches fresh data, and repopulates the cache.

Choosing the right TTL is a trade-off:

Short TTL (e.g., 10-30 seconds) means data is never more than 30 seconds stale, but you get more cache misses. Good for data that changes frequently, like stock prices or live scores.

Medium TTL (e.g., 60-300 seconds) is the sweet spot for most API data. Product catalogs, user profiles, and configuration data rarely change more than once a minute.

Long TTL (e.g., 3600+ seconds) is appropriate for data that almost never changes, like country lists or feature flags. The risk is serving stale data for a long time after a change.

In our codebase, the routes use different TTLs based on the nature of the data:

```typescript
// Product list: 60 second TTL
const result = await cacheAside<Product[]>(
  "products:all",
  getAllProducts,
  60
);

// Single product: 120 second TTL (changes less often)
const result = await cacheAside<Product | undefined>(
  `products:${id}`,
  () => getProductById(id),
  120
);
```

The product list uses a shorter TTL because it is an aggregate view that changes whenever any product changes. Individual products use a longer TTL because a single product changes less frequently.

A common mistake is setting TTLs too long and then being surprised when users see stale data. The solution is not just shorter TTLs but active invalidation, which we cover in the next lesson.

### Cache Key Naming Conventions

A well-designed cache key scheme makes your caching system understandable and maintainable. Our project follows a colon-separated namespace pattern:

```
products:all              — list of all products
products:1                — product with id 1
products:category:electronics  — products in the electronics category
benchmark:products        — benchmark-specific product cache
session:abc-def-123       — session data for a specific session ID
rl:global:127.0.0.1       — rate limit data for an IP
```

The rules:

Use a top-level namespace that matches the resource type: `products`, `session`, `rl` (rate limit).

Use colons as separators. This is a Redis convention that tools like Redis Commander display as a tree structure.

Include enough specificity to avoid collisions. `products:1` and `products:2` are different keys. `products:category:electronics` and `products:category:accessories` are different keys.

Design keys so patterns work for invalidation. When a product is updated, you need to invalidate `products:all` and `products:category:*`. If your keys used a different separator or nesting scheme, the `SCAN MATCH` pattern might not work.

Never include user-controlled values directly in keys without sanitization. If a user can control part of the key, they could potentially access or manipulate other keys. For our project, product IDs come from the database, so this is safe.

### Cache Hit vs Cache Miss in Practice

Look at how the product routes expose cache status in `backend/src/routes/products.ts`:

```typescript
productsRouter.get(
  "/",
  httpCache({ maxAge: 30, staleWhileRevalidate: 60 }),
  etag(),
  async (_req, res) => {
    const result = await cacheAside<Product[]>(
      "products:all",
      getAllProducts,
      60
    );

    res.set("X-Cache", result.source === "cache" ? "HIT" : "MISS");
    res.set("X-Latency-Ms", String(result.latencyMs));
    res.json({
      data: result.data,
      meta: { source: result.source, latencyMs: result.latencyMs },
    });
  }
);
```

The `X-Cache` header is a standard convention. CDNs like Cloudflare and Fastly use the same header name. Setting it on your origin API makes it easy to trace cache behavior through the entire stack.

The `X-Latency-Ms` header shows the actual time spent. A cache hit might show 1-2ms (the time to query Redis and parse JSON). A cache miss shows 200+ ms (the database latency plus the Redis write).

The response body also includes a `meta` object with the same information. This is useful for client-side developers who want to display or log cache status without parsing headers.

### The Serialization Cost

One detail that is easy to overlook: `JSON.stringify` and `JSON.parse` have a cost. For small objects (a few KB), this cost is negligible, under 0.1ms. For large objects (hundreds of KB), it can take several milliseconds.

If you find that serialization is a bottleneck (profile it first), you have options:

1. Cache smaller objects. Instead of caching an entire product list with full descriptions, cache a summary with just IDs and names.
2. Use MessagePack or Protocol Buffers for more compact, faster serialization.
3. Use Redis hashes to store individual fields, avoiding the need to serialize and deserialize the entire object.

For our workshop, JSON serialization is fine. The products array is small and serialization adds less than 1ms.

### When Cache-Aside Falls Short

Cache-aside has a weakness: the thundering herd (or cache stampede) problem. When a popular key expires, multiple concurrent requests all see a cache miss at the same time. They all hit the database simultaneously, which can overload it. We address this in the next lesson on cache invalidation.

Another limitation is that cache-aside is purely reactive. The cache is only populated when a request triggers a miss. If you know data will be needed (e.g., during a product launch), you can proactively warm the cache by calling the cacheAside function during server startup or via a scheduled job.

## Step by Step

### Step 1: Understand the Flow with Logging

Add temporary logging to `cacheAside` to see the flow:

```typescript
export async function cacheAside<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<CacheResult<T>> {
  const start = Date.now();

  const cached = await redis.get(key);
  if (cached !== null) {
    console.log(`[CACHE HIT] ${key} — ${Date.now() - start}ms`);
    return {
      data: JSON.parse(cached) as T,
      source: "cache",
      latencyMs: Date.now() - start,
    };
  }

  console.log(`[CACHE MISS] ${key} — fetching from origin`);
  const data = await fetchFn();
  await redis.set(key, JSON.stringify(data), "EX", ttl);
  console.log(`[CACHE SET] ${key} — TTL ${ttl}s — ${Date.now() - start}ms`);

  return {
    data,
    source: "origin",
    latencyMs: Date.now() - start,
  };
}
```

Restart the server and make requests. Watch the logs to see the cache miss on the first call and cache hit on subsequent calls.

### Step 2: Test with the Products Endpoint

Make two requests and compare the headers:

```bash
# First request — cache miss
curl -s -D - http://localhost:3001/products | head -20

# Second request — cache hit
curl -s -D - http://localhost:3001/products | head -20
```

The first request should show `X-Cache: MISS` with a latency around 200ms. The second should show `X-Cache: HIT` with a latency of 1-2ms.

### Step 3: Observe Key Expiration

Set a short TTL and watch the key expire:

```bash
# Make a request (populates cache with 60s TTL)
curl -s http://localhost:3001/products > /dev/null

# Check TTL in redis-cli
docker compose exec redis redis-cli TTL products:all

# Wait 60 seconds, then check again
# TTL returns -2 (key does not exist)

# Next request will be a cache miss again
curl -s -D - http://localhost:3001/products | grep X-Cache
```

### Step 4: Test Category Caching

The category endpoint uses a parameterized cache key:

```bash
# Cache miss
curl -s http://localhost:3001/products/category/electronics | jq .meta

# Cache hit
curl -s http://localhost:3001/products/category/electronics | jq .meta

# Different category — different key — cache miss
curl -s http://localhost:3001/products/category/accessories | jq .meta
```

Verify in redis-cli:

```
KEYS products:category:*
1) "products:category:electronics"
2) "products:category:accessories"
```

### Step 5: Run the Tests

The test suite in `backend/tests/cache.test.ts` verifies the cache-aside behavior:

```bash
npm test
```

The tests cover four scenarios:

```typescript
it("should fetch from origin on cache miss", async () => {
  const result = await cacheAside("test:miss", async () => ({ value: 42 }));
  expect(result.source).toBe("origin");
  expect(result.data).toEqual({ value: 42 });
});

it("should return cached data on cache hit", async () => {
  await cacheAside("test:hit", async () => ({ value: 1 }));
  const result = await cacheAside("test:hit", async () => ({ value: 999 }));
  expect(result.source).toBe("cache");
  expect(result.data).toEqual({ value: 1 }); // original, not 999
});
```

The second test is particularly important. It proves that on a cache hit, the `fetchFn` is not called at all. Even though the second call passes a function that would return `{ value: 999 }`, the cached value `{ value: 1 }` is returned instead.

### Step 6: Inspect the Benchmark

Use the benchmark route to see the quantitative difference:

```bash
curl -s http://localhost:3001/benchmark/compare?n=20 | jq .
```

The response shows the uncached average latency (around 200ms), the cached average latency (around 10ms for the first call plus sub-millisecond for the rest), and the speedup factor.

## Exercise

1. Add a new cache key pattern for a "featured products" endpoint. Create a route that returns only products over $50, using a cache key like `products:featured`. Set a TTL of 300 seconds. How does the longer TTL affect cache hit rates over time?

2. Modify the `cacheAside` function to accept a `transform` option that processes the data before caching. For example, you might want to strip the `description` field from products in a list view to reduce cache size.

3. Create a "cache warming" function that pre-populates the cache on server startup. Call `cacheAside` for `products:all` and each category during the server boot sequence in `index.ts`. Measure the difference in first-request latency.

4. Add a `GET /cache/stats` endpoint that returns the number of cached product keys, their TTLs, and the total memory used by the cache. Use `redis.keys("products:*")` for development (remember: never in production) and `redis.memory("USAGE", key)` for size information.

## Summary

Cache-aside is a simple pattern with a large impact. The `cacheAside` function in `backend/src/cache.ts` is under 30 lines of code, but it transforms 200ms database calls into sub-millisecond cache lookups. The key elements are: check the cache first, fetch from origin on a miss, and populate the cache with a TTL. Naming your cache keys with colon-separated namespaces keeps things organized and enables pattern-based invalidation. The `CacheResult` type gives callers visibility into whether data came from cache or origin, which feeds into the response headers and monitoring. In the next lesson, you will learn how to handle the hard part: invalidating the cache when data changes.
