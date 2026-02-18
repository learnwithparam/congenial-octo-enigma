# 01 — Sync vs Async: Why Background Processing Matters

Every web application eventually runs into the same wall: a user clicks a button and nothing happens for ten seconds. The request is stuck waiting for an email to send, a report to generate, or a file to process. This lesson explains why blocking the request thread is a problem, how background processing solves it, and the mental model behind job queues.

## What You'll Learn

- Why synchronous processing blocks the entire request/response cycle
- The difference between work that must happen during a request and work that can happen later
- How a job queue decouples producers from consumers
- The mental model of queues, jobs, and workers
- When background processing is the right solution

## Key Concepts

### The Request/Response Bottleneck

When a user submits a request to your Express server, the handler has a limited window to respond. If the handler needs to send an email, generate a PDF report, or call a slow third-party API, the user waits for all of that to finish before seeing a response.

Consider this naive approach to sending a welcome email when a new startup is registered:

```typescript
// BAD: Blocking the response on email delivery
app.post("/startups", async (req, res) => {
  const startup = await db.createStartup(req.body);

  // This takes 1-3 seconds and can fail
  await sendWelcomeEmail(startup.founderEmail, startup.name);

  // User waits for the email to finish before seeing a response
  res.status(201).json(startup);
});
```

If `sendWelcomeEmail` takes 2 seconds, every startup registration takes at least 2 seconds. If the email service is down, the entire request fails -- even though the startup was already saved to the database. The user sees an error for something they did not even ask for directly.

### What Can Be Deferred?

Not all work needs to happen during the request. A good rule of thumb: if the user does not need to see the result immediately, it can be a background job.

**Must happen during the request:**
- Validating input
- Writing to the database
- Returning the created resource

**Can happen in the background:**
- Sending confirmation emails
- Generating reports or analytics
- Processing file uploads (thumbnails, conversions)
- Syncing data with third-party services
- Sending webhook notifications

### The Job Queue Mental Model

A job queue introduces three components:

1. **Producer** -- the code that creates a job and puts it on the queue. In our codebase, this is the Express API route that receives the request.
2. **Queue** -- a data structure (backed by Redis) that holds jobs in order. Jobs wait here until a worker picks them up.
3. **Worker** -- a separate process that pulls jobs from the queue and executes them. Workers run independently of the API server.

The flow looks like this:

```
User Request --> Express API (Producer)
                    |
                    v
               Redis Queue
                    |
                    v
              Worker Process (Consumer)
                    |
                    v
           Email sent / Report generated
```

The key insight is that the producer and the consumer are separate processes. The API responds immediately after placing the job on the queue. The worker picks it up later, even if "later" is a few milliseconds.

### The Improved Pattern

Here is the same startup registration, but with background processing:

```typescript
// GOOD: Respond immediately, process email in the background
app.post("/startups", async (req, res) => {
  const startup = await db.createStartup(req.body);

  // Enqueue the email job -- returns instantly
  await emailQueue.add("send-email", {
    to: startup.founderEmail,
    subject: "Welcome to LaunchPad!",
    html: `<p>Your startup ${startup.name} has been registered.</p>`,
  });

  // User gets a response in milliseconds
  res.status(201).json(startup);
});
```

The `emailQueue.add()` call writes a small JSON payload to Redis and returns immediately. The actual email delivery happens in a worker process that might be running on a completely different machine.

### Why Redis?

Job queues need a broker -- something that holds the jobs between the producer and the consumer. Redis is the standard choice for BullMQ because:

- **Fast** -- operations take microseconds, so enqueuing a job adds negligible latency to your API
- **Persistent** -- Redis can persist data to disk, so jobs survive server restarts
- **Atomic** -- Redis operations are atomic, preventing race conditions when multiple workers compete for jobs
- **Pub/Sub** -- Redis has built-in pub/sub for notifying workers about new jobs

### Failure Isolation

One of the biggest benefits of background processing is failure isolation. When the email service goes down:

- **Without a queue:** The user's request fails. You might lose the database write if you are not careful with transactions.
- **With a queue:** The user's request succeeds. The email job sits in the queue. When the email service comes back, the worker retries the job automatically.

This separation means that transient failures in downstream services do not cascade into user-facing errors.

## Step by Step

### Step 1: Identify Blocking Work

Look at the routes in `backend/src/routes/jobs.ts`. Notice how the API enqueues a job and responds immediately:

```typescript
router.post("/email", async (req, res) => {
  const { to, subject, html } = req.body as EmailJobData;

  if (!to || !subject || !html) {
    res.status(400).json({ error: "Missing required fields: to, subject, html" });
    return;
  }

  const job = await emailQueue.add("send-email", { to, subject, html });

  res.status(201).json({
    message: "Email job enqueued",
    jobId: job.id,
  });
});
```

The response includes a `jobId` that the client can use to check on the job's progress later. This is a common pattern for async APIs.

### Step 2: Understand the Two-Process Architecture

Our application runs as two separate processes:

1. **API server** (`npm run dev` / `src/index.ts`) -- handles HTTP requests and enqueues jobs
2. **Worker** (`npm run worker` / `src/worker.ts`) -- pulls jobs from queues and processes them

These two processes share nothing except the Redis connection. They can be started and stopped independently. If the worker crashes, the API keeps running and jobs accumulate in the queue until the worker comes back.

### Step 3: Trace a Job Through the System

Follow the lifecycle of an email job:

1. Client sends `POST /jobs/email` with `{ to, subject, html }`
2. The route handler validates the input
3. `emailQueue.add("send-email", data)` writes the job to Redis
4. The API responds with `201` and the job ID
5. The worker process picks up the job from the `email` queue
6. `processEmailJob()` sends the email via Resend (or logs in mock mode)
7. BullMQ marks the job as completed (or failed)

The client can check `GET /jobs/email/:id` at any time to see the job's current state.

## Exercise

Think about a startup directory application where users can register startups, browse categories, and receive notifications. List three operations that should remain synchronous (in the request handler) and three that should be moved to background jobs. For each background job, describe what data the job would need to carry.

Example:
- **Background job:** Send a weekly digest email to investors
- **Job data:** `{ userId: string, startupIds: string[], weekOf: string }`

## Summary

- Synchronous processing blocks the request thread, making the user wait for work they do not need to see immediately
- A job queue decouples producers (API routes) from consumers (workers) using Redis as a broker
- The API enqueues jobs and responds instantly; workers process jobs in a separate process
- Failure isolation means downstream outages do not cause user-facing errors
- The three components of a queue system are producers, queues, and workers
