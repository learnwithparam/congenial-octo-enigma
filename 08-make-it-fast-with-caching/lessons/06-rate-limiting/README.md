# 06 — Rate Limiting

Rate limiting protects your API from abuse, prevents resource exhaustion, and enforces fair usage across clients. A Redis-backed rate limiter can make decisions in under a millisecond and share state across multiple server instances. This lesson covers the sliding window algorithm implemented in `backend/src/middleware/rate-limiter.ts`, how to configure different limits for different endpoints, what a proper 429 response looks like, and how clients should handle rate limit headers.

## What You'll Learn

- Why rate limiting is essential for production APIs
- How the sliding window log algorithm works using Redis sorted sets
- How to implement rate limiting as Express middleware
- How to configure different limits per endpoint and per client
- The standard rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- How 429 responses and Retry-After headers guide client behavior
- The fail-open design pattern for resilience

## Key Concepts

### Why Rate Limit

Without rate limiting, a single client can:

- Consume all your server's resources by sending thousands of requests per second.
- Scrape your entire product catalog by automating API calls.
- Trigger a denial-of-service by exhausting your database connection pool.
- Run up your cloud bill by generating massive traffic to pay-per-request services.

Rate limiting puts a ceiling on how many requests a client can make within a time window. Once the limit is reached, the server rejects additional requests with a 429 Too Many Requests status code.

### The Sliding Window Log Algorithm

There are several rate limiting algorithms. Our implementation uses the sliding window log, which tracks exact request timestamps in a Redis sorted set.

The core idea: for each client, maintain a sorted set where each element is a request timestamp and the score is also that timestamp. To check the rate limit, remove all elements older than the window, count what remains, and compare against the maximum.

Here is the implementation from `backend/src/middleware/rate-limiter.ts`:

```typescript
interface RateLimitOptions {
  windowMs: number;      // window size in milliseconds
  max: number;           // max requests per window
  keyPrefix?: string;    // Redis key prefix
  keyGenerator?: (req: Request) => string;
}

export function rateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyPrefix = "rl",
    keyGenerator = (req) => req.ip || "unknown",
  } = options;

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const clientKey = keyGenerator(req);
    const redisKey = `${keyPrefix}:${clientKey}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use a pipeline for atomicity
      const pipeline = redis.pipeline();

      // Remove entries outside the window
      pipeline.zremrangebyscore(redisKey, 0, windowStart);

      // Count remaining entries in the window
      pipeline.zcard(redisKey);

      // Add current request
      pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);

      // Set expiry on the key
      pipeline.pexpire(redisKey, windowMs);

      const results = await pipeline.exec();

      // zcard result is at index 1
      const requestCount = (results?.[1]?.[1] as number) || 0;

      const resetAt = now + windowMs;
      const remaining = Math.max(0, max - requestCount - 1);

      const info: RateLimitInfo = {
        limit: max,
        remaining,
        resetAt,
      };

      // Set rate limit headers
      res.set("X-RateLimit-Limit", String(info.limit));
      res.set("X-RateLimit-Remaining", String(info.remaining));
      res.set("X-RateLimit-Reset", String(Math.ceil(info.resetAt / 1000)));

      if (requestCount >= max) {
        res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
        res.status(429).json({
          error: "Too Many Requests",
          retryAfter: Math.ceil(windowMs / 1000),
          ...info,
        });
        return;
      }

      next();
    } catch (err) {
      // If Redis is down, allow the request (fail open)
      console.error("Rate limiter error:", err);
      next();
    }
  };
}
```

Let us trace through the algorithm step by step.

### Step-by-Step: What Happens on Each Request

Say the window is 15 minutes (900,000 ms) and the maximum is 100 requests. The current time is `1708300000000` (a Unix timestamp in milliseconds).

1. `zremrangebyscore(redisKey, 0, windowStart)` removes all sorted set members with a score (timestamp) less than `now - 900000`. This prunes requests that are older than 15 minutes.

2. `zcard(redisKey)` counts how many entries remain in the sorted set. This is the number of requests the client has made in the current 15-minute window.

3. `zadd(redisKey, now, "${now}:${Math.random()}")` adds the current request to the sorted set. The score is the current timestamp. The member value includes `Math.random()` to ensure uniqueness (two requests in the same millisecond would otherwise collide).

4. `pexpire(redisKey, windowMs)` sets a TTL on the entire sorted set key. This is a safety net: if a client stops making requests, the key eventually expires rather than lingering forever.

All four commands are sent as a pipeline, which means they execute as a batch in Redis with a single round trip. This is both faster and more consistent than four separate commands.

### Redis Pipelines

The pipeline is an important optimization. Without it, each command would be a separate round trip to Redis:

```
App -> Redis: ZREMRANGEBYSCORE  (1ms round trip)
App -> Redis: ZCARD             (1ms round trip)
App -> Redis: ZADD              (1ms round trip)
App -> Redis: PEXPIRE           (1ms round trip)
Total: ~4ms
```

With a pipeline, all commands are sent together:

```
App -> Redis: [ZREMRANGEBYSCORE, ZCARD, ZADD, PEXPIRE]  (1ms round trip)
Total: ~1ms
```

For a rate limiter that runs on every single request, this 3ms saving per request matters. The `redis.pipeline()` method in ioredis buffers commands and sends them all at once when `exec()` is called.

### Why Sorted Sets

The sorted set data type is ideal for the sliding window log because:

- Members are stored sorted by score, and the score is the timestamp.
- `ZREMRANGEBYSCORE` efficiently removes all members below a threshold (old requests outside the window).
- `ZCARD` returns the count in O(1) time.
- `ZADD` inserts in O(log N) time.

Compared to alternatives:

A simple counter (using INCR) can track requests per window but creates a "fixed window" problem where a burst at the boundary of two windows allows double the limit.

A list (using LPUSH/LLEN) works but does not support efficient removal of old entries by timestamp.

### Rate Limit Headers

The middleware sets three standard headers on every response, even when the request is allowed:

```typescript
res.set("X-RateLimit-Limit", String(info.limit));
res.set("X-RateLimit-Remaining", String(info.remaining));
res.set("X-RateLimit-Reset", String(Math.ceil(info.resetAt / 1000)));
```

`X-RateLimit-Limit` is the maximum number of requests allowed in the window (e.g., 100).

`X-RateLimit-Remaining` is how many requests the client has left before being throttled (e.g., 87).

`X-RateLimit-Reset` is a Unix timestamp (in seconds) when the window resets and the client gets a fresh quota.

These headers allow well-behaved clients to manage their own request rate without hitting the limit. An API client library can check `X-RateLimit-Remaining` and slow down when it gets low.

### The 429 Response

When the limit is exceeded, the response is:

```typescript
res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
res.status(429).json({
  error: "Too Many Requests",
  retryAfter: Math.ceil(windowMs / 1000),
  ...info,
});
```

The `Retry-After` header is an HTTP standard (RFC 7231) that tells the client how many seconds to wait before retrying. Our implementation sets it to the full window size (900 seconds for a 15-minute window). A smarter approach would be to calculate the actual time until the oldest request in the window expires.

The response body includes the same rate limit info for clients that prefer JSON over headers.

### Different Limits Per Endpoint

The global rate limiter in `backend/src/app.ts` applies to all routes:

```typescript
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyPrefix: "rl:global",
  })
);
```

But you can apply stricter or more lenient limits to specific routes:

```typescript
// Strict limit on login to prevent brute force
app.use(
  "/sessions/login",
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyPrefix: "rl:login",
  })
);

// Higher limit for read-only product endpoints
app.use(
  "/products",
  rateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: "rl:products",
  })
);

// Very strict limit on writes
app.use(
  "/products",
  rateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyPrefix: "rl:products:write",
    keyGenerator: (req) => (req.method === "PUT" ? req.ip || "unknown" : "skip"),
  })
);
```

The `keyPrefix` parameter ensures each limiter uses separate Redis keys. Without it, the product read limiter and the login limiter would share the same counter.

The `keyGenerator` function determines how clients are identified. The default uses `req.ip`, but you can use API keys, user IDs, or any other identifier:

```typescript
// Rate limit by API key instead of IP
rateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.headers["x-api-key"] as string || req.ip || "unknown",
})
```

### Fail-Open Design

Notice the catch block in the middleware:

```typescript
catch (err) {
  // If Redis is down, allow the request (fail open)
  console.error("Rate limiter error:", err);
  next();
}
```

If Redis is unavailable, the rate limiter allows all requests through. This is the "fail open" approach. The alternative, "fail closed," would reject all requests when Redis is down, which would make a Redis outage take down your entire API.

Fail open is the correct default for most applications. Rate limiting is a protective measure, not a core feature. Your API should continue functioning even if the rate limiter is temporarily unavailable. The risk is that during a Redis outage, clients are not rate limited, but that is better than a complete outage.

For security-critical rate limiting (like login attempt throttling), you might choose to fail closed instead. In that case, replace `next()` in the catch block with a 503 Service Unavailable response.

## Step by Step

### Step 1: Observe Rate Limit Headers

Make a request and inspect the headers:

```bash
curl -v http://localhost:3001/products 2>&1 | grep -i x-ratelimit
```

Expected output:

```
< X-RateLimit-Limit: 100
< X-RateLimit-Remaining: 99
< X-RateLimit-Reset: 1708301700
```

Make another request and watch the remaining count decrease:

```bash
curl -v http://localhost:3001/products 2>&1 | grep X-RateLimit-Remaining
# X-RateLimit-Remaining: 98
```

### Step 2: Trigger a 429 Response

For testing, apply a very strict rate limit. Temporarily modify the global limiter in `app.ts`:

```typescript
app.use(
  rateLimiter({
    windowMs: 60 * 1000,  // 1 minute window
    max: 5,               // only 5 requests
    keyPrefix: "rl:global",
  })
);
```

Then make 6 requests in quick succession:

```bash
for i in {1..6}; do
  echo "Request $i:"
  curl -s -o /dev/null -w "  HTTP %{http_code}\n" http://localhost:3001/products
done
```

The first 5 return HTTP 200. The 6th returns HTTP 429. Check the full 429 response:

```bash
curl -s http://localhost:3001/products | jq .
```

```json
{
  "error": "Too Many Requests",
  "retryAfter": 60,
  "limit": 5,
  "remaining": 0,
  "resetAt": 1708300060000
}
```

### Step 3: Inspect the Sorted Set in Redis

While the rate limiter is active, look at the underlying data:

```bash
docker compose exec redis redis-cli
```

```
KEYS rl:*
1) "rl:global:::1"

TYPE rl:global:::1
zset

ZCARD rl:global:::1
(integer) 5

ZRANGE rl:global:::1 0 -1 WITHSCORES
1) "1708300000123:0.456789"
2) "1708300000123"
3) "1708300000234:0.123456"
4) "1708300000234"
...
```

Each member is a request timestamp with a random suffix for uniqueness. Each score is the request timestamp. The sorted set naturally orders entries by time, making the sliding window removal efficient.

### Step 4: Test Per-Endpoint Limits

Add a strict login limiter before the session routes:

```typescript
app.use(
  "/sessions/login",
  rateLimiter({
    windowMs: 60 * 1000,
    max: 3,
    keyPrefix: "rl:login",
  })
);
```

Test it:

```bash
for i in {1..4}; do
  echo "Login attempt $i:"
  curl -s -o /dev/null -w "  HTTP %{http_code}\n" \
    -X POST http://localhost:3001/sessions/login \
    -H "Content-Type: application/json" \
    -d '{"username": "test"}'
done
```

The first 3 succeed (200), the 4th is rejected (429). Meanwhile, product endpoints still work fine because they use a different rate limiter key prefix.

### Step 5: Test Fail-Open Behavior

Stop Redis:

```bash
docker compose stop redis
```

Make a request:

```bash
curl -s http://localhost:3001/health
```

The request should succeed. The rate limiter logs an error but does not block the request. Check your server logs for the "Rate limiter error" message.

Start Redis again:

```bash
docker compose start redis
```

The rate limiter resumes normal operation. ioredis automatically reconnects.

## Exercise

1. Implement a rate limiter that uses a different key generator: rate limit by API key from the `X-API-Key` header. Create a middleware that applies a 1000 requests per hour limit for authenticated API keys and a 10 requests per minute limit for unauthenticated requests.

2. Modify the 429 response to include a more accurate `Retry-After` value. Instead of returning the full window duration, calculate when the oldest request in the current window will expire. Hint: use `ZRANGE key 0 0 WITHSCORES` to get the oldest entry's timestamp.

3. Add a rate limit bypass for health check endpoints. The `/health` route should not count against the rate limit. Implement this by adding the middleware only to specific route groups rather than globally.

4. Build a simple rate limit dashboard endpoint (`GET /rate-limit/stats`) that shows how many clients are currently being tracked, how many are near their limit, and how many are currently blocked. Use SCAN to find all `rl:*` keys and ZCARD to count entries in each.

5. Implement an exponential backoff Retry-After. On the first 429, suggest waiting 60 seconds. On subsequent 429s from the same client, suggest 120, 240, etc. Store the backoff multiplier in Redis alongside the rate limit data.

## Summary

Rate limiting protects your API from abuse and overload. Our implementation uses the sliding window log algorithm with Redis sorted sets, which provides precise per-client tracking without the boundary problems of fixed-window counters. The middleware in `backend/src/middleware/rate-limiter.ts` uses a Redis pipeline for atomicity and performance, sets standard rate limit headers on every response, and returns proper 429 responses with Retry-After headers when limits are exceeded. Different endpoints can have different limits through separate middleware instances with distinct key prefixes. The fail-open design ensures that a Redis outage does not cascade into an API outage. In the next lesson, you will use Redis for another stateful middleware pattern: session storage.
