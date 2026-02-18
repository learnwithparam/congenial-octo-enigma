# 02 — Identifying Service Boundaries

Drawing the lines between services is the most consequential decision in a microservices architecture. Get it right and each team moves independently. Get it wrong and you end up with a distributed monolith that is harder to change than the original single-process app. This lesson covers how to find good boundaries using domain-driven design principles, how to map the LaunchPad project into bounded contexts, and how to choose between synchronous and asynchronous communication.

## What You'll Learn

- How domain-driven design concepts (bounded contexts, aggregates, ubiquitous language) guide service decomposition
- How to map the LaunchPad project into three bounded contexts: Identity, Notification, and Routing
- The difference between synchronous (HTTP) and asynchronous (message queue) communication and when to use each
- How to spot a boundary drawn in the wrong place

## Key Concepts

### Bounded Contexts from Domain-Driven Design

Domain-driven design (DDD) gives us the concept of a bounded context: a self-contained area of the system where a particular domain model applies. Inside a bounded context, terms have precise meanings. Across contexts, the same word may mean different things.

Consider the word "user" in our LaunchPad project:

- In the Identity context (auth-service), a user has an id, email, name, password, and createdAt timestamp. This is the full user model used for registration and authentication.
- In the Notification context (notification-service), a user is just a userId string attached to a notification payload. The notification service does not know or care about the user's password or registration date.

This difference in how each context models the same real-world concept is exactly what makes them separate bounded contexts. The auth-service defines its User type:

```ts
// shared/types.ts — the User interface
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}
```

But the notification-service only references a userId as an optional field:

```ts
export interface NotificationPayload {
  to: string;
  subject: string;
  body: string;
  type: "email" | "sms" | "push";
  userId?: string;
}
```

The notification service does not import the User type. It does not need the full user model. It only needs enough information to deliver a message. This minimal coupling is the hallmark of a well-drawn boundary.

### The LaunchPad Service Map

Let us map out the three services in our project and how they relate to each other.

The Gateway (port 3000) is the single entry point for all client traffic. It does not contain business logic. It receives HTTP requests and proxies them to the correct downstream service based on URL path:

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

The Auth Service (port 3001) owns the Identity bounded context. It handles registration, login, token verification, and user profiles. It stores user data and session tokens. Its API surface is small and well-defined:

- POST /auth/register
- POST /auth/login
- GET /auth/verify
- GET /auth/me
- POST /auth/logout

The Notification Service (port 3002) owns the Notification bounded context. It accepts notification requests, queues them via BullMQ, and processes them asynchronously. Its API surface is equally focused:

- POST /notifications/send
- GET /notifications/status/:id
- GET /notifications/stats

The service map looks like this:

```
Client
  |
  v
Gateway (:3000)
  |          |
  v          v
Auth       Notification
(:3001)    (:3002)
  |          |
  v          v
Redis      Redis + BullMQ
```

Each service has a clear, single responsibility. The gateway routes. The auth service authenticates. The notification service delivers messages.

### Communication Patterns: Sync vs Async

The way services talk to each other is as important as where you draw the boundaries. There are two fundamental patterns.

Synchronous communication (HTTP) is used when the caller needs an immediate response. In our project, when a client sends POST /auth/login through the gateway, the gateway proxies the request to auth-service and waits for the response before replying to the client. The client cannot proceed without knowing whether the login succeeded.

The gateway implements this with http-proxy-middleware:

```ts
app.use(
  route.path,
  createProxyMiddleware({
    target: route.target,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        const corrId = (req as express.Request).correlationId;
        if (corrId) {
          proxyReq.setHeader("x-correlation-id", corrId);
        }
        proxyReq.setHeader("x-forwarded-by", "gateway");
      },
    },
  })
);
```

This is synchronous: the gateway holds the connection open until auth-service responds.

Asynchronous communication (message queue) is used when the caller does not need an immediate result. In our project, when you POST /notifications/send, the notification-service does not send the notification immediately. It queues a job and responds with HTTP 202 Accepted:

```ts
app.post("/notifications/send", async (req, res) => {
  const job = await notificationQueue.add("send-notification", {
    to, subject, body, type, userId,
  });

  const result: NotificationResult = {
    id: job.id || crypto.randomUUID(),
    status: "queued",
    queuedAt: new Date().toISOString(),
  };

  res.status(202).json(result);
});
```

The actual processing happens later, in the BullMQ worker:

```ts
const worker = new Worker<NotificationPayload, unknown, string>(
  QUEUE_NAME,
  async (job) => {
    const { to, subject, body, type } = job.data;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { delivered: true, timestamp: new Date().toISOString() };
  },
  { connection: { ...redisConnectionOpts }, concurrency: 5 }
);
```

The caller gets an immediate acknowledgment ("your notification is queued") and can check status later via GET /notifications/status/:id. This decoupling is essential for operations that are slow, unreliable, or need retry logic.

### Choosing Sync vs Async

Use synchronous HTTP when:
- The caller needs the result to continue (login, token verification, data queries)
- The operation is fast (under 500ms)
- Failure means the entire operation should fail

Use asynchronous messaging when:
- The caller can continue without waiting (sending an email after registration)
- The operation is slow or unreliable (calling external APIs, sending SMS)
- You need retry logic with backoff (notification delivery)
- You need to handle load spikes (queue absorbs burst traffic)

In our project, the auth-service is purely synchronous. Every endpoint returns a direct response. The notification-service uses async internally (BullMQ queue and worker) while exposing a synchronous HTTP API for submitting and checking notifications.

### Spotting a Bad Boundary

How do you know when you have drawn a boundary in the wrong place? Watch for these symptoms:

A chatty interface between services is the clearest signal. If service A must call service B five times to complete a single operation, either A and B should be one service, or the boundary is wrong.

Circular dependencies are another red flag. If auth-service needs to call notification-service which needs to call auth-service to verify a token, you have a cycle. In our project, the auth-service has no outbound dependencies on other services. The notification-service has no outbound dependencies on auth-service. The gateway depends on both, but neither depends on the gateway. This directed, acyclic relationship is what you want.

Shared mutable state is the final warning sign. If two services need to read and write the same database table, they are not truly independent. They share a hidden coupling that will cause race conditions and deployment hazards. In our project, the auth-service owns user and session data. The notification-service owns the BullMQ queue. Neither touches the other's data.

## Step by Step

### Step 1: List Your Domain Operations

Write down every operation your system performs. For LaunchPad:

- Register a new user
- Log in with email and password
- Verify an authentication token
- Get current user profile
- Log out
- Queue a notification for delivery
- Process a queued notification
- Check notification delivery status
- Get queue statistics
- Route incoming HTTP requests to the correct service
- Health check all services

### Step 2: Group by Cohesion

Operations that share the same data and change for the same reasons belong together:

- Identity group: register, login, verify, profile, logout (all operate on users and sessions)
- Notification group: queue, process, status, stats (all operate on notification jobs)
- Routing group: proxy requests, aggregate health (operates on service configuration)

### Step 3: Define the Contract Between Groups

Each group exposes a minimal API to the others. The auth-service exposes five HTTP endpoints. The notification-service exposes three. The gateway exposes its proxy configuration as a list of ServiceRoute objects:

```ts
export interface ServiceRoute {
  path: string;
  target: string;
  name: string;
}
```

The contract between services should be expressible as a small set of TypeScript interfaces. If the contract requires dozens of types or deep object graphs, the boundary may be too fine-grained.

### Step 4: Validate Independence

For each proposed service, ask:

- Can a team deploy this service without coordinating with other teams? Yes for all three of ours.
- Can this service start and run even if other services are down? The auth-service can start without the gateway. The notification-service can start without auth. The gateway can start but will return 502 for routes to unavailable services.
- Can you test this service in isolation? Yes, each has its own Express app exported for testing.

### Step 5: Document the Service Map

Create a simple document that lists each service, its responsibility (one sentence), its API endpoints, and its dependencies. This becomes the team's shared understanding of the architecture.

## Exercise

Take the LaunchPad service map and extend it with a hypothetical new feature: billing. Users can subscribe to plans, and the system should send a notification when a subscription is created.

1. Define the Billing bounded context: what data does it own? (plans, subscriptions, payment records)
2. What are its API endpoints? (POST /billing/subscribe, GET /billing/subscription, POST /billing/cancel)
3. How does it communicate with auth-service? (it needs to verify the user's token -- synchronous HTTP call to /auth/verify, or accept a userId from the gateway)
4. How does it communicate with notification-service? (it queues a welcome notification -- should this be synchronous or asynchronous?)
5. Draw the updated service map with the billing service included
6. Check for bad boundary signals: are there circular dependencies? Chatty interfaces? Shared state?

## Summary

Service boundaries should follow domain boundaries, not technical layers. The auth-service is not "the database service" or "the Express service." It is the service that owns user identity. The notification-service is not "the Redis service." It is the service that owns message delivery.

Use bounded contexts from domain-driven design to find natural seams. Use synchronous HTTP for operations where the caller needs an immediate answer, and asynchronous messaging for operations that can be deferred, retried, or processed in bulk. Validate your boundaries by checking for independence, minimal coupling, and the absence of circular dependencies.

In the next lesson, we will extract the auth service from the monolith and see exactly how its code is organized as a standalone Express application.
