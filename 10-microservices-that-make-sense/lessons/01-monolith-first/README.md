# 01 — Monolith First

Every successful microservices architecture started as a monolith. This is not a coincidence. It is a pattern born from decades of industry experience, and it is the single most important lesson in this entire course. Before you split anything, you need something worth splitting.

In this lesson, we examine why starting monolithic is the right call for almost every greenfield project, what signals tell you it is time to extract services, and why premature decomposition is one of the most expensive architectural mistakes a team can make.

## What You'll Learn

- Why a monolith is the correct starting point for most projects
- The three extraction triggers that justify splitting: team scaling, deploy independence, and different scaling needs
- How to recognize the premature microservices anti-pattern
- Why the LaunchPad project begins as a single Express app before evolving into the multi-service architecture you see in this course

## Key Concepts

### The Monolith Is Not the Enemy

The word "monolith" has become loaded in modern backend engineering. Conference talks and blog posts often frame it as something to escape from. But a monolith is simply an application where all functionality lives in a single deployable unit. There is nothing inherently wrong with that.

Consider what a monolith gives you for free:

- One repository to manage
- One deployment pipeline
- No network boundaries between components
- No distributed transaction headaches
- Simple local development: run one process, debug one process
- Refactoring across module boundaries is a code change, not a contract negotiation

In our LaunchPad project, imagine the starting point. All the logic that eventually becomes the auth service, the notification service, and the gateway lives in a single Express app:

```ts
// A monolithic Express app — everything in one process
import express from "express";

const app = express();
app.use(express.json());

// Auth routes
app.post("/auth/register", (req, res) => { /* ... */ });
app.post("/auth/login", (req, res) => { /* ... */ });
app.get("/auth/verify", (req, res) => { /* ... */ });

// Notification routes
app.post("/notifications/send", (req, res) => { /* ... */ });
app.get("/notifications/status/:id", (req, res) => { /* ... */ });

// Everything runs on one port
app.listen(3000, () => console.log("LaunchPad running on :3000"));
```

This is perfectly fine when your team is small, your traffic is predictable, and your domain is still being discovered. In fact, this is preferable. You can move fast, change your mind about domain boundaries, and ship features without coordinating across service teams.

### Extraction Trigger 1: Team Scaling

The first and most common reason to extract a service is organizational. When your engineering team grows beyond 8-10 people all working in the same codebase, friction appears. Merge conflicts multiply. The deployment pipeline becomes a bottleneck because every team waits for every other team's code to pass CI.

This is Conway's Law at work: your system architecture will mirror your communication structure. When you have a single auth team and a single notifications team, giving each team its own service, its own repository (or at least its own deployment), and its own release cadence removes the coordination overhead.

In our project, the auth-service has its own port, its own startup logic, and its own package of routes:

```ts
const config: ServiceConfig = {
  name: "auth-service",
  port: parseInt(process.env.AUTH_PORT || "3001", 10),
  version: "1.0.0",
};
```

The notification-service similarly owns its own port and lifecycle:

```ts
const config: ServiceConfig = {
  name: "notification-service",
  port: parseInt(process.env.NOTIFICATION_PORT || "3002", 10),
  version: "1.0.0",
};
```

Each service can be developed, tested, and deployed by an independent team without stepping on anyone's toes.

### Extraction Trigger 2: Deploy Independence

The second trigger is deployment coupling. Suppose you have a critical bug fix in your auth module. In a monolith, you must deploy the entire application, including the notification code that has not changed. If the notification code has an unrelated failing test, your auth fix is blocked.

With services extracted, the auth team deploys the auth-service independently. The notification-service keeps running the previous version. Each service has its own Dockerfile, its own build step, and its own container:

```dockerfile
# auth-service/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY shared/ ./shared/
COPY auth-service/ ./auth-service/
COPY tsconfig.json ./
EXPOSE 3001
CMD ["npx", "tsx", "auth-service/src/index.ts"]
```

This isolation means a deployment to auth-service carries zero risk of breaking notifications, and vice versa.

### Extraction Trigger 3: Different Scaling Needs

The third trigger is resource scaling. In our LaunchPad project, the auth service handles synchronous HTTP requests: register, login, verify token. These are fast, CPU-light operations. The notification service, on the other hand, processes a BullMQ queue with potentially thousands of jobs, each simulating I/O to external email or SMS providers:

```ts
const worker = new Worker<NotificationPayload, unknown, string>(
  QUEUE_NAME,
  async (job: Job<NotificationPayload, unknown, string>) => {
    const { to, subject, body, type } = job.data;
    // Simulate sending notification
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { delivered: true, timestamp: new Date().toISOString() };
  },
  { connection: { ...redisConnectionOpts }, concurrency: 5 }
);
```

If you need to handle a spike in notifications (say, a mass email campaign), you want to scale the notification workers without also scaling the auth service. In a monolith, you scale everything together, paying for compute you do not need. In a microservices architecture, you scale the notification-service to 10 replicas while auth-service stays at 2.

### The Premature Microservices Anti-Pattern

Now for the warning. Splitting too early is far more dangerous than splitting too late. Here is why:

When you decompose before you understand your domain, you draw service boundaries in the wrong places. Fixing a wrong boundary in a monolith means moving code between modules, which is a refactoring operation your IDE can help with. Fixing a wrong boundary across services means migrating data between databases, changing API contracts, updating every client, and coordinating deployment across teams. It is an order of magnitude more expensive.

Signs you have split too early:

- Services that cannot complete a single user-facing operation without calling 3 or more other services
- Every feature requires changes to multiple services simultaneously
- Your "microservices" are actually a distributed monolith with network calls where function calls used to be
- You spend more time on infrastructure (service mesh, distributed tracing, contract testing) than on business logic
- Your local development setup requires running 15 containers just to test a login flow

The rule of thumb: if you cannot articulate which of the three triggers (team scaling, deploy independence, different scaling needs) applies, you should not split.

## Step by Step

### Step 1: Audit Your Monolith

Before extracting anything, map out the modules in your monolith. In our case, the LaunchPad monolith has three clear areas:

- Authentication (register, login, verify, user profiles)
- Notifications (queue a message, process it asynchronously, check status)
- Routing / API surface (the HTTP entry point for clients)

For each area, ask: does this area have a different team? Does it need independent deployments? Does it need to scale differently? If the answer to all three is "no," leave it in the monolith.

### Step 2: Identify Shared Dependencies

Look at what the modules share. In our project, auth and notifications both need Redis. They both use the same logging library (Pino). They share common middleware (correlation IDs, request logging, error handling). This shared code lives in the `shared/` directory:

```
shared/
  types.ts          # Shared TypeScript interfaces
  logger.ts         # Pino logger factory
  redis.ts          # Redis connection management
  health.ts         # Health check endpoint factory
  middleware/
    correlation-id.ts
    request-logger.ts
    error-handler.ts
```

This shared directory is a pragmatic choice. It avoids code duplication across services while keeping each service independently deployable (each Dockerfile copies shared/ into its container).

### Step 3: Draw the Boundary

A good service boundary has the following properties:

- Minimal inbound API surface (a small number of well-defined endpoints)
- Minimal outbound dependencies (it does not need to call many other services)
- Owns its own data (in production, each service would have its own database)
- Can be explained to a new team member in one sentence

Auth service: "Handles user registration, login, and token verification."
Notification service: "Queues and delivers notifications via email, SMS, or push."
Gateway: "Routes incoming HTTP requests to the correct downstream service."

Each sentence covers the full scope. There is no overlap.

### Step 4: Extract Incrementally

Never extract everything at once. The recommended order for our project:

1. Extract the auth service first (it has the fewest dependencies — just Redis for health checks)
2. Extract the notification service second (it depends on Redis and BullMQ)
3. Build the gateway last (it depends on both services being available)

This incremental approach means you can validate each extraction before moving to the next.

## Exercise

Take a monolithic Express application (either your own project or a sample one) and perform the following analysis:

1. List every route handler and group them by domain (auth, notifications, billing, etc.)
2. For each group, answer the three trigger questions: Does it need a separate team? Does it need independent deployment? Does it need different scaling?
3. Identify the shared dependencies between groups (database connections, utility functions, middleware)
4. Draw a proposed service map with arrows showing which services call which
5. For each proposed boundary, write a single-sentence description of what the service does
6. Decide which service you would extract first and justify why

Do not actually split the code yet. The goal is to practice the analysis that must come before any extraction.

## Summary

Starting with a monolith is not a compromise. It is a strategy. You build fast, learn your domain, and defer the complexity of distribution until you have concrete evidence that you need it.

The three extraction triggers — team scaling, deploy independence, and different scaling needs — are your decision framework. If none of them apply, keep the monolith. When one or more apply, extract incrementally, one service at a time, starting with the service that has the clearest boundary and the fewest dependencies.

The premature microservices anti-pattern is one of the most expensive architectural mistakes in modern software. It turns simple function calls into network calls, simple refactors into multi-team coordination exercises, and simple debugging sessions into distributed tracing adventures. Wait for the pain before you reach for the cure.

In the next lesson, we will look at how to identify the right boundaries when you do decide to split, using domain-driven design concepts and the concrete service map of our LaunchPad project.
