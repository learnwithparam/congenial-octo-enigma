# 04 — Cache Invalidation

There are two hard things in computer science: cache invalidation, naming things, and off-by-one errors. The joke lands because cache invalidation really is hard. When data changes, the cache must reflect that change, or users see stale information. This lesson covers the invalidation strategies implemented in our codebase, including key-level deletion, pattern-based invalidation, write-through updates, and techniques to prevent cache stampedes.

## What You'll Learn

- Why stale caches are a real problem and how they manifest
- Key-based and pattern-based invalidation strategies
- Write-through caching vs write-behind caching
- How cache stampedes happen and how to prevent them
- The tag-based invalidation approach for complex dependency graphs
- How our product routes handle invalidation on updates

## Key Concepts

### The Stale Data Problem

Imagine this scenario: a product price changes from $149.99 to $129.99. The database is updated, but the cache still holds the old price with 45 seconds remaining on its TTL. For those 45 seconds, every user who views this product sees the wrong price. In an e-commerce system, this could mean overselling at the wrong price or losing customer trust.

TTL alone is not sufficient for data that changes through user actions. You need active invalidation: when data changes, you explicitly remove or update the cached version.

### Key-Based Invalidation

The simplest form of invalidation: delete the specific key that holds stale data. Our `invalidateKey` function in `backend/src/cache.ts` does exactly this:

```typescript
export async function invalidateKey(key: string): Promise<void> {
  await redis.del(key);
}
```

This is used in the product update route in `backend/src/routes/products.ts`:

```typescript
productsRouter.put("/:id", async (req, res) => {
  const id = req.params.id as string;
  const updated = await updateProduct(id, req.body);

  if (!updated) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Invalidate specific product cache
  await invalidateKey(`products:${id}`);

  // Invalidate list caches (all products and category lists)
  await invalidatePattern("products:all");
  await invalidatePattern(`products:category:*`);

  res.json({ data: updated, cacheInvalidated: true });
});
```

When product 1 is updated, three things happen:

1. The specific product key `products:1` is deleted.
2. The `products:all` list cache is deleted, because the list contains the updated product.
3. All category caches (`products:category:electronics`, `products:category:accessories`, etc.) are deleted, because we do not know which category the product belongs to without checking.

The next request for any of these endpoints will trigger a cache miss, fetch fresh data from the database, and repopulate the cache. This is the "invalidate and let it refill lazily" strategy.

### Pattern-Based Invalidation

Sometimes a single change affects many cache keys. Updating a product affects its individual key, the list of all products, and the category list it belongs to. Rather than tracking every related key, we use pattern-based invalidation with Redis SCAN.

The `invalidatePattern` function in `backend/src/cache.ts`:

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

SCAN iterates through the key space without blocking Redis. The `MATCH` parameter filters keys by glob pattern. The `COUNT` parameter is a hint to Redis about how many keys to examine per iteration (not a strict limit on results).

The function returns the total number of deleted keys, which is useful for logging and debugging.

Why SCAN instead of KEYS? The KEYS command blocks Redis while it scans every key in the database. On a Redis instance with millions of keys, this can take seconds and block all other operations. SCAN does the same work incrementally, processing a batch at a time and yielding between batches.

The test in `backend/tests/cache.test.ts` verifies this behavior:

```typescript
it("should invalidate keys by pattern", async () => {
  await cacheAside("test:pattern:a", async () => "a");
  await cacheAside("test:pattern:b", async () => "b");

  const deleted = await invalidatePattern("test:pattern:*");
  expect(deleted).toBe(2);
});
```

### Write-Through Caching

In write-through caching, you update the cache at the same time you update the database. Instead of deleting the cache and letting the next read repopulate it, you proactively write the new value:

```typescript
// Write-through: update DB and cache together
async function updateProductWriteThrough(
  id: string,
  updates: Partial<Omit<Product, "id">>
): Promise<Product | undefined> {
  const updated = await updateProduct(id, updates);
  if (!updated) return undefined;

  // Write the new value directly into cache
  await redis.set(`products:${id}`, JSON.stringify(updated), "EX", 120);

  // Still need to invalidate list caches
  await invalidatePattern("products:all");
  await invalidatePattern("products:category:*");

  return updated;
}
```

The advantage is that the next read for `products:1` is immediately a cache hit with fresh data. There is no "cold" period after the update.

The disadvantage is more complexity. You need to be careful that the data written to the cache matches exactly what a read would return. If the read path transforms the data or joins it with other tables, the write-through value might be incorrect.

Our codebase uses the simpler "invalidate on write" approach because the product data is self-contained and does not require joins.

### Write-Behind (Write-Back) Caching

Write-behind is the inverse: write to the cache first, and asynchronously sync to the database later. This gives extremely fast write latency because the client does not wait for the database.

```typescript
// Write-behind: update cache immediately, DB later
async function updateProductWriteBehind(
  id: string,
  updates: Partial<Omit<Product, "id">>
): Promise<Product> {
  // Read current from cache or DB
  const current = await cacheAside<Product>(
    `products:${id}`,
    () => getProductById(id)
  );

  const updated = { ...current.data, ...updates, updatedAt: new Date().toISOString() };

  // Write to cache immediately
  await redis.set(`products:${id}`, JSON.stringify(updated), "EX", 120);

  // Queue database write for later
  await redis.lpush("db:write:queue", JSON.stringify({ id, updates }));

  return updated;
}
```

Write-behind is risky. If Redis crashes before the database write completes, data is lost. It is only appropriate when you can tolerate some data loss and need extremely low write latency. We do not use it in this project.

### Tag-Based Invalidation

As your cache grows, tracking which keys to invalidate becomes complex. A tag-based system associates cache entries with tags, and invalidating a tag deletes all associated entries.

Here is how you might implement it:

```typescript
async function cacheWithTags<T>(
  key: string,
  tags: string[],
  fetchFn: () => Promise<T>,
  ttl: number = 60
): Promise<CacheResult<T>> {
  const result = await cacheAside(key, fetchFn, ttl);

  // Associate this key with each tag
  for (const tag of tags) {
    await redis.sadd(`tag:${tag}`, key);
    await redis.expire(`tag:${tag}`, ttl + 60); // tag outlives its entries
  }

  return result;
}

async function invalidateTag(tag: string): Promise<number> {
  const keys = await redis.smembers(`tag:${tag}`);
  if (keys.length === 0) return 0;

  await redis.del(...keys);
  await redis.del(`tag:${tag}`);
  return keys.length;
}
```

Usage would look like:

```typescript
// Cache with tags
await cacheWithTags(
  "products:1",
  ["product", "category:electronics"],
  () => getProductById("1")
);

await cacheWithTags(
  "products:all",
  ["product"],
  getAllProducts
);

// Invalidate everything tagged "product"
await invalidateTag("product");
```

This is more flexible than pattern-based invalidation because keys do not need to follow a naming convention. A product page cache, a search results cache, and a recommendation cache can all be tagged with "product" even though their keys are completely different.

### Cache Stampede Prevention

A cache stampede occurs when a popular key expires and dozens (or thousands) of concurrent requests all see a cache miss simultaneously. They all query the database at the same time, potentially overwhelming it.

There are several strategies to prevent this:

Stale-while-revalidate: serve the stale cached value while one request refreshes the cache in the background.

```typescript
async function cacheAsideWithStale<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 60,
  staleTtl: number = 300
): Promise<CacheResult<T>> {
  const start = Date.now();
  const cached = await redis.get(key);

  if (cached !== null) {
    const data = JSON.parse(cached) as T;
    const remainingTtl = await redis.ttl(key);

    // If TTL is low, trigger background refresh
    if (remainingTtl < ttl * 0.1) {
      // Fire and forget — refresh in background
      fetchFn().then(async (fresh) => {
        await redis.set(key, JSON.stringify(fresh), "EX", ttl);
      });
    }

    return { data, source: "cache", latencyMs: Date.now() - start };
  }

  const data = await fetchFn();
  await redis.set(key, JSON.stringify(data), "EX", ttl);
  return { data, source: "origin", latencyMs: Date.now() - start };
}
```

Locking: use a Redis lock so only one request fetches from the origin while others wait.

```typescript
async function cacheAsideWithLock<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 60
): Promise<CacheResult<T>> {
  const start = Date.now();
  const cached = await redis.get(key);

  if (cached !== null) {
    return {
      data: JSON.parse(cached) as T,
      source: "cache",
      latencyMs: Date.now() - start,
    };
  }

  const lockKey = `lock:${key}`;
  const acquired = await redis.set(lockKey, "1", "EX", 10, "NX");

  if (acquired) {
    // We got the lock — fetch and populate
    const data = await fetchFn();
    await redis.set(key, JSON.stringify(data), "EX", ttl);
    await redis.del(lockKey);
    return { data, source: "origin", latencyMs: Date.now() - start };
  }

  // Another request is fetching — wait and retry
  await new Promise((r) => setTimeout(r, 100));
  return cacheAsideWithLock(key, fetchFn, ttl);
}
```

The `NX` flag in `redis.set(lockKey, "1", "EX", 10, "NX")` means "set only if the key does not exist." This is an atomic operation in Redis, so exactly one request wins the lock. The `EX 10` ensures the lock expires even if the winning request crashes.

Our codebase uses the simple cache-aside pattern without stampede protection because the simulated database handles concurrent requests fine. In a production system with a database that struggles under concurrent load, adding one of these strategies is important.

### Invalidation Timing

The order of operations matters. In our update route:

```typescript
const updated = await updateProduct(id, req.body);
await invalidateKey(`products:${id}`);
await invalidatePattern("products:all");
await invalidatePattern(`products:category:*`);
```

The database is updated first, then the cache is invalidated. This order ensures that when the cache is repopulated on the next read, it fetches the new data from the database. If you invalidated first and the database update failed, the cache would be empty but the data unchanged, causing an unnecessary cache miss but no stale data.

What about the window between the database update and the cache invalidation? During those few milliseconds, a concurrent read could still get the old cached value. This is usually acceptable. If strict consistency is required, you would need to use a distributed transaction or a write-through approach where the cache and database are updated atomically.

## Step by Step

### Step 1: Test Key-Based Invalidation

First, populate the cache by hitting the product endpoint:

```bash
curl -s http://localhost:3001/products/1 | jq .meta
```

Verify the key exists in Redis:

```bash
docker compose exec redis redis-cli GET products:1
```

Now update the product:

```bash
curl -s -X PUT http://localhost:3001/products/1 \
  -H "Content-Type: application/json" \
  -d '{"price": 129.99}' | jq .
```

The response includes `"cacheInvalidated": true`. Check that the key was deleted:

```bash
docker compose exec redis redis-cli GET products:1
# (nil)
```

Fetch the product again and confirm the new price:

```bash
curl -s http://localhost:3001/products/1 | jq .data.price
# 129.99
```

### Step 2: Test Pattern-Based Invalidation

Populate multiple cache keys:

```bash
curl -s http://localhost:3001/products > /dev/null
curl -s http://localhost:3001/products/category/electronics > /dev/null
curl -s http://localhost:3001/products/category/accessories > /dev/null
```

Verify all keys exist:

```bash
docker compose exec redis redis-cli KEYS "products:*"
```

Update any product to trigger pattern invalidation:

```bash
curl -s -X PUT http://localhost:3001/products/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Mechanical Keyboard Pro"}' | jq .
```

Check which keys remain:

```bash
docker compose exec redis redis-cli KEYS "products:*"
```

The individual product key, the `products:all` key, and all category keys should be gone. The next request to any of these endpoints will be a cache miss that fetches fresh data.

### Step 3: Verify the Test Suite

Run the tests to confirm invalidation works programmatically:

```bash
npm test
```

Pay attention to the invalidation tests:

```typescript
it("should invalidate a specific key", async () => {
  await cacheAside("test:inv", async () => "hello");
  await invalidateKey("test:inv");

  const result = await cacheAside("test:inv", async () => "world");
  expect(result.source).toBe("origin");
  expect(result.data).toBe("world");
});
```

After invalidation, the next call is a cache miss that returns the new data ("world"), not the old data ("hello").

### Step 4: Observe the Invalidation Cascade

Add logging to the PUT route to see the full cascade:

```typescript
productsRouter.put("/:id", async (req, res) => {
  const id = req.params.id as string;
  const updated = await updateProduct(id, req.body);

  if (!updated) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  console.log(`[INVALIDATE] products:${id}`);
  await invalidateKey(`products:${id}`);

  console.log("[INVALIDATE] products:all");
  await invalidatePattern("products:all");

  const categoryDeleted = await invalidatePattern("products:category:*");
  console.log(`[INVALIDATE] products:category:* — ${categoryDeleted} keys`);

  res.json({ data: updated, cacheInvalidated: true });
});
```

### Step 5: Simulate a Stale Data Scenario

To understand why invalidation matters, try this:

1. Fetch the product list: `curl -s http://localhost:3001/products | jq .data[0].price`
2. Manually change the cached value in Redis: `docker compose exec redis redis-cli SET products:all '[{"id":"1","name":"WRONG DATA","price":0}]' EX 300`
3. Fetch the product list again: `curl -s http://localhost:3001/products | jq .data[0].name`
4. It returns "WRONG DATA" because cache-aside trusts the cache blindly.
5. Now update a product through the API to trigger invalidation.
6. Fetch the product list one more time. The correct data is back.

This exercise demonstrates both the risk of stale data and the power of proper invalidation.

## Exercise

1. Implement tag-based invalidation as described in the Key Concepts section. Add a `cacheWithTags` function to `cache.ts` and an `invalidateTag` function. Test it by tagging product caches with "product" and category caches with both "product" and their specific category.

2. Implement a simple stampede lock. Modify `cacheAside` to use a Redis lock (SET with NX) so that on a cache miss, only one request fetches from the origin while others wait. Test it by making 10 concurrent requests to an uncached endpoint.

3. Add a `DELETE /products/:id/cache` endpoint that invalidates just the cache for a single product without modifying the database. This is useful for admin tools that need to force a cache refresh.

4. Create a "selective invalidation" system. When a product is updated, check which category it belongs to and only invalidate that specific category key instead of all categories. This reduces unnecessary cache misses.

## Summary

Cache invalidation requires thinking about the relationship between cached data and the source of truth. Our codebase uses two strategies: `invalidateKey` for precise single-key deletion and `invalidatePattern` for broad pattern-based cleanup using Redis SCAN. The product update route demonstrates the cascade: updating one product invalidates its individual key, the full product list, and all category caches. Write-through caching can eliminate the cold request after an update, and stampede prevention techniques protect the database from concurrent cache misses. The right invalidation strategy depends on your consistency requirements: TTL-only is simplest, explicit invalidation on write is the most common, and write-through offers the strongest freshness guarantee.
