# 07 — Session Store

HTTP is stateless. Every request is independent, with no memory of previous requests. Sessions bridge this gap by associating server-side state with a client through cookies. Storing session data in Redis gives you fast access, automatic expiration, and shared state across multiple server instances. This lesson covers the session middleware in `backend/src/middleware/session.ts`, the session routes in `backend/src/routes/sessions.ts`, cookie security settings, and the patterns for storing user data in sessions.

## What You'll Learn

- How server-side sessions work with cookies
- How to store and retrieve session data from Redis
- Cookie security settings: httpOnly, secure, sameSite
- Session lifecycle: creation, reading, updating, destruction
- Session data patterns for user authentication and shopping carts
- How session TTL and cookie maxAge work together
- Why Redis sessions are superior to in-memory or file-based sessions

## Key Concepts

### How Sessions Work

A session is a server-side data store associated with a specific client. The flow is:

1. Client makes a request with no session cookie.
2. Server creates a new session with a unique ID (UUID).
3. Server sends the session ID back to the client in a cookie.
4. Client includes the cookie in all subsequent requests.
5. Server reads the session ID from the cookie, looks up the session data in Redis, and attaches it to the request.
6. After the response is sent, the server saves any changes to the session back to Redis.

The session ID is the only thing stored on the client. All actual data (username, cart, preferences) lives in Redis. This is a security advantage: the client cannot tamper with session data because they never see it.

### The Session Middleware

Our session middleware in `backend/src/middleware/session.ts` handles the full lifecycle:

```typescript
import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { redis } from "../redis.js";
import type { SessionData } from "../types.js";

const SESSION_PREFIX = "session";
const SESSION_TTL = 3600; // 1 hour in seconds
const COOKIE_NAME = "sid";
```

The constants establish the contract: session keys in Redis are prefixed with `session:`, sessions expire after 1 hour, and the cookie is named `sid`.

The middleware function:

```typescript
export function sessionMiddleware() {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      let sessionId = req.cookies?.[COOKIE_NAME] as string | undefined;

      // Load existing session or create a new one
      if (sessionId) {
        const raw = await redis.get(`${SESSION_PREFIX}:${sessionId}`);
        if (raw) {
          req.session = JSON.parse(raw) as SessionData;
          req.sessionId = sessionId;
        } else {
          // Cookie exists but session expired — create new
          sessionId = undefined;
        }
      }

      if (!sessionId) {
        sessionId = uuidv4();
        req.sessionId = sessionId;
        req.session = {
          userId: "",
          username: "",
          cart: [],
          createdAt: new Date().toISOString(),
          lastAccess: new Date().toISOString(),
        };

        res.cookie(COOKIE_NAME, sessionId, {
          httpOnly: true,
          maxAge: SESSION_TTL * 1000,
          sameSite: "lax",
        });
      }

      // Update last access
      req.session!.lastAccess = new Date().toISOString();

      // Save session after response is sent
      res.on("finish", () => {
        if (req.sessionId && req.session) {
          redis
            .set(
              `${SESSION_PREFIX}:${req.sessionId}`,
              JSON.stringify(req.session),
              "EX",
              SESSION_TTL
            )
            .catch((err: Error) =>
              console.error("Failed to save session:", err.message)
            );
        }
      });

      next();
    } catch (err) {
      console.error("Session middleware error:", err);
      next();
    }
  };
}
```

Let us trace through each phase.

### Phase 1: Loading an Existing Session

When a request arrives with a `sid` cookie, the middleware looks up the session in Redis:

```typescript
let sessionId = req.cookies?.[COOKIE_NAME] as string | undefined;

if (sessionId) {
  const raw = await redis.get(`${SESSION_PREFIX}:${sessionId}`);
  if (raw) {
    req.session = JSON.parse(raw) as SessionData;
    req.sessionId = sessionId;
  } else {
    sessionId = undefined;
  }
}
```

`req.cookies` is populated by the `cookie-parser` middleware that is applied earlier in `backend/src/app.ts`:

```typescript
app.use(cookieParser());
```

If the session ID exists in Redis, the session data is parsed from JSON and attached to `req.session`. If the key does not exist (the session expired), `sessionId` is set to `undefined`, which triggers new session creation.

### Phase 2: Creating a New Session

If no valid session exists, a new one is created:

```typescript
if (!sessionId) {
  sessionId = uuidv4();
  req.sessionId = sessionId;
  req.session = {
    userId: "",
    username: "",
    cart: [],
    createdAt: new Date().toISOString(),
    lastAccess: new Date().toISOString(),
  };

  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    maxAge: SESSION_TTL * 1000,
    sameSite: "lax",
  });
}
```

`uuidv4()` generates a cryptographically random UUID like `"3b241101-e2bb-4d12-a1e6-3e2f15a54321"`. This is unpredictable enough that attackers cannot guess valid session IDs.

The `SessionData` type from `backend/src/types.ts` defines what a session contains:

```typescript
export interface SessionData {
  userId: string;
  username: string;
  cart: CartItem[];
  createdAt: string;
  lastAccess: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}
```

The session starts empty (no user, empty cart) and is populated by route handlers when the user logs in or adds items to their cart.

### Phase 3: Cookie Security

The cookie settings deserve careful attention:

```typescript
res.cookie(COOKIE_NAME, sessionId, {
  httpOnly: true,
  maxAge: SESSION_TTL * 1000,
  sameSite: "lax",
});
```

`httpOnly: true` prevents JavaScript from accessing the cookie via `document.cookie`. This is critical for security. Without it, a cross-site scripting (XSS) attack could steal session cookies. If malicious JavaScript runs on your page, it cannot read an httpOnly cookie.

`maxAge: SESSION_TTL * 1000` sets the cookie expiration in milliseconds (Express converts it). The cookie expires at the same time as the Redis session (1 hour). Note: the cookie maxAge is in milliseconds in Express, while the Redis TTL is in seconds.

`sameSite: "lax"` prevents the cookie from being sent on cross-site requests initiated by third-party websites, except for top-level navigations (clicking a link). This protects against CSRF (Cross-Site Request Forgery) attacks. The `"strict"` option is even more restrictive but can break legitimate navigation patterns.

In a production deployment with HTTPS, you should also add `secure: true`:

```typescript
res.cookie(COOKIE_NAME, sessionId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL * 1000,
  sameSite: "lax",
});
```

`secure: true` means the cookie is only sent over HTTPS connections. Without this, a man-in-the-middle attacker on an unencrypted connection could intercept the session cookie.

### Phase 4: Saving After Response

The session is saved back to Redis after the response is sent:

```typescript
res.on("finish", () => {
  if (req.sessionId && req.session) {
    redis
      .set(
        `${SESSION_PREFIX}:${req.sessionId}`,
        JSON.stringify(req.session),
        "EX",
        SESSION_TTL
      )
      .catch((err: Error) =>
        console.error("Failed to save session:", err.message)
      );
  }
});
```

The `res.on("finish")` event fires after the response has been fully sent to the client. This approach has two benefits:

1. The response is not delayed by the Redis write. The client gets their data while the session save happens in the background.
2. The session is saved with any modifications made by the route handler. When the login route sets `req.session.username`, that change is captured here.

The `.catch()` ensures that a failed Redis write does not crash the server. The session data might not persist if Redis is down, but the current request is not affected.

The `"EX", SESSION_TTL` argument refreshes the TTL on every request. This means active sessions stay alive as long as the user keeps making requests. A session only expires after 1 hour of inactivity.

### Session Destruction

The `destroySession` function in `backend/src/middleware/session.ts`:

```typescript
export async function destroySession(
  req: Request,
  res: Response
): Promise<void> {
  if (req.sessionId) {
    await redis.del(`${SESSION_PREFIX}:${req.sessionId}`);
    res.clearCookie(COOKIE_NAME);
  }
}
```

This does two things: delete the session data from Redis and clear the cookie from the client. Both are necessary. Deleting the Redis key without clearing the cookie would leave the client sending a session ID that no longer exists (which would trigger new session creation). Clearing the cookie without deleting the Redis key would leave orphaned data in Redis until the TTL expires.

The logout route in `backend/src/routes/sessions.ts` uses this:

```typescript
sessionsRouter.post("/logout", async (req, res) => {
  await destroySession(req, res);
  res.json({ message: "Logged out" });
});
```

### The Session Routes

The session routes in `backend/src/routes/sessions.ts` demonstrate common session patterns:

Login sets user information in the session:

```typescript
sessionsRouter.post("/login", (req, res) => {
  const { username } = req.body;

  if (!username) {
    res.status(400).json({ error: "username is required" });
    return;
  }

  req.session!.userId = `user_${Date.now()}`;
  req.session!.username = username;

  res.json({
    message: "Logged in",
    sessionId: req.sessionId,
    session: req.session,
  });
});
```

Profile checks if the user is logged in:

```typescript
sessionsRouter.get("/profile", (req, res) => {
  if (!req.session?.username) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  res.json({ session: req.session });
});
```

Cart management adds and removes items:

```typescript
sessionsRouter.post("/cart", (req, res) => {
  const { productId, quantity = 1 } = req.body as CartItem;

  if (!productId) {
    res.status(400).json({ error: "productId is required" });
    return;
  }

  const cart = req.session!.cart;
  const existing = cart.find((item) => item.productId === productId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }

  res.json({ cart: req.session!.cart });
});
```

Notice how all these route handlers simply modify `req.session` directly. The middleware handles loading from Redis before and saving to Redis after. The route handlers do not need to know about Redis at all.

### TypeScript Declaration Merging

The session middleware uses declaration merging to add `session` and `sessionId` to the Express Request type:

```typescript
declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      session?: SessionData;
    }
  }
}
```

This extends the Express Request interface globally. Without it, TypeScript would complain that `req.session` and `req.sessionId` do not exist on the Request type. The `?` makes them optional since they are only present on routes that use the session middleware.

### Why Redis for Sessions

In-memory sessions (stored in a JavaScript Map or object) have two problems: they are lost when the server restarts, and they do not work with multiple server instances. If you run 4 instances behind a load balancer, a user's session might be on instance 1, but their next request goes to instance 3.

File-based sessions solve the restart problem but not the multi-instance problem. They also add filesystem I/O latency.

Redis sessions solve both: data survives server restarts (if Redis persistence is configured), and all server instances connect to the same Redis instance. A Redis GET takes under 1ms, which is comparable to an in-memory lookup and far faster than a database query.

The session middleware only applies to the `/sessions` path, as configured in `backend/src/app.ts`:

```typescript
app.use("/sessions", sessionMiddleware());
```

This is deliberate. Not every endpoint needs session handling. The product endpoints are stateless and do not need the overhead of loading and saving session data on every request.

## Step by Step

### Step 1: Log In and Create a Session

Start the server and log in:

```bash
curl -s -c cookies.txt -b cookies.txt \
  -X POST http://localhost:3001/sessions/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice"}' | jq .
```

The `-c cookies.txt` flag saves cookies to a file, and `-b cookies.txt` sends them on subsequent requests. The response shows the session:

```json
{
  "message": "Logged in",
  "sessionId": "3b241101-e2bb-4d12-a1e6-3e2f15a54321",
  "session": {
    "userId": "user_1708300000000",
    "username": "alice",
    "cart": [],
    "createdAt": "2026-02-18T10:00:00.000Z",
    "lastAccess": "2026-02-18T10:00:00.000Z"
  }
}
```

### Step 2: Inspect the Session in Redis

```bash
docker compose exec redis redis-cli
```

```
KEYS session:*
1) "session:3b241101-e2bb-4d12-a1e6-3e2f15a54321"

GET session:3b241101-e2bb-4d12-a1e6-3e2f15a54321
"{\"userId\":\"user_1708300000000\",\"username\":\"alice\",\"cart\":[],\"createdAt\":\"2026-02-18T10:00:00.000Z\",\"lastAccess\":\"2026-02-18T10:00:00.000Z\"}"

TTL session:3b241101-e2bb-4d12-a1e6-3e2f15a54321
(integer) 3598
```

The session data is stored as a JSON string with a 1-hour TTL.

### Step 3: View Your Profile

```bash
curl -s -b cookies.txt http://localhost:3001/sessions/profile | jq .
```

This works because the cookie file includes the `sid` cookie from the login response. Without cookies:

```bash
curl -s http://localhost:3001/sessions/profile | jq .
```

Returns `{"error": "Not logged in"}` because there is no session cookie.

### Step 4: Add Items to Cart

```bash
curl -s -b cookies.txt -c cookies.txt \
  -X POST http://localhost:3001/sessions/cart \
  -H "Content-Type: application/json" \
  -d '{"productId": "1", "quantity": 2}' | jq .
```

```json
{
  "cart": [{ "productId": "1", "quantity": 2 }]
}
```

Add another item:

```bash
curl -s -b cookies.txt -c cookies.txt \
  -X POST http://localhost:3001/sessions/cart \
  -H "Content-Type: application/json" \
  -d '{"productId": "3"}' | jq .
```

```json
{
  "cart": [
    { "productId": "1", "quantity": 2 },
    { "productId": "3", "quantity": 1 }
  ]
}
```

Add more of product 1 (the existing entry is updated):

```bash
curl -s -b cookies.txt -c cookies.txt \
  -X POST http://localhost:3001/sessions/cart \
  -H "Content-Type: application/json" \
  -d '{"productId": "1", "quantity": 1}' | jq .
```

```json
{
  "cart": [
    { "productId": "1", "quantity": 3 },
    { "productId": "3", "quantity": 1 }
  ]
}
```

### Step 5: Remove an Item

```bash
curl -s -b cookies.txt -c cookies.txt \
  -X DELETE http://localhost:3001/sessions/cart/3 | jq .
```

```json
{
  "cart": [{ "productId": "1", "quantity": 3 }]
}
```

### Step 6: Log Out

```bash
curl -s -b cookies.txt -c cookies.txt \
  -X POST http://localhost:3001/sessions/logout | jq .
```

```json
{ "message": "Logged out" }
```

Verify the session is gone from Redis:

```bash
docker compose exec redis redis-cli KEYS "session:*"
# (empty array)
```

And the profile endpoint returns 401:

```bash
curl -s -b cookies.txt http://localhost:3001/sessions/profile | jq .
# {"error": "Not logged in"}
```

## Exercise

1. Add a `secure: true` flag to the cookie options when `NODE_ENV` is "production". Test that the cookie is not sent over HTTP by running the server with `NODE_ENV=production` and making requests to `http://` (not `https://`).

2. Implement session touch-on-read. Currently the TTL is refreshed on every request. Modify the middleware to only refresh the TTL if more than half the TTL has elapsed. This reduces Redis writes for very active sessions.

3. Add a session listing endpoint for administrators. Create `GET /sessions/admin/active` that uses SCAN to find all `session:*` keys, reads each one, and returns a summary (session ID, username, cart item count, last access time). Consider the performance implications.

4. Implement session data size limits. Before saving the session, check if the serialized JSON exceeds 1MB. If it does, log a warning and consider trimming the cart.

5. Create a "remember me" feature. When the user logs in with `{"username": "alice", "rememberMe": true}`, set a longer cookie maxAge (30 days) and a longer Redis TTL. When `rememberMe` is false, use the default 1-hour TTL and do not set a cookie maxAge (making it a session cookie that expires when the browser closes).

## Summary

Sessions give stateless HTTP the ability to remember users across requests. Our implementation in `backend/src/middleware/session.ts` stores session data as JSON in Redis, keyed by a UUID that is sent to the client in an httpOnly cookie. The middleware loads the session before the route handler runs and saves it after the response is sent, so route handlers simply read and write `req.session` without worrying about persistence. Cookie security flags (httpOnly, sameSite, and secure in production) protect against XSS and CSRF attacks. The session routes in `backend/src/routes/sessions.ts` demonstrate the login, profile, cart, and logout patterns that most web applications need. Redis is the ideal session store because it is fast, supports automatic expiration via TTL, and shares state across multiple server instances.
