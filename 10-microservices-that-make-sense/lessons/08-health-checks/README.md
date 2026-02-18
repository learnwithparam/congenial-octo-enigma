# 08 — Health Checks

In a monolith, "is the application running?" is a simple question: if the process is alive, the app is up. In a microservices architecture, the question becomes: "is the auth-service running? Can it reach Redis? Is the notification-service processing jobs? Is the gateway able to proxy to all downstream services?" Health checks answer these questions with a standardized, machine-readable API that orchestrators (Docker, Kubernetes), load balancers, and monitoring tools can query automatically.

This lesson covers the health check pattern in our LaunchPad project, the difference between readiness and liveness probes, how to aggregate health across services in the gateway, and how to configure Docker to use health checks.

## What You'll Learn

- The anatomy of a /health endpoint and the information it should expose
- How to check dependency health (Redis, databases, downstream services)
- The difference between readiness probes (can this service handle traffic?) and liveness probes (is this service stuck?)
- How to build aggregated health checks in the gateway
- How to configure Docker healthcheck directives in your containers

## Key Concepts

### The Health Endpoint Pattern

Every service in our project exposes a GET /health endpoint. The shared/health.ts module provides a factory function that creates this endpoint:

```ts
export function createHealthRouter(
  config: ServiceConfig,
  dependencies: HealthDependency[] = []
): Router {
  const router = Router();
  const startTime = Date.now();

  router.get("/health", async (_req, res) => {
    const checks: Record<string, HealthCheck> = {};

    for (const dep of dependencies) {
      try {
        checks[dep.name] = await dep.check();
      } catch (err) {
        checks[dep.name] = {
          status: "fail",
          message: err instanceof Error ? err.message : "Check failed",
        };
      }
    }

    const allPass = Object.values(checks).every((c) => c.status === "pass");
    const anyFail = Object.values(checks).some((c) => c.status === "fail");

    let status: HealthStatus["status"] = "healthy";
    if (anyFail) status = "unhealthy";
    else if (!allPass && dependencies.length > 0) status = "degraded";

    const healthStatus: HealthStatus = {
      status,
      service: config.name,
      version: config.version,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks,
    };

    const httpStatus = status === "healthy" ? 200 : 503;
    res.status(httpStatus).json(healthStatus);
  });

  return router;
}
```

Let us examine each piece of this implementation.

The function accepts a ServiceConfig (service name, port, version) and an optional array of HealthDependency objects. Each dependency has a name and a check function that returns a Promise of HealthCheck.

The startTime is captured when the router is created (at service startup). The uptime calculation in each health response shows how many seconds the service has been running. This is useful for detecting restarts: if a service's uptime is always low, it is probably crash-looping.

For each dependency, the health endpoint runs the check function and records the result. If the check throws an exception, it is caught and recorded as a failure with the error message. This means a single failing dependency does not crash the health endpoint itself.

The overall status uses three levels:

- "healthy" means all dependency checks pass (or there are no dependencies)
- "degraded" means at least one check has not passed but none have explicitly failed
- "unhealthy" means at least one check has explicitly failed

The HTTP status code is 200 for healthy and 503 for unhealthy or degraded. This is important because load balancers and orchestrators typically check the HTTP status code, not the response body. A 503 tells the load balancer to stop sending traffic to this instance.

### The HealthStatus Response Shape

The TypeScript interfaces in shared/types.ts define the health response:

```ts
export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  checks: Record<string, HealthCheck>;
}

export interface HealthCheck {
  status: "pass" | "fail";
  responseTime?: number;
  message?: string;
}
```

A typical healthy response from the auth-service looks like:

```json
{
  "status": "healthy",
  "service": "auth-service",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "checks": {
    "redis": {
      "status": "pass",
      "responseTime": 2
    }
  }
}
```

A response when Redis is down:

```json
{
  "status": "unhealthy",
  "service": "auth-service",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "checks": {
    "redis": {
      "status": "fail",
      "responseTime": 3001,
      "message": "Connection refused"
    }
  }
}
```

The version field lets you verify which version of the service is running. After a deployment, if the health endpoint still shows the old version, the deployment did not take effect.

### Redis Health Check

The most common dependency check in our project is Redis. The shared/health.ts module provides a Redis check factory:

```ts
export function redisHealthCheck(redis: Redis): () => Promise<HealthCheck> {
  return async () => {
    const start = Date.now();
    try {
      const result = await redis.ping();
      return {
        status: result === "PONG" ? "pass" : "fail",
        responseTime: Date.now() - start,
      };
    } catch (err) {
      return {
        status: "fail",
        responseTime: Date.now() - start,
        message: err instanceof Error ? err.message : "Redis ping failed",
      };
    }
  };
}
```

The check sends a PING command to Redis and expects PONG in response. It records the round-trip time in milliseconds. If Redis is slow (responseTime is high), it is a warning sign even if the check passes. If Redis is unreachable, the catch block records the failure with the error message.

The auth-service and notification-service both register this check:

```ts
// auth-service
const redis = getRedis();
app.use(
  createHealthRouter(config, [
    { name: "redis", check: redisHealthCheck(redis) },
  ])
);

// notification-service
const redis = getRedis();
app.use(
  createHealthRouter(config, [
    { name: "redis", check: redisHealthCheck(redis) },
  ])
);
```

The gateway does not check Redis because it does not use Redis. Its health check has no dependencies:

```ts
// gateway
app.use(createHealthRouter(config));
```

### Readiness vs Liveness

In container orchestration (particularly Kubernetes), there are two types of health probes with different purposes.

A liveness probe answers: "Is this process stuck?" If the liveness probe fails, the orchestrator kills the container and starts a new one. A liveness probe should check only whether the process can respond to requests. It should not check dependencies. If Redis is down, the auth-service process itself is fine; killing it will not fix Redis.

A readiness probe answers: "Can this service handle traffic?" If the readiness probe fails, the orchestrator removes the instance from the load balancer but does not kill it. When the probe passes again, traffic is restored. A readiness probe should check dependencies. If Redis is down, the auth-service cannot verify tokens, so it should not receive traffic.

Our single /health endpoint serves as a readiness probe because it checks dependencies and returns 503 when they fail. For a separate liveness probe, you would add a /health/live endpoint that always returns 200 if the process is running:

```ts
// Example: adding a separate liveness probe
router.get("/health/live", (_req, res) => {
  res.status(200).json({ status: "alive" });
});
```

In Kubernetes, you would configure both:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Aggregated Health in the Gateway

The gateway is the ideal place to provide a unified health view across all services. While our current implementation only checks the gateway itself, an aggregated health endpoint would call /health on each downstream service:

```ts
// Example: aggregated health check in the gateway
router.get("/health/all", async (_req, res) => {
  const serviceChecks = await Promise.allSettled(
    routes.map(async (route) => {
      const start = Date.now();
      try {
        const response = await fetch(`${route.target}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        const data = await response.json();
        return {
          name: route.name,
          status: data.status,
          responseTime: Date.now() - start,
          details: data,
        };
      } catch (err) {
        return {
          name: route.name,
          status: "unreachable",
          responseTime: Date.now() - start,
          message: err instanceof Error ? err.message : "Failed to reach service",
        };
      }
    })
  );

  const results = serviceChecks.map((result) =>
    result.status === "fulfilled" ? result.value : result.reason
  );

  const allHealthy = results.every((r) => r.status === "healthy");

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "healthy" : "degraded",
    services: results,
  });
});
```

This endpoint uses Promise.allSettled (not Promise.all) because you want results from all services even if some are unreachable. A timeout of 3 seconds prevents a hung service from blocking the entire aggregated check.

### Docker Healthcheck

Each service's Dockerfile can include a HEALTHCHECK directive that tells Docker to periodically test the container's health:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY shared/ ./shared/
COPY auth-service/ ./auth-service/
COPY tsconfig.json ./
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["npx", "tsx", "auth-service/src/index.ts"]
```

The HEALTHCHECK parameters:

- interval=30s: check every 30 seconds
- timeout=5s: each check must complete within 5 seconds
- start-period=10s: ignore failures during the first 10 seconds (allows the service to start)
- retries=3: the container is marked unhealthy after 3 consecutive failures

The wget command calls the /health endpoint. If it returns a non-200 status or the connection fails, exit 1 signals an unhealthy state.

Docker exposes this health state in docker ps output and can be used in docker-compose depends_on conditions:

```yaml
services:
  auth:
    build:
      context: .
      dockerfile: auth-service/Dockerfile
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3
```

### Health Check Tests

The project includes tests that validate the health check data structure:

```ts
describe("Health Check", () => {
  it("should return healthy status structure", () => {
    const health = {
      status: "healthy" as const,
      service: "test-service",
      version: "1.0.0",
      uptime: 100,
      timestamp: new Date().toISOString(),
      checks: {},
    };

    expect(health.status).toBe("healthy");
    expect(health.service).toBe("test-service");
    expect(health.checks).toEqual({});
  });

  it("should mark as unhealthy when a check fails", () => {
    const checks = {
      redis: { status: "fail" as const, message: "Connection refused" },
    };

    const anyFail = Object.values(checks).some((c) => c.status === "fail");
    expect(anyFail).toBe(true);
  });
});
```

These tests verify the contract: the health response must have the correct shape, and the status logic must correctly identify failures.

## Step by Step

### Step 1: Add the Health Router

Use createHealthRouter with your service's config and list of dependencies. Register it early in the middleware chain so it is always reachable.

### Step 2: Implement Dependency Checks

For each dependency (Redis, PostgreSQL, external API), create a check function that tests connectivity. Use PING for Redis, a simple SELECT 1 for PostgreSQL, and a lightweight endpoint for external services.

### Step 3: Determine Status Logic

Decide what constitutes healthy, degraded, and unhealthy for your service. A service that can function without its cache (Redis) might be degraded but not unhealthy. A service that cannot function without its database is unhealthy when the database is down.

### Step 4: Add Docker Healthcheck

Add a HEALTHCHECK directive to your Dockerfile. Choose an interval that balances responsiveness (detect failures quickly) with overhead (do not overwhelm the health endpoint).

### Step 5: Build Aggregated Health

Add a /health/all endpoint to the gateway that calls /health on each downstream service. Return the combined results.

### Step 6: Monitor in Production

Feed health check data into your monitoring system. Alert when any service transitions from healthy to unhealthy. Track response times from health checks as an early warning of performance degradation.

## Exercise

Extend the health check system with these features:

1. Add a /health/ready endpoint to each service that checks dependencies (readiness probe) and a /health/live endpoint that always returns 200 (liveness probe).

2. Add a database health check function. It should execute a simple query (SELECT 1) and measure response time. Even though our workshop uses in-memory storage, implement it as if connecting to PostgreSQL.

3. Add a BullMQ health check to the notification-service. Check that the queue connection is active by calling notificationQueue.getWaitingCount() and verifying it does not throw.

4. Implement the aggregated /health/all endpoint in the gateway. Call /health on both auth-service and notification-service. Return the combined results with overall status.

5. Add the HEALTHCHECK directive to all three Dockerfiles and update docker-compose.yml to use condition: service_healthy in depends_on.

6. Add a /health/metrics endpoint that returns prometheus-compatible metrics: uptime_seconds, health_check_duration_milliseconds, and dependency_status (1 for pass, 0 for fail).

## Summary

Health checks are the observability foundation of a microservices architecture. Every service exposes a GET /health endpoint that reports its status, version, uptime, and the health of its dependencies. The response uses a consistent shape (HealthStatus) across all services, making it easy for monitoring tools to parse.

The three health states (healthy, degraded, unhealthy) map to operational decisions: healthy means route traffic, degraded means investigate, unhealthy means stop sending traffic and alert the team. Liveness probes tell the orchestrator when to restart a container. Readiness probes tell the load balancer when to remove an instance from rotation.

Docker HEALTHCHECK directives and Kubernetes probes automate these checks, ensuring that failing instances are detected and handled without human intervention.

In the next lesson, we build the distributed logging system that makes these health states meaningful by connecting them to the full request trace across all services.
