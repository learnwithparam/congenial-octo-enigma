# 08 — Performance Benchmarks

You started this course by measuring how slow things were. Now it is time to measure how fast they have become. This lesson teaches you to run structured benchmarks, interpret the results, and use load testing tools to understand how caching performs under realistic conditions. The benchmark routes in `backend/src/routes/benchmark.ts` provide built-in comparisons, and external tools like autocannon and wrk let you push the server harder.

## What You'll Learn

- How to use the built-in benchmark routes to compare cached vs uncached performance
- How to run load tests with autocannon and wrk
- What p95 latency means and why it matters more than averages
- How to calculate and interpret cache hit ratios
- Before and after measurements that quantify the impact of every caching layer
- How to identify when caching is not helping and what to do about it

## Key Concepts

### The Benchmark Route

The project includes a dedicated benchmark route in `backend/src/routes/benchmark.ts` that runs controlled comparisons between cached and uncached requests:

```typescript
benchmarkRouter.get("/compare", async (req, res) => {
  const iterations = Math.min(Number(req.query.n) || 10, 100);

  // Uncached: direct DB calls
  const uncachedLatencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await getAllProducts();
    uncachedLatencies.push(Date.now() - start);
  }

  // Cached: first call populates, rest hit cache
  const cachedLatencies: number[] = [];
  let cacheHits = 0;
  for (let i = 0; i < iterations; i++) {
    const result = await cacheAside<Product[]>(
      "benchmark:products",
      getAllProducts,
      30
    );
    cachedLatencies.push(result.latencyMs);
    if (result.source === "cache") cacheHits++;
  }

  const avg = (arr: number[]) =>
    arr.reduce((a, b) => a + b, 0) / arr.length;

  const p95 = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)];
  };

  const uncached: BenchmarkResult = {
    endpoint: "GET /products (uncached)",
    totalRequests: iterations,
    avgLatencyMs: Math.round(avg(uncachedLatencies)),
    p95LatencyMs: p95(uncachedLatencies),
    cacheHitRate: 0,
  };

  const cached: BenchmarkResult = {
    endpoint: "GET /products (cached)",
    totalRequests: iterations,
    avgLatencyMs: Math.round(avg(cachedLatencies)),
    p95LatencyMs: p95(cachedLatencies),
    cacheHitRate: Math.round((cacheHits / iterations) * 100),
  };

  const speedup =
    uncached.avgLatencyMs > 0
      ? Math.round(uncached.avgLatencyMs / Math.max(cached.avgLatencyMs, 1))
      : 0;

  res.json({
    iterations,
    uncached,
    cached,
    speedup: `${speedup}x faster with cache`,
  });
});
```

This route does a controlled experiment. It runs N iterations of the same operation first without caching (direct `getAllProducts()` calls), then with caching (through `cacheAside`). It records latency for each call and calculates averages, p95, and cache hit rate.

The `BenchmarkResult` type from `backend/src/types.ts` structures the output:

```typescript
export interface BenchmarkResult {
  endpoint: string;
  totalRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  cacheHitRate: number;
}
```

### Understanding the Metrics

Average latency is the mean response time across all requests. It is useful for a quick overview but can be misleading. If 99 requests take 1ms and 1 request takes 1000ms, the average is about 11ms. That hides the fact that one user had a terrible experience.

P95 latency (95th percentile) is the latency below which 95% of requests fall. In the example above, the p95 would be 1ms because 95 out of 100 requests completed in 1ms. P95 is a much better indicator of user experience than averages because it captures the "almost worst case" without being dominated by extreme outliers.

The p95 calculation in the benchmark route:

```typescript
const p95 = (arr: number[]) => {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)];
};
```

It sorts all latencies and picks the value at the 95th percentile index. For 20 iterations, that is index 19 (floor of 20 * 0.95 = 19), which is the second-slowest request.

Cache hit rate is the percentage of requests served from cache. In the benchmark, the first request is always a cache miss (it populates the cache), and all subsequent requests are cache hits. So for 20 iterations, the hit rate is 95% (19 hits out of 20).

The speedup factor divides the uncached average by the cached average. With our simulated 200ms database latency and sub-millisecond Redis reads, this is typically 100x to 200x.

### Single Product Benchmarks

The benchmark route also supports testing individual product lookups:

```typescript
benchmarkRouter.get("/single/:id", async (req, res) => {
  const id = req.params.id as string;
  const iterations = Math.min(Number(req.query.n) || 10, 100);

  const uncachedLatencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await getProductById(id);
    uncachedLatencies.push(Date.now() - start);
  }

  const cachedLatencies: number[] = [];
  let cacheHits = 0;
  for (let i = 0; i < iterations; i++) {
    const result = await cacheAside<Product | undefined>(
      `benchmark:product:${id}`,
      () => getProductById(id),
      30
    );
    cachedLatencies.push(result.latencyMs);
    if (result.source === "cache") cacheHits++;
  }

  const avg = (arr: number[]) =>
    arr.reduce((a, b) => a + b, 0) / arr.length;

  res.json({
    productId: id,
    iterations,
    uncachedAvgMs: Math.round(avg(uncachedLatencies)),
    cachedAvgMs: Math.round(avg(cachedLatencies)),
    cacheHitRate: `${Math.round((cacheHits / iterations) * 100)}%`,
  });
});
```

This isolates the performance of a single key lookup, which is useful for understanding per-key caching behavior. The cache key uses the `benchmark:` prefix to avoid interfering with the application's `products:` cache.

### Load Testing with autocannon

The built-in benchmark route is useful for quick comparisons, but it runs requests sequentially on the server side. A real load test should send concurrent requests from the outside to measure how the server performs under pressure.

autocannon is a Node.js-based HTTP load testing tool. Install it globally:

```bash
npm install -g autocannon
```

Run a basic load test:

```bash
autocannon -c 10 -d 10 http://localhost:3001/products
```

This sends requests from 10 concurrent connections for 10 seconds. The output includes:

```
Stat    2.5%  50%   97.5%  99%    Avg     Stdev   Max
Latency 1ms   2ms   5ms    10ms   2.5ms   1.2ms   15ms

Req/Bytes counts sampled over 10s
Req/s:  3500
```

The important numbers:

- Latency at the 97.5th percentile: this is similar to p95 and shows what "slow" requests look like.
- Requests per second (Req/s): this is your throughput.
- Max latency: the single worst request.

Run the same test against a different endpoint to compare:

```bash
# Cached endpoint
autocannon -c 10 -d 10 http://localhost:3001/products

# Health check (no caching needed, baseline)
autocannon -c 10 -d 10 http://localhost:3001/health
```

For more advanced testing:

```bash
# Higher concurrency
autocannon -c 50 -d 30 http://localhost:3001/products

# Specific number of requests
autocannon -c 10 -a 1000 http://localhost:3001/products

# With request pipeline (multiple requests per connection)
autocannon -c 10 -d 10 -p 10 http://localhost:3001/products
```

### Load Testing with wrk

wrk is a C-based load testing tool that can generate more traffic than autocannon with less overhead. If you are on macOS:

```bash
brew install wrk
```

Basic usage:

```bash
wrk -t4 -c100 -d10s http://localhost:3001/products
```

- `-t4`: 4 threads
- `-c100`: 100 concurrent connections
- `-d10s`: 10-second duration

wrk output looks like:

```
Running 10s test @ http://localhost:3001/products
  4 threads and 100 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    2.50ms    1.20ms   15.00ms   85%
    Req/Sec     2.50k     300      3.50k    75%
  100000 requests in 10s, 50.00MB read
Requests/sec:  10000
Transfer/sec:   5.00MB
```

wrk is generally preferred for high-concurrency tests because its C implementation handles more connections with less overhead than Node.js-based tools.

### Before and After: What Caching Achieves

To quantify the full impact of caching, measure each endpoint with and without the caching layers enabled. Here is a structured benchmark plan:

Test 1 — No caching at all:
Disable Redis caching (comment out the cacheAside calls in routes, use direct database functions). Disable HTTP cache middleware. Run autocannon and record results.

Test 2 — Redis caching only:
Enable cacheAside but keep HTTP cache middleware disabled. Run autocannon. The first request is slow (cache miss), subsequent requests are fast (cache hits).

Test 3 — Redis caching plus HTTP caching:
Enable both layers. For browser-based testing, the first request populates both caches, subsequent requests within the max-age window never reach the server.

Expected results for `GET /products`:

```
| Configuration          | Avg Latency | p95 Latency | Req/s   |
|------------------------|-------------|-------------|---------|
| No caching             | ~200ms      | ~205ms      | ~50     |
| Redis cache only       | ~2ms        | ~5ms        | ~5000   |
| Redis + HTTP cache     | ~0ms*       | ~0ms*       | N/A**   |
```

(The HTTP cache results show 0ms because the browser serves from its local cache without making a network request. The server sees no traffic at all.)

### Cache Hit Ratio Analysis

The cache hit ratio is the most important metric for understanding whether your caching strategy is working:

```
hit_ratio = cache_hits / (cache_hits + cache_misses)
```

A high hit ratio (above 90%) means most requests are served from cache. A low hit ratio suggests one of several problems:

TTL is too short. If your TTL is 10 seconds and you get 1 request per second to an endpoint, the hit ratio is 90%. If you increase the TTL to 60 seconds, the hit ratio climbs to 98%.

Too many unique keys. If every request generates a unique cache key (e.g., including query parameters, timestamps, or user IDs), the cache cannot serve repeat requests. Review your key naming strategy.

Frequent invalidation. If products are updated every few seconds, the cache is invalidated constantly and the hit ratio drops. Consider whether you can tolerate slightly stale data.

Cold start after deploy. When you deploy new code and restart servers, the Redis cache is still warm (assuming you did not flush it), but HTTP caches in browsers may have expired. The first few minutes after deploy might show higher origin load.

You can monitor the hit ratio from two places:

Application level: count cache hits and misses in your cacheAside function and expose them via an endpoint or metrics system.

Redis level: run `INFO stats` in redis-cli to see `keyspace_hits` and `keyspace_misses`:

```
INFO stats
...
keyspace_hits:150000
keyspace_misses:500
...
```

Hit ratio: 150000 / (150000 + 500) = 99.67%.

### When Caching Does Not Help

Not every performance problem is solved by caching. Watch for these patterns:

Cache thrashing: if you have more unique keys than Redis can hold in memory, old keys are evicted before they can be hit. Redis will use its eviction policy (typically LRU — least recently used) to make room. Monitor `evicted_keys` in `INFO stats`.

Write-heavy workloads: if the data changes more often than it is read, caching adds overhead (the write + invalidation) without providing benefit (no reads hit the cache before the next invalidation).

Already-fast operations: if your database query takes 2ms, adding a Redis cache that takes 1ms only saves 1ms. The complexity of cache management might not be worth a 1ms improvement.

Large payloads: serializing and deserializing a 10MB JSON blob for every cache hit might be slower than just querying the database. Profile it.

## Step by Step

### Step 1: Run the Built-In Benchmark

Start the server and Redis, then run the comparison:

```bash
curl -s http://localhost:3001/benchmark/compare?n=20 | jq .
```

Expected output:

```json
{
  "iterations": 20,
  "uncached": {
    "endpoint": "GET /products (uncached)",
    "totalRequests": 20,
    "avgLatencyMs": 200,
    "p95LatencyMs": 201,
    "cacheHitRate": 0
  },
  "cached": {
    "endpoint": "GET /products (cached)",
    "totalRequests": 20,
    "avgLatencyMs": 10,
    "p95LatencyMs": 1,
    "cacheHitRate": 95
  },
  "speedup": "200x faster with cache"
}
```

The uncached test shows consistent ~200ms latency (our simulated database delay). The cached test shows a higher average (pulled up by the first cache-miss request) but a p95 of ~1ms because 95% of requests are cache hits.

### Step 2: Benchmark a Single Product

```bash
curl -s http://localhost:3001/benchmark/single/1?n=20 | jq .
```

Expected output:

```json
{
  "productId": "1",
  "iterations": 20,
  "uncachedAvgMs": 200,
  "cachedAvgMs": 10,
  "cacheHitRate": "95%"
}
```

The pattern is the same: uncached is consistently slow, cached is fast after the first miss.

### Step 3: Run Multiple Benchmarks

Compare different product IDs:

```bash
for id in 1 2 3 4 5; do
  echo "Product $id:"
  curl -s "http://localhost:3001/benchmark/single/$id?n=10" | jq '{cachedAvgMs, cacheHitRate}'
  echo ""
done
```

All products should show similar results because the simulated database latency is the same for all products. In a real database, some queries might be faster or slower depending on table size, indexing, and query complexity.

### Step 4: Load Test with autocannon

Install autocannon if you have not already:

```bash
npm install -g autocannon
```

Run a 10-second load test with 10 concurrent connections:

```bash
autocannon -c 10 -d 10 http://localhost:3001/products
```

Record the output. Then flush the Redis cache and run again:

```bash
docker compose exec redis redis-cli FLUSHDB
autocannon -c 10 -d 10 http://localhost:3001/products
```

The first run should show consistently low latency (most requests hit the already-warm cache). The second run, after flushing, shows a spike at the beginning as the first request populates the cache, then low latency for the rest.

### Step 5: Compare Endpoints

Run the same load test against different endpoints to see the caching effect at different levels:

```bash
# Health check — no caching needed, minimal work
autocannon -c 10 -d 10 http://localhost:3001/health

# Product list — Redis + HTTP cached
autocannon -c 10 -d 10 http://localhost:3001/products

# Single product — Redis + HTTP cached with different TTL
autocannon -c 10 -d 10 http://localhost:3001/products/1

# Category — Redis + HTTP cached
autocannon -c 10 -d 10 http://localhost:3001/products/category/electronics
```

The health check should be the fastest (no I/O at all). The product endpoints should be nearly as fast on cache hits. Compare the throughput (requests per second) across endpoints.

### Step 6: Stress Test the Rate Limiter

See how the rate limiter affects throughput:

```bash
autocannon -c 1 -d 60 -r 10 http://localhost:3001/products
```

The `-r 10` flag limits the request rate to 10 per second. With a rate limit of 100 per 15 minutes, you should start seeing 429 responses after 10 seconds. Check the output for the percentage of non-200 responses.

### Step 7: Monitor Redis During Tests

While a load test is running, watch Redis in a separate terminal:

```bash
docker compose exec redis redis-cli monitor
```

This prints every command Redis receives in real time. You will see a flood of GET commands for cache hits and occasional SET commands when the cache is populated. Press Ctrl+C to stop.

For a higher-level view:

```bash
docker compose exec redis redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses|total_commands"
```

Run this before and after a load test to see the difference.

### Step 8: Measure HTTP Cache Impact

For the HTTP caching layer, you need a browser or a tool that respects Cache-Control headers. curl does not cache responses between invocations. Use the browser dev tools Network tab instead:

1. Open `http://localhost:3001/products` in your browser.
2. Note the response time in the Network tab.
3. Refresh the page (not hard refresh). If within the max-age window, the browser shows "(from disk cache)" or "(from memory cache)" with 0ms load time.
4. Hard refresh (Ctrl+Shift+R) to bypass the browser cache but still send If-None-Match for ETag validation.

The ETags save bandwidth: a 304 response is a few bytes versus potentially several KB for the full product list.

## Exercise

1. Write a comprehensive benchmark script that tests all product endpoints, records results in a JSON file, and prints a summary table. Run it once with the cache warm and once after FLUSHDB. Compare the results.

2. Add percentile calculations to the benchmark route: p50, p90, p95, and p99. These give a more complete picture of the latency distribution than just average and p95.

3. Create a `GET /benchmark/cache-ratio` endpoint that tracks cumulative cache hit/miss counts across all product endpoints (not just during a benchmark run). Use Redis counters (`INCR`) to track hits and misses globally.

4. Run a soak test with autocannon for 5 minutes at moderate load. Watch for memory leaks, increasing latency over time, or Redis connection issues. Plot the latency over time if autocannon supports it, or sample `INFO memory` periodically.

5. Benchmark the rate limiter overhead. Compare the throughput of `GET /health` with and without the rate limiter middleware applied. The difference tells you the per-request cost of the rate limiting check.

## Summary

Benchmarking closes the loop on performance optimization. The built-in benchmark routes in `backend/src/routes/benchmark.ts` provide quick A/B comparisons between cached and uncached requests, showing the raw speedup from Redis caching. External tools like autocannon and wrk push the server with realistic concurrent load, revealing throughput limits and tail latencies. The key metrics are average latency, p95 latency, requests per second, and cache hit ratio. In our project, the cache-aside pattern typically delivers a 100x to 200x improvement in latency and a proportional increase in throughput. But numbers only matter if you measure them, and this lesson gives you the tools to do that consistently. Measure before every optimization, measure after, and let the data guide your decisions.
