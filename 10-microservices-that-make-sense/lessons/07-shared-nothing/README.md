# 07 — Shared-Nothing Architecture

The shared-nothing principle is the backbone of a real microservices architecture: each service owns its own data, manages its own state, and never reaches directly into another service's storage. If two services share a database table, they are not independent services. They are a distributed monolith wearing a microservices costume. This lesson covers why data isolation matters, how our LaunchPad services achieve it, the trade-offs of data duplication, and how contract testing keeps services compatible without coupling them.

## What You'll Learn

- Why each service must own its own database (or data store)
- How the LaunchPad services achieve data isolation with separate in-memory stores and independent Redis usage
- Why data duplication is an acceptable and often necessary trade-off
- How contract testing replaces integration testing across service boundaries
- What breaks when you violate the shared-nothing principle

## Key Concepts

### Independent Data Ownership

In our LaunchPad project, each service owns its data exclusively.

The auth-service owns user data and sessions:

```ts
const users = new Map<string, User & { password: string }>();
const sessions = new Map<string, string>(); // token -> userId
```

No other service reads from or writes to these Maps. When the notification-service needs to know who a user is, it does not peek into the auth-service's user store. It either receives a userId as part of the notification payload, or it calls the auth-service's HTTP API.

The notification-service owns its queue data through BullMQ:

```ts
const notificationQueue = new Queue<NotificationPayload, unknown, string>(
  QUEUE_NAME,
  {
    connection: { ...redisConnectionOpts },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  }
);
```

All notification jobs, their state, their metadata, and their results live in Redis under keys namespaced to the "notifications" queue. The auth-service does not query these keys. The gateway does not know they exist.

The gateway owns only its routing configuration:

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

The gateway is stateless. It has no database, no Redis data, no persistent storage. Its configuration comes from environment variables and code. This makes it trivially scalable: you can run 10 gateway instances behind a load balancer and they all behave identically.

### The Database-Per-Service Pattern

In our workshop, we use in-memory Maps and Redis. In production, the database-per-service pattern means each service has its own database instance (or at minimum, its own schema within a shared database server).

The production version of our architecture would look like:

- auth-service: PostgreSQL database with users and sessions tables
- notification-service: Redis for BullMQ queues, plus potentially a PostgreSQL database for notification history
- gateway: no database (stateless)

Each service's database is private. No other service has connection credentials to it. The only way to access a service's data is through its API.

This isolation provides several guarantees:

Schema changes are local. If the auth-service team adds a column to the users table, no other service is affected. There are no cross-service migrations.

Performance is isolated. If the notification-service runs a heavy query against its database, the auth-service's response times are unaffected.

Technology choices are independent. The auth-service could use PostgreSQL while the notification-service uses MongoDB. The gateway does not care. Each team picks the database that best fits their domain.

Deployment is independent. The auth-service can run database migrations during its deployment without coordinating with the notification team.

### What Happens When You Share a Database

Consider what would go wrong if auth-service and notification-service shared a PostgreSQL database.

Scenario 1: Schema coupling. The notification-service stores a foreign key to the users table. The auth team wants to rename the users table to accounts. They cannot, because the notification-service's query would break. Two teams that should be independent are now coupled through a database schema.

Scenario 2: Performance coupling. The notification-service runs a bulk query to find all undelivered notifications. This query locks the users table for a cross-join. The auth-service's login endpoint times out because it cannot read from the locked table.

Scenario 3: Deployment coupling. The auth team adds a NOT NULL column to users with a migration that takes 30 seconds. During those 30 seconds, the notification-service's queries fail because the schema is in flux. A deployment to one service breaks another.

Every one of these scenarios is a real problem that teams encounter when they share databases across services. The shared-nothing principle eliminates all of them.

### Data Duplication Is Acceptable

The most common objection to database-per-service is data duplication. If the notification-service needs the user's name to personalize an email, and the user's name lives in the auth-service's database, does the notification-service need its own copy?

Yes, and that is fine.

In our project, the notification-service receives the user's information as part of the notification payload:

```ts
export interface NotificationPayload {
  to: string;        // email address
  subject: string;
  body: string;
  type: "email" | "sms" | "push";
  userId?: string;   // optional reference
}
```

The to field contains the email address, and the body can contain the personalized greeting. This data was originally from the auth-service's user record, but it is passed in the message rather than looked up from a shared database.

This means if the user changes their email address in the auth-service, pending notifications in the queue still have the old email. Is this a problem? In most cases, no. The notification was created when the old email was current. It should be delivered to the address that was correct at the time.

If you do need real-time consistency (e.g., the user changed their email and expects all future notifications at the new address), you have options:

- Look up the email at delivery time by calling the auth-service's API from the worker
- Subscribe to user-update events from the auth-service and maintain a local cache
- Include a userId in the payload and resolve the email at processing time

Each option has trade-offs. The point is that you make these trade-offs explicitly rather than implicitly coupling through a shared database.

### Contract Testing

When services communicate through APIs, you need confidence that changes to one service do not break its consumers. Integration testing (running all services and testing end-to-end) is one approach, but it is slow, flaky, and requires the full environment.

Contract testing is a lightweight alternative. Each service defines the contracts it expects from its dependencies, and each service verifies that it fulfills the contracts its consumers expect.

In our project, the contract between the gateway and the auth-service is defined by the ServiceRoute and the auth-service's API. The gateway expects:

- POST /auth/register returns 201 with { user, token }
- POST /auth/login returns 200 with { user, token }
- GET /auth/verify with a valid Bearer token returns 200 with { userId, email }

The project's test file validates the structure of these contracts:

```ts
// From gateway/tests/health.test.ts
describe("Service Config", () => {
  it("should have name, port, and version", () => {
    const config = {
      name: "gateway",
      port: 3000,
      version: "1.0.0",
    };

    expect(config.name).toBe("gateway");
    expect(config.port).toBe(3000);
    expect(config.version).toBe("1.0.0");
  });
});
```

A more thorough contract test would look like this:

```ts
// Example contract test for auth-service consumers
describe("Auth Service Contract", () => {
  it("register endpoint returns expected shape", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({ email: "test@example.com", name: "Test", password: "secret" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("user.id");
    expect(response.body).toHaveProperty("user.email");
    expect(response.body).toHaveProperty("user.name");
    expect(response.body).toHaveProperty("token");
    // Contract: user object must NOT contain password
    expect(response.body.user).not.toHaveProperty("password");
  });

  it("verify endpoint returns userId and email", async () => {
    // First register and get a token
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: "verify@example.com", name: "Verify", password: "pass" });

    const response = await request(app)
      .get("/auth/verify")
      .set("Authorization", `Bearer ${reg.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("userId");
    expect(response.body).toHaveProperty("email");
  });
});
```

Contract tests run fast (no external dependencies needed), catch breaking changes early (if the auth-service removes the email field from the verify response, the test fails), and do not require running the entire infrastructure.

### The Shared Directory: An Exception That Proves the Rule

Our project has a shared/ directory with common types, middleware, and utilities. Is this a violation of shared-nothing?

No. The shared/ directory contains code, not state. Each service copies this code into its own Docker image:

```dockerfile
COPY shared/ ./shared/
```

At runtime, each service has its own copy of the code. There is no shared process, no shared memory, no shared database. The shared directory is a convenience for avoiding code duplication during development, similar to publishing a shared npm package that each service installs independently.

The shared types in types.ts serve as the contract definition:

```ts
export interface ServiceConfig {
  name: string;
  port: number;
  version: string;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  checks: Record<string, HealthCheck>;
}
```

These interfaces define what data flows between services. They are the API contract in TypeScript form. Changing these interfaces is a deliberate decision that requires updating all services that use them, which is exactly the level of coupling you want.

## Step by Step

### Step 1: Audit Shared State

List every piece of shared state in your system. This includes databases, Redis keys, files on shared volumes, and environment variables that couple services.

### Step 2: Assign Ownership

For each piece of shared state, determine which service should own it. The owner is the service whose domain the data belongs to. Users belong to the auth-service. Notifications belong to the notification-service.

### Step 3: Replace Direct Access with API Calls

Every place where service A reads service B's data directly, replace it with an API call to service B. This may seem like it adds latency, and it does, but it buys you independence.

### Step 4: Handle Data Duplication

Identify cases where a service needs data from another service's domain. Decide whether to pass the data in messages, cache it locally, or look it up via API at processing time.

### Step 5: Write Contract Tests

For each API boundary, write tests that verify the request and response shapes. These tests should run as part of each service's CI pipeline.

### Step 6: Verify Independence

Deploy each service independently and confirm that the others continue to work. If deploying service A requires redeploying service B, you still have hidden coupling.

## Exercise

Refactor the LaunchPad project to use separate Redis namespaces for each service:

1. The auth-service should use Redis keys prefixed with "auth:" for session storage (replace the in-memory sessions Map with Redis)
2. The notification-service should use Redis keys prefixed with "notifications:" (BullMQ already does this with its queue name)
3. Write a script that lists all Redis keys and verifies that no key is written by more than one service
4. Add a contract test that verifies the notification-service does not read any "auth:" keys and vice versa
5. Consider: should the auth-service and notification-service use the same Redis instance or separate instances? What are the trade-offs?

## Summary

The shared-nothing principle ensures that each service can be developed, deployed, and scaled independently. Data ownership means each service controls its own storage and no other service accesses it directly. Data duplication is acceptable when it preserves independence. Contract testing verifies compatibility without the overhead of integration testing.

Our LaunchPad project achieves shared-nothing through separate in-memory stores (auth users/sessions), separate queue namespaces (BullMQ notifications queue), and a stateless gateway. The shared/ directory contains code, not state, and each Docker image gets its own copy.

When you are tempted to "just add a foreign key" across services, remember: that foreign key is a coupling point that will constrain every future deployment, migration, and scaling decision for both services.

In the next lesson, we build the health check system that lets you observe whether each service (and its dependencies) is healthy.
