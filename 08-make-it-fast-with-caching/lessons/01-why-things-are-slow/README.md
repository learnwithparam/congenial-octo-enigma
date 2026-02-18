# 01 — Why Things Are Slow

Every backend developer eventually faces the same question: why is this API so slow? Before reaching for caching libraries or infrastructure changes, you need to understand where time is actually being spent. This lesson teaches you to measure before you optimize, identify common performance bottlenecks in Node.js APIs, and build the mental model that guides every caching decision in the rest of this course.

## What You'll Learn

- How to profile individual operations using console.time and console.timeEnd
- What the N+1 problem looks like at the HTTP and database level
- The difference between cold requests and warm requests
- How to identify which parts of a request are slow
- Why measuring first is the single most important performance habit

## Key Concepts

### The Cost of a Request

When a client hits your API, time is spent in several places: network transit, middleware execution, business logic, and data fetching. Of these, data fetching almost always dominates. Whether you are querying a database, calling an external service, or reading from the filesystem, I/O is where latency hides.

Look at our simulated database in `backend/src/db.ts`:

```typescript
const SIMULATED_LATENCY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getAllProducts(): Promise<Product[]> {
  await sleep(SIMULATED_LATENCY_MS);
  return products;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  await sleep(SIMULATED_LATENCY_MS);
  return products.find((p) => p.id === id);
}
```

Every call to `getAllProducts()` or `getProductById()` costs 200 milliseconds. This simulates a real database query over a network connection. In production, PostgreSQL queries typically take 5-50ms for simple lookups, but can climb to 200ms or more for complex joins, full table scans, or when the database is under load.

The critical insight is this: 200ms per call means 10 sequential calls take 2 full seconds. That is unacceptable for most APIs.

### Profiling with console.time

The simplest profiling tool in Node.js is built right in. `console.time` starts a named timer, and `console.timeEnd` stops it and prints the elapsed time to stderr:

```typescript
console.time("getAllProducts");
const products = await getAllProducts();
console.timeEnd("getAllProducts");
// getAllProducts: 201.234ms
```

This is rough but effective. You can nest timers to understand the breakdown of a complex operation:

```typescript
async function handleProductsRequest() {
  console.time("total-request");

  console.time("fetch-products");
  const products = await getAllProducts();
  console.timeEnd("fetch-products");

  console.time("serialize");
  const json = JSON.stringify({ data: products });
  console.timeEnd("serialize");

  console.time("send-response");
  // ... send response
  console.timeEnd("send-response");

  console.timeEnd("total-request");
}
```

The output might look like:

```
fetch-products: 201.3ms
serialize: 0.2ms
send-response: 0.1ms
total-request: 202.1ms
```

Now you know that 99% of the request time is spent fetching data. Serialization and response sending are negligible. This tells you exactly where caching will help.

For more granular profiling, `performance.now()` gives you sub-millisecond precision:

```typescript
const start = performance.now();
const products = await getAllProducts();
const elapsed = performance.now() - start;
console.log(`Fetch took ${elapsed.toFixed(2)}ms`);
```

### The N+1 Problem at the HTTP Level

The N+1 problem is traditionally described in database terms: you fetch a list of N items, then make N additional queries to fetch related data. But the same pattern appears at the HTTP level, and it is just as destructive.

Imagine a frontend that needs to display a product catalog with reviews. A naive implementation might do this:

```typescript
// Client-side code — the N+1 anti-pattern
const products = await fetch("/products").then((r) => r.json());

// For each product, fetch its reviews
for (const product of products.data) {
  const reviews = await fetch(`/products/${product.id}/reviews`).then((r) =>
    r.json()
  );
  product.reviews = reviews;
}
```

If you have 5 products, this creates 6 HTTP requests (1 + N). Each request carries the overhead of TCP connection setup, TLS negotiation (for HTTPS), request serialization, server processing, and response deserialization. Even if each request takes only 200ms server-side, the sequential chain takes over a second.

The same pattern appears on the server side. Consider an endpoint that needs to assemble a product with related data:

```typescript
// Server-side N+1 — fetching related data one by one
app.get("/products/:id/full", async (req, res) => {
  console.time("full-product");

  const product = await getProductById(req.params.id); // 200ms
  const reviews = await getReviewsByProductId(req.params.id); // 200ms
  const inventory = await getInventoryByProductId(req.params.id); // 200ms
  const pricing = await getPricingByProductId(req.params.id); // 200ms

  console.timeEnd("full-product");
  // full-product: ~800ms

  res.json({ product, reviews, inventory, pricing });
});
```

Four sequential I/O calls. 800ms total. Your users are waiting almost a full second just because these calls are serialized.

The fix, even before caching, is to parallelize independent I/O:

```typescript
app.get("/products/:id/full", async (req, res) => {
  console.time("full-product-parallel");

  const [product, reviews, inventory, pricing] = await Promise.all([
    getProductById(req.params.id),
    getReviewsByProductId(req.params.id),
    getInventoryByProductId(req.params.id),
    getPricingByProductId(req.params.id),
  ]);

  console.timeEnd("full-product-parallel");
  // full-product-parallel: ~200ms

  res.json({ product, reviews, inventory, pricing });
});
```

Same data, one-quarter the time. And once you add caching on top, these 200ms calls become sub-millisecond Redis lookups.

### Cold Requests vs Warm Requests

A cold request is the first request to an endpoint after the server starts (or after the cache has been cleared). Nothing is cached yet, so every data fetch hits the origin. A warm request benefits from data already being in cache.

Understanding this distinction matters because:

1. Cold requests establish the baseline. This is the worst-case performance your API delivers.
2. Warm requests show you what caching achieves. The gap between cold and warm is the value of your cache.
3. Cache expiration means periodic cold requests. When a TTL expires, the next request is cold again.

You can observe this directly in our codebase. The `cacheAside` function in `backend/src/cache.ts` returns a `source` field that tells you whether data came from cache or origin:

```typescript
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

The product routes in `backend/src/routes/products.ts` expose this information in response headers:

```typescript
res.set("X-Cache", result.source === "cache" ? "HIT" : "MISS");
res.set("X-Latency-Ms", String(result.latencyMs));
```

A cold request returns `X-Cache: MISS` with `X-Latency-Ms: 201`. A warm request returns `X-Cache: HIT` with `X-Latency-Ms: 1`. That is a 200x improvement.

### Identifying Bottlenecks Systematically

Random optimization is waste. You need a systematic approach:

1. Instrument your endpoints. Add timing to every I/O operation.
2. Measure under realistic conditions. A single request does not tell you about concurrency issues.
3. Look for the longest bar. If fetching data takes 200ms and everything else takes 2ms, optimize the data fetching.
4. Check for sequential I/O. Any `await` followed by another `await` on an independent operation is a parallelization opportunity.
5. Count your calls. If you are making the same query multiple times in a single request, that is a caching opportunity.

A useful pattern is to build a simple request-level profiler:

```typescript
class RequestProfiler {
  private timings: Map<string, number> = new Map();
  private starts: Map<string, number> = new Map();

  start(label: string): void {
    this.starts.set(label, Date.now());
  }

  end(label: string): void {
    const startTime = this.starts.get(label);
    if (startTime) {
      this.timings.set(label, Date.now() - startTime);
    }
  }

  getSummary(): Record<string, number> {
    return Object.fromEntries(this.timings);
  }
}
```

Attach it to the request object in middleware, and each handler can record where time goes. At the end, log the summary or return it in a debug header.

### Why Measure First

It is tempting to jump straight to caching everything. Resist this urge. Here is why:

Caching adds complexity. Every cache introduces a new state to manage, a new failure mode, and a new source of stale data bugs. If an endpoint is already fast enough, caching it just adds risk with no benefit.

Caching can mask problems. If a query is slow because of a missing database index, caching hides the symptom but leaves the disease. When the cache eventually expires, the slow query returns.

Not all slowness needs caching. Sometimes the fix is query optimization, connection pooling, payload reduction, or architectural changes. Measuring tells you which tool is appropriate.

The workflow is always:

1. Measure current performance
2. Set a target (e.g., p95 under 100ms)
3. Identify the bottleneck
4. Choose the right fix (cache, index, parallelize, redesign)
5. Measure again to confirm improvement

## Step by Step

### Step 1: Add Timing to a Route Handler

Pick the `GET /products` endpoint and add console.time calls around the database fetch:

```typescript
productsRouter.get("/", async (_req, res) => {
  console.time("GET /products");

  console.time("db-fetch");
  const products = await getAllProducts();
  console.timeEnd("db-fetch");

  console.time("response");
  res.json({ data: products });
  console.timeEnd("response");

  console.timeEnd("GET /products");
});
```

Start the server with `npm run dev` and hit `http://localhost:3001/products`. Observe the timing output in your terminal.

### Step 2: Make Multiple Requests

Hit the endpoint 5 times in a row using curl:

```bash
for i in {1..5}; do
  curl -s -o /dev/null -w "Request $i: %{time_total}s\n" http://localhost:3001/products
done
```

Without caching, every request takes roughly the same time. There is no warming effect because every call goes straight to the database.

### Step 3: Simulate an N+1 Pattern

Create a test script that fetches all products, then fetches each one individually:

```bash
# Fetch the list
curl -s http://localhost:3001/products | jq '.data[].id'

# Then fetch each product (N+1 pattern)
for id in 1 2 3 4 5; do
  curl -s -w "Product $id: %{time_total}s\n" -o /dev/null http://localhost:3001/products/$id
done
```

Total time: roughly 1.2 seconds (200ms per request times 6 requests). This is the cost of sequential I/O without caching.

### Step 4: Establish Your Baseline

Before adding any caching in the next lessons, record your baseline numbers. Hit the benchmark endpoint that is already built into the codebase:

```bash
curl -s http://localhost:3001/benchmark/compare?n=10 | jq .
```

This calls `backend/src/routes/benchmark.ts`, which runs the same endpoint with and without caching and reports the results. Save this output. You will compare it against the cached version later.

### Step 5: Examine the Response Metadata

The product routes already include cache metadata in the response. Make a request and inspect the headers:

```bash
curl -v http://localhost:3001/products 2>&1 | grep -i x-cache
curl -v http://localhost:3001/products 2>&1 | grep -i x-latency
```

On the first request (cold), you should see `X-Cache: MISS`. On subsequent requests (warm), you should see `X-Cache: HIT` with a dramatically lower `X-Latency-Ms` value.

## Exercise

1. Add `console.time` profiling to the `GET /products/category/:category` route handler. Measure the database fetch time separately from the total request time.

2. Write a bash script that hits `GET /products` 20 times and calculates the average response time. Compare this baseline against the cached version you will build in Lesson 03.

3. Create an N+1 scenario: write a script that fetches all products, extracts their categories, then fetches each category endpoint individually. Time the total. How many milliseconds could you save by batching these into a single request?

4. Add a simple profiler middleware that records the total time for every request and logs it when the response finishes. Use the `res.on("finish", ...)` pattern.

## Summary

Performance optimization starts with measurement. In this lesson you learned to use console.time for quick profiling, identified the N+1 anti-pattern at the HTTP level, and understood the difference between cold and warm requests. The simulated database in this project adds 200ms per call, making bottlenecks obvious, but in production the same patterns exist at smaller scales that add up under load. The numbers from this lesson become your baseline. Every caching technique in the following lessons exists to move those numbers from the "origin" column to the "cache" column, cutting response times by orders of magnitude.
