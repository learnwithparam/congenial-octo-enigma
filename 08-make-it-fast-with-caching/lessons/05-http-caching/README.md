# 05 — HTTP Caching

Application-level caching with Redis handles the server side, but there is an entire caching layer that sits between the server and the client: HTTP caching. Browsers, proxies, and CDNs all understand Cache-Control headers and ETags. When configured correctly, HTTP caching can eliminate requests entirely. The client never even contacts your server. This lesson covers the Cache-Control directives, ETag-based conditional requests, and how our middleware in `backend/src/middleware/http-cache.ts` implements both.

## What You'll Learn

- The Cache-Control header and its key directives: max-age, s-maxage, no-cache, no-store
- How public vs private caching affects shared caches and CDNs
- What stale-while-revalidate does and when to use it
- How ETags and conditional requests (If-None-Match) save bandwidth with 304 responses
- How to combine Redis caching with HTTP caching for maximum performance

## Key Concepts

### The HTTP Cache Hierarchy

When a browser makes a request, the response can be cached at multiple layers:

Browser cache: the local cache in the user's browser. Controlled by Cache-Control headers. If the browser has a fresh cached copy, it never sends a request at all.

CDN / reverse proxy cache: services like Cloudflare, Fastly, or Nginx sit between the browser and your origin server. They cache responses and serve them to many users. Controlled by `s-maxage` and `public` directives.

Application cache: the Redis cache we built in previous lessons. This is the last line of defense before the database.

HTTP caching is the outermost layer. It can prevent requests from reaching your server entirely, which is the cheapest possible "response" since no server resources are consumed.

### Cache-Control Header

The Cache-Control header tells browsers and intermediary caches how to handle a response. It is a comma-separated list of directives.

Our middleware in `backend/src/middleware/http-cache.ts` builds this header:

```typescript
interface HttpCacheOptions {
  maxAge?: number;           // seconds
  sMaxAge?: number;          // shared cache (CDN) max-age
  staleWhileRevalidate?: number;
  isPrivate?: boolean;
}

export function httpCache(options: HttpCacheOptions = {}) {
  const {
    maxAge = 0,
    sMaxAge,
    staleWhileRevalidate,
    isPrivate = false,
  } = options;

  return (_req: Request, res: Response, next: NextFunction): void => {
    const directives: string[] = [];

    directives.push(isPrivate ? "private" : "public");
    directives.push(`max-age=${maxAge}`);

    if (sMaxAge !== undefined) {
      directives.push(`s-maxage=${sMaxAge}`);
    }
    if (staleWhileRevalidate !== undefined) {
      directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }

    res.set("Cache-Control", directives.join(", "));
    next();
  };
}
```

Let us break down each directive.

`public` means the response can be cached by any cache, including shared caches like CDNs. Use this for content that is the same for all users: product listings, static pages, public API responses.

`private` means the response can only be cached by the browser, not by shared caches. Use this for user-specific content: account pages, shopping carts, personalized recommendations.

`max-age=N` tells the browser to consider the cached response fresh for N seconds. During this time, the browser will not make a request to the server at all. After N seconds, the cache is "stale" and the browser will revalidate.

`s-maxage=N` overrides `max-age` for shared caches (CDNs). You might set `max-age=30` (browser caches for 30 seconds) and `s-maxage=300` (CDN caches for 5 minutes). This lets the CDN absorb most traffic while browsers still check relatively frequently.

`stale-while-revalidate=N` tells the cache to serve a stale response while fetching a fresh one in the background. If a cached response is stale but within the stale-while-revalidate window, the client gets the stale response immediately (fast) and the cache updates itself for the next request.

`no-cache` does not mean "do not cache." It means "cache it, but always revalidate before using it." The browser stores the response but checks with the server (using ETags) before serving it from cache.

`no-store` means "do not cache this at all." The response is not stored anywhere. Use this for sensitive data like authentication tokens, credit card details, or any data that must never be served from cache.

### How Our Routes Use Cache-Control

In `backend/src/routes/products.ts`, the product routes apply HTTP caching with specific settings:

```typescript
// Product list: browser caches 30s, revalidate within 60s after stale
productsRouter.get(
  "/",
  httpCache({ maxAge: 30, staleWhileRevalidate: 60 }),
  etag(),
  async (_req, res) => { ... }
);

// Category list: same settings as the full list
productsRouter.get(
  "/category/:category",
  httpCache({ maxAge: 30, staleWhileRevalidate: 60 }),
  etag(),
  async (req, res) => { ... }
);

// Single product: longer cache, longer revalidate window
productsRouter.get(
  "/:id",
  httpCache({ maxAge: 60, staleWhileRevalidate: 120 }),
  etag(),
  async (req, res) => { ... }
);
```

The product list gets a shorter `maxAge` of 30 seconds because it is an aggregate view that changes whenever any product is updated. Individual products get 60 seconds because they change less often.

The `staleWhileRevalidate` values are generous. For the product list, even if the cache is up to 60 seconds stale, the browser can still serve the old version while refreshing in the background. This means users almost never see a loading spinner for repeat visits.

Notice that the PUT route for updating products does not have HTTP cache middleware. Write operations should never be cached.

### ETags and Conditional Requests

ETags (Entity Tags) are a fingerprint of the response body. When the server sends a response with an ETag header, the browser stores it. On subsequent requests, the browser sends the ETag back in an `If-None-Match` header. If the data has not changed, the server returns 304 Not Modified with no body, saving bandwidth.

Our ETag middleware in `backend/src/middleware/http-cache.ts`:

```typescript
export function etag() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
      const bodyStr = JSON.stringify(body);
      const hash = createHash("md5").update(bodyStr).digest("hex");
      const etagValue = `"${hash}"`;

      res.set("ETag", etagValue);

      const ifNoneMatch = _req.headers["if-none-match"];
      if (ifNoneMatch === etagValue) {
        res.status(304).end();
        return res;
      }

      return originalJson(body);
    };

    next();
  };
}
```

Here is how it works step by step:

1. The middleware wraps `res.json` with a custom function.
2. When the route handler calls `res.json(body)`, the wrapper serializes the body to a string.
3. It computes an MD5 hash of the string and formats it as an ETag value (quoted string).
4. It sets the `ETag` header on the response.
5. It checks if the request included an `If-None-Match` header with the same ETag value.
6. If the ETags match, the data has not changed since the client last received it. The server responds with 304 Not Modified and no body.
7. If the ETags do not match (or there is no `If-None-Match` header), the full response is sent.

The 304 response is significantly cheaper than a full response:

- No response body is sent, saving bandwidth.
- The browser uses its cached copy of the data.
- The server still computes the response (the ETag hash is generated from the full body), but the network transfer is minimal.

Note that our implementation computes the MD5 hash from the serialized JSON. This means the server still does the full work of fetching data and serializing it. The savings are purely in network bandwidth, not in server-side computation. For true server-side savings, you would compute the ETag from the data's `updatedAt` timestamp or a version number without serializing the full body.

### The Caching Stack in Action

When all layers work together, a request to `GET /products` goes through this sequence:

First request (nothing cached anywhere):
1. Browser has no cache. Sends request.
2. CDN has no cache. Forwards to origin.
3. Redis has no cache. `cacheAside` fetches from database (200ms).
4. Response sent with `Cache-Control: public, max-age=30, stale-while-revalidate=60` and an ETag.
5. CDN caches the response. Browser caches the response.

Second request (within 30 seconds):
1. Browser has a fresh cache. Serves immediately from local cache.
2. No network request at all. Latency: 0ms.

Third request (after 30 seconds, within 90 seconds):
1. Browser cache is stale but within stale-while-revalidate window.
2. Browser serves the stale response immediately.
3. Browser sends a background request with `If-None-Match` to revalidate.
4. If data has not changed, server returns 304. Browser updates its freshness timer.
5. If data has changed, server returns 200 with new data and new ETag.

Request after CDN cache expires:
1. CDN cache is stale. CDN forwards to origin.
2. Redis still has the data (Redis TTL is 60s, longer than CDN TTL).
3. Redis cache hit. Response in 1-2ms.
4. CDN caches the new response.

This layered approach means that under normal traffic, most requests never reach your server, some reach the server but not Redis, some reach Redis but not the database, and only a few reach the database.

### When Not to Cache at the HTTP Level

Not every response should have Cache-Control headers:

Write operations (POST, PUT, DELETE) should never be cached. Our product update route does not use the `httpCache` middleware.

User-specific data needs `private` to prevent CDNs from caching it. A shared CDN should never cache one user's profile and serve it to another.

Frequently changing data where staleness is unacceptable should use `no-cache` with ETags, so every request validates but bandwidth is saved when data has not changed.

Authentication responses should use `no-store` to prevent any caching of tokens or credentials.

## Step by Step

### Step 1: Observe Cache-Control Headers

Make a request and inspect the headers:

```bash
curl -v http://localhost:3001/products 2>&1 | grep -i cache-control
```

Expected output:

```
< Cache-Control: public, max-age=30, stale-while-revalidate=60
```

Compare with the single product endpoint:

```bash
curl -v http://localhost:3001/products/1 2>&1 | grep -i cache-control
```

Expected output:

```
< Cache-Control: public, max-age=60, stale-while-revalidate=120
```

### Step 2: Test ETag Behavior

Make a request and capture the ETag:

```bash
curl -s -D - http://localhost:3001/products 2>&1 | grep -i etag
```

Expected output (the hash will vary):

```
ETag: "a1b2c3d4e5f6..."
```

Now send a conditional request with the ETag:

```bash
curl -v -H 'If-None-Match: "a1b2c3d4e5f6..."' http://localhost:3001/products
```

If the data has not changed, you get a 304 with no body:

```
< HTTP/1.1 304 Not Modified
< ETag: "a1b2c3d4e5f6..."
```

Update a product, then try the same ETag:

```bash
curl -s -X PUT http://localhost:3001/products/1 \
  -H "Content-Type: application/json" \
  -d '{"price": 139.99}'

curl -v -H 'If-None-Match: "a1b2c3d4e5f6..."' http://localhost:3001/products
```

This time you get a 200 with the full body and a new ETag, because the data changed and the old ETag no longer matches.

### Step 3: Test no-cache and no-store

Modify the middleware temporarily to test different directives. Create a test route:

```typescript
app.get("/private-data", httpCache({ isPrivate: true, maxAge: 0 }), (_req, res) => {
  res.json({ secret: "user-specific data" });
});
```

The response header will be:

```
Cache-Control: private, max-age=0
```

This tells CDNs not to cache it and tells the browser to revalidate on every request.

### Step 4: Verify Browser Caching

Open your browser's developer tools (Network tab). Navigate to `http://localhost:3001/products`. Notice the response size and time.

Click refresh (not hard refresh). If the `max-age` has not expired, you should see "(from disk cache)" or "(from memory cache)" in the Size column, with a 0ms response time.

Do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R). The browser sends the request with `Cache-Control: no-cache`, bypassing the local cache but still sending `If-None-Match` for ETag validation.

### Step 5: Combine Redis and HTTP Caching

Observe both caching layers working together. First, flush the Redis cache:

```bash
docker compose exec redis redis-cli FLUSHDB
```

Make a request:

```bash
curl -s -D - http://localhost:3001/products | grep -E "X-Cache|Cache-Control|ETag"
```

You should see `X-Cache: MISS` (Redis miss), along with Cache-Control and ETag headers. The Redis cache is now populated.

Make the same request:

```bash
curl -s -D - http://localhost:3001/products | grep -E "X-Cache|Cache-Control|ETag"
```

Now `X-Cache: HIT` (Redis hit). The browser also received Cache-Control headers, so a real browser would not even make this second request during the max-age window.

## Exercise

1. Add a `no-store` variant to the httpCache middleware. Create a route that serves sensitive data with `Cache-Control: no-store`. Verify using browser dev tools that the response is never cached.

2. Implement `s-maxage` in a test route. Set `max-age=10` and `s-maxage=300`. Explain in comments what this means: browsers cache for 10 seconds, but a CDN would cache for 5 minutes.

3. Modify the ETag middleware to use a cheaper ETag generation method. Instead of hashing the entire response body, use a combination of the data's `updatedAt` field and a version counter. This avoids serializing the body twice (once for ETag, once for the response).

4. Create a `cache-busting` utility. When the server starts, generate a build version string. Append it to static asset URLs so browsers fetch new versions after deploys. This is a common alternative to short max-age values for assets that change infrequently.

## Summary

HTTP caching sits at the outermost layer of your performance stack. Cache-Control headers tell browsers and CDNs how long to hold onto responses, eliminating requests entirely during the freshness window. ETags enable conditional requests that save bandwidth when data has not changed, returning a lightweight 304 instead of the full response body. Our middleware in `backend/src/middleware/http-cache.ts` builds Cache-Control headers from a clean options object and computes ETags by hashing the response body. Combined with the Redis cache-aside pattern from previous lessons, you now have three caching layers: browser/CDN (HTTP), application (Redis), and the origin database. Each layer catches requests that slip through the one above it, and together they can reduce origin load by orders of magnitude.
