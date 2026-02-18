# 05 — The API Gateway

The API gateway is the front door of your microservices architecture. Every client request enters through the gateway, which routes it to the correct downstream service. The client sees a single URL, a single port, a single hostname. Behind the gateway, requests fan out to auth-service, notification-service, and whatever other services you add in the future. This lesson covers the gateway implementation using http-proxy-middleware, routing rules, correlation ID forwarding, error handling, and request/response transformation.

## What You'll Learn

- Why an API gateway exists and what problems it solves
- How HTTP proxying works with http-proxy-middleware in Express
- How to configure routing rules that map URL paths to backend services
- How correlation IDs are generated and forwarded across service boundaries
- How to handle proxy errors gracefully and return meaningful error responses
- The gateway's role in request/response transformation

## Key Concepts

### Why an API Gateway

Without a gateway, clients need to know the address of every service. Your frontend would call http://auth-service:3001/auth/login for login and http://notification-service:3002/notifications/send for notifications. This creates several problems:

- Clients must be reconfigured when service addresses change
- CORS configuration becomes complex (multiple origins)
- Cross-cutting concerns (logging, rate limiting, authentication) must be duplicated in every service
- Service discovery becomes the client's problem

The gateway solves all of these. Clients call http://gateway:3000/auth/login and http://gateway:3000/notifications/send. The gateway handles routing internally. If you move auth-service to a different host, you update the gateway configuration and clients never know.

### The Gateway Entry Point

The gateway is an Express application that does not contain business logic. Its job is routing and cross-cutting concerns:

```ts
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createLogger } from "../../shared/logger.js";
import { createHealthRouter } from "../../shared/health.js";
import { correlationId } from "../../shared/middleware/correlation-id.js";
import { requestLogger } from "../../shared/middleware/request-logger.js";
import { errorHandler } from "../../shared/middleware/error-handler.js";
import type { ServiceConfig, ServiceRoute } from "../../shared/types.js";

const logger = createLogger("gateway");

const config: ServiceConfig = {
  name: "gateway",
  port: parseInt(process.env.PORT || "3000", 10),
  version: "1.0.0",
};
```

The gateway imports from the shared library just like the other services. It uses the same logging, health check, and middleware infrastructure. The port defaults to 3000, which is the public-facing port that clients connect to.

### Service Discovery via Configuration

The gateway needs to know where each backend service lives. In our implementation, this is done through environment variables:

```ts
const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3001";
const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3002";
```

For local development, the services run on localhost with different ports. In Docker, the compose file sets these to the internal Docker network hostnames:

```yaml
# From docker-compose.yml
gateway:
  environment:
    - AUTH_SERVICE_URL=http://auth:3001
    - NOTIFICATION_SERVICE_URL=http://notifications:3002
```

In a production Kubernetes environment, these would be Kubernetes service DNS names like http://auth-service.default.svc.cluster.local:3001.

The routing table maps URL path prefixes to target service URLs:

```ts
const routes: ServiceRoute[] = [
  { path: "/auth", target: AUTH_SERVICE_URL, name: "auth-service" },
  {
    path: "/notifications",
    target: NOTIFICATION_SERVICE_URL,
    name: "notification-service",
  },
];
```

The ServiceRoute type from shared/types.ts defines this contract:

```ts
export interface ServiceRoute {
  path: string;
  target: string;
  name: string;
}
```

Each route has a path prefix that the gateway matches against incoming requests, a target URL where requests are forwarded, and a name used for logging and error messages.

### Global Middleware

The gateway applies middleware before routing:

```ts
const app = express();

// --- Global middleware ---
app.use(correlationId);
app.use(requestLogger(logger));

// --- Gateway health check (no Redis dependency) ---
app.use(createHealthRouter(config));
```

The correlation ID middleware runs first. It either extracts an existing ID from the x-correlation-id header or generates a new UUID. This means every request that enters the gateway gets a correlation ID, even if the client did not provide one. This ID is then forwarded to all downstream services.

The health check router is registered without any dependencies (no Redis). The gateway itself is stateless, so its health depends only on whether the process is running and can accept connections.

### HTTP Proxy Configuration

The core of the gateway is the proxy middleware, configured in a loop over the routes:

```ts
for (const route of routes) {
  logger.info(
    { path: route.path, target: route.target },
    "Registering proxy route"
  );

  app.use(
    route.path,
    createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq, req) => {
          // Forward correlation ID to downstream services
          const corrId = (req as express.Request).correlationId;
          if (corrId) {
            proxyReq.setHeader("x-correlation-id", corrId);
          }
          proxyReq.setHeader("x-forwarded-by", "gateway");
        },
        error: (err, _req, res) => {
          logger.error(
            { err: err.message, target: route.target },
            "Proxy error"
          );
          if ("writeHead" in res && typeof res.writeHead === "function") {
            (res as import("http").ServerResponse)
              .writeHead(502, { "Content-Type": "application/json" })
              .end(
                JSON.stringify({
                  error: `Service ${route.name} unavailable`,
                  service: route.name,
                })
              );
          }
        },
      },
    })
  );
}
```

Let us break down each configuration option.

The target is the base URL of the downstream service. When the gateway receives GET /auth/verify, it forwards to http://localhost:3001/auth/verify (the path is preserved).

The changeOrigin option rewrites the Host header of the proxied request to match the target. Without this, the downstream service would see the gateway's hostname in the Host header, which can cause issues with virtual hosting.

The proxyReq event handler fires before the request is sent to the downstream service. This is where request transformation happens. The gateway adds two headers:

- x-correlation-id: the correlation ID generated or extracted by the gateway's middleware. This is how the request is tracked across service boundaries.
- x-forwarded-by: a static header indicating the request came through the gateway. Downstream services can use this to distinguish direct calls from proxied calls.

The error event handler fires when the proxy cannot reach the downstream service (connection refused, timeout, DNS failure). It returns HTTP 502 Bad Gateway with a JSON body identifying which service is unavailable. This is critical for debugging: when a client sees a 502, the error body tells them whether auth-service or notification-service is down.

### Handling 404s

After all proxy routes are registered, a catch-all handler returns 404 for unmatched paths:

```ts
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});
```

Any request that does not start with /auth or /notifications gets a clean 404 response. This prevents leaking information about the gateway's internals.

### Error Handling

The shared error handler middleware catches any uncaught errors in the gateway:

```ts
app.use(errorHandler(logger));
```

From shared/middleware/error-handler.ts:

```ts
export function errorHandler(logger: Logger) {
  return (
    err: AppError,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    const statusCode = err.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal Server Error" : err.message;

    logger.error(
      {
        err: { message: err.message, stack: err.stack, code: err.code },
        method: req.method,
        url: req.originalUrl,
        correlationId: req.correlationId,
      },
      "Unhandled error"
    );

    res.status(statusCode).json({
      error: message,
      correlationId: req.correlationId,
    });
  };
}
```

The error handler logs the full error with stack trace for debugging but only sends a generic "Internal Server Error" message to the client for 500 errors. This prevents exposing internal implementation details. The correlation ID is included in the response so clients can reference it in bug reports.

### Graceful Shutdown

The gateway handles shutdown signals like the other services:

```ts
function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gateway");
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

The gateway's shutdown is simpler than the notification service because it has no background workers or queue connections to close. It just stops accepting new connections and waits for active requests to complete.

### Request Flow Through the Gateway

Here is the complete flow when a client calls POST /auth/login:

1. The request hits the gateway on port 3000
2. The correlationId middleware generates a UUID (e.g., "abc-123") and attaches it to the request
3. The requestLogger middleware starts timing the request
4. Express matches the /auth prefix and delegates to the proxy middleware
5. The proxyReq handler adds x-correlation-id: abc-123 and x-forwarded-by: gateway headers
6. The request is forwarded to http://localhost:3001/auth/login
7. auth-service processes the login and returns a response
8. The proxy sends the response back to the client
9. The requestLogger middleware logs the completed request with duration and status code

If auth-service is down at step 6, the error handler catches the connection failure, logs it, and returns HTTP 502 with { error: "Service auth-service unavailable", service: "auth-service" }.

## Step by Step

### Step 1: Define Your Routes

Start with a list of path-to-service mappings. Each entry defines a URL prefix and the backend URL it maps to.

### Step 2: Set Up Global Middleware

Apply correlation ID generation and request logging before any route handlers. These must run on every request, including health checks.

### Step 3: Register Proxy Routes

Loop over your routes and create a proxy middleware for each one. Configure the proxyReq handler to forward correlation IDs.

### Step 4: Handle Errors

Configure the error handler on the proxy for connection failures (502), add a 404 catch-all for unmatched routes, and register the shared error handler for uncaught exceptions.

### Step 5: Add Health Check

Register the gateway's health endpoint. Unlike the other services, the gateway does not depend on Redis, so its health check has no dependencies.

### Step 6: Test Each Route

Start all three services locally. Send requests through the gateway and verify they reach the correct backend. Check the response headers for x-correlation-id.

## Exercise

Extend the gateway with the following features:

1. Add a rate limiting middleware. Before the proxy routes, add a simple in-memory rate limiter that allows at most 100 requests per minute per IP address. Return HTTP 429 Too Many Requests when the limit is exceeded.

2. Add an /api/services endpoint that returns the list of registered routes and their targets. This gives operators a quick way to see the gateway's configuration.

3. Add response time headers. In the proxyReq handler, record the start time. In a proxyRes handler, calculate the duration and add an x-response-time header to the response.

4. Add a circuit breaker. If a downstream service returns 5 consecutive 502 errors, stop proxying to it for 30 seconds. Return 503 Service Temporarily Unavailable during the cooldown period.

5. Add an aggregated health endpoint at /health/all that calls /health on each downstream service and returns a combined report.

## Summary

The API gateway is the single entry point for all client traffic. It does not contain business logic. Its responsibilities are routing (mapping URL paths to backend services), request transformation (adding correlation IDs and forwarding headers), error handling (returning meaningful 502 errors when services are down), and cross-cutting concerns (logging, rate limiting, authentication).

The http-proxy-middleware library handles the heavy lifting of HTTP proxying, including connection pooling, header forwarding, and error propagation. The gateway's configuration is a simple list of routes, making it easy to add new services as the architecture grows.

In the next lesson, we explore how services communicate with each other beyond the gateway, including direct HTTP calls between services and asynchronous messaging through Redis and BullMQ.
