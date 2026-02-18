# 04 — Extracting the Notification Service

The notification service is our second extraction, and it introduces a fundamentally different pattern from the auth service. Where the auth service is synchronous (every request gets an immediate response), the notification service is event-driven. It accepts a request to send a notification, queues it for background processing, and immediately responds with a "queued" status. The actual delivery happens asynchronously through a BullMQ worker.

This lesson covers the full implementation of the notification-service, from queue configuration to worker processing, job status tracking, and queue statistics.

## What You'll Learn

- How to build an event-driven microservice using BullMQ and Redis
- How the producer/consumer pattern decouples request acceptance from processing
- How to configure retry logic with exponential backoff for unreliable operations
- How to expose job status and queue statistics through a REST API
- How HTTP 202 Accepted differs from HTTP 200 OK and when to use it

## Key Concepts

### The Producer/Consumer Pattern

The notification service plays two roles simultaneously. It is a producer that accepts HTTP requests and adds jobs to a queue. It is also a consumer (worker) that pulls jobs from the queue and processes them. Both roles run in the same process but are completely decoupled.

This pattern is essential for operations that are slow, unreliable, or bursty. Email delivery takes time. SMS providers have rate limits. Push notification services sometimes fail. By decoupling acceptance from processing, you get several benefits:

- The API responds instantly, so the caller is not blocked
- Failed deliveries can be retried automatically
- Traffic spikes are absorbed by the queue rather than overwhelming the provider
- You can scale workers independently from the API

### BullMQ Queue Configuration

The notification service creates a BullMQ queue with carefully chosen defaults:

```ts
const QUEUE_NAME = "notifications";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const redisConnectionOpts = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || "6379", 10),
  maxRetriesPerRequest: null as null,
};

const notificationQueue = new Queue<NotificationPayload, unknown, string>(
  QUEUE_NAME,
  {
    connection: { ...redisConnectionOpts },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  }
);
```

Several configuration choices deserve explanation.

The maxRetriesPerRequest is set to null. BullMQ requires this setting because its blocking Redis commands (like BRPOPLPUSH) can take a long time. The default ioredis behavior of retrying after a fixed number of attempts would interfere with these long-running commands.

The defaultJobOptions define retry behavior. The attempts field is set to 3, meaning each job gets three chances to succeed. The backoff configuration uses exponential delay: the first retry waits 1 second, the second waits 2 seconds, the third waits 4 seconds. This prevents a failing external service from being hammered with rapid retries.

The removeOnComplete setting of 100 means BullMQ keeps the last 100 completed jobs in Redis. Older completed jobs are automatically removed. This prevents Redis from running out of memory while still allowing recent job status lookups. Similarly, removeOnFail keeps the last 50 failed jobs for debugging.

The NotificationPayload type defines what data each job carries:

```ts
export interface NotificationPayload {
  to: string;
  subject: string;
  body: string;
  type: "email" | "sms" | "push";
  userId?: string;
}
```

The type field determines the delivery channel. In production, the worker would route to different providers based on this field: SendGrid for email, Twilio for SMS, Firebase for push notifications.

### The BullMQ Worker

The worker is the consumer that actually processes notifications:

```ts
const worker = new Worker<NotificationPayload, unknown, string>(
  QUEUE_NAME,
  async (job: Job<NotificationPayload, unknown, string>) => {
    const { to, subject, body, type } = job.data;

    logger.info(
      { jobId: job.id, to, type, subject },
      "Processing notification"
    );

    // Simulate sending notification
    await new Promise((resolve) => setTimeout(resolve, 500));

    // In production, integrate with email/SMS/push providers here
    logger.info(
      { jobId: job.id, to, type },
      "Notification sent successfully"
    );

    return { delivered: true, timestamp: new Date().toISOString() };
  },
  { connection: { ...redisConnectionOpts }, concurrency: 5 }
);
```

The concurrency setting of 5 means the worker processes up to 5 jobs simultaneously. This is a balance between throughput and resource consumption. In production, you would tune this based on the external provider's rate limits and your service's memory footprint.

The worker function receives a Job object with a data property containing the NotificationPayload. The 500ms setTimeout simulates the latency of calling an external provider. In production, this is where you would call the actual email API, SMS API, or push notification API.

The return value { delivered: true, timestamp: ... } is stored as the job's result in Redis. This can be retrieved later through the status endpoint.

### Worker Event Handlers

The worker emits events for completed and failed jobs:

```ts
worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Notification job completed");
});

worker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, err: err.message },
    "Notification job failed"
  );
});
```

These event handlers are used for observability. In a production system, you would also emit metrics here (increment a counter for completed/failed jobs, record processing duration) and potentially trigger alerts when the failure rate exceeds a threshold.

### The HTTP API

The notification service exposes three endpoints through a standard Express app:

```ts
const app = express();

app.use(express.json());
app.use(correlationId);
app.use(requestLogger(logger));
```

The middleware stack is identical to the auth service: JSON body parsing, correlation ID propagation, and request logging. This consistency across services is enabled by the shared middleware library.

### Sending a Notification (HTTP 202 Accepted)

The POST /notifications/send endpoint queues a notification and responds immediately:

```ts
app.post("/notifications/send", async (req, res) => {
  const { to, subject, body, type, userId } = req.body as NotificationPayload;

  if (!to || !subject || !body || !type) {
    res
      .status(400)
      .json({ error: "to, subject, body, and type are required" });
    return;
  }

  const job = await notificationQueue.add("send-notification", {
    to, subject, body, type, userId,
  });

  const result: NotificationResult = {
    id: job.id || crypto.randomUUID(),
    status: "queued",
    queuedAt: new Date().toISOString(),
  };

  logger.info({ notificationId: result.id, to, type }, "Notification queued");

  res.status(202).json(result);
});
```

The HTTP 202 status code is significant. Unlike 200 OK, which means "the request was successful," 202 Accepted means "the request has been accepted for processing, but the processing has not completed." This accurately communicates the asynchronous nature of the operation. The client knows the notification is queued but not yet delivered.

The response includes the job ID, which the client can use to check status later. The NotificationResult type from shared/types.ts defines this contract:

```ts
export interface NotificationResult {
  id: string;
  status: "queued" | "sent" | "failed";
  queuedAt: string;
}
```

### Checking Notification Status

The GET /notifications/status/:id endpoint lets clients check whether a notification has been delivered:

```ts
app.get("/notifications/status/:id", async (req, res) => {
  const job = await notificationQueue.getJob(req.params.id);

  if (!job) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const state = await job.getState();

  res.json({
    id: job.id,
    status: state,
    data: job.data,
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    processedOn: job.processedOn
      ? new Date(job.processedOn).toISOString()
      : null,
    finishedOn: job.finishedOn
      ? new Date(job.finishedOn).toISOString()
      : null,
  });
});
```

BullMQ stores job metadata in Redis, so you can retrieve the full history of a job: when it was created, when processing started, how many attempts were made, and when it finished. The state can be one of: "waiting," "active," "completed," "failed," "delayed," or "stuck."

This polling-based status check is a common pattern in async architectures. The alternative is webhooks (the notification service calls back when done), but polling is simpler to implement and sufficient for most use cases.

### Queue Statistics

The GET /notifications/stats endpoint provides an overview of the queue:

```ts
app.get("/notifications/stats", async (_req, res) => {
  const [waiting, active, completed, failed] = await Promise.all([
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
  ]);

  res.json({ waiting, active, completed, failed });
});
```

This endpoint is invaluable for operations. If the waiting count is growing and the active count is at its maximum, you know you need to scale up workers. If the failed count is spiking, something is wrong with the delivery provider.

The Promise.all call fetches all four counts in parallel from Redis, keeping the response time low.

### Graceful Shutdown

The notification service has the most complex shutdown logic because it must close both the Express server and the BullMQ components:

```ts
async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down notification service");
  server.close();
  await worker.close();
  await notificationQueue.close();
  await closeRedis();
  process.exit(0);
}
```

The order matters. First, stop accepting new HTTP requests (server.close()). Then, stop the worker (worker.close() waits for active jobs to finish). Then, close the queue connection. Finally, close the shared Redis connection. This ensures that jobs currently being processed complete before the service exits, and no new jobs are added after shutdown begins.

## Step by Step

### Step 1: Set Up the Queue

Create the BullMQ Queue with your connection options and default job settings. Choose retry counts and backoff strategy based on your delivery provider's reliability.

### Step 2: Create the Worker

Define the worker function that processes each job. Start with a simple implementation that logs the notification details, then add actual provider integration later.

### Step 3: Build the API Endpoints

Implement /notifications/send first (it produces jobs), then /notifications/status/:id (it reads job state), then /notifications/stats (it reads queue metrics).

### Step 4: Wire Up Middleware and Health

Apply the shared middleware stack and register the health router with Redis as a dependency.

### Step 5: Handle Shutdown

Implement graceful shutdown that closes the server, worker, queue, and Redis in the correct order.

### Step 6: Test the Flow

Start Redis locally, start the notification service, send a POST request to /notifications/send, and watch the worker log process it. Then check /notifications/status/:id to see the completed state.

## Exercise

Extend the notification service with these features:

1. Add a priority system. Modify the POST /notifications/send endpoint to accept an optional priority field ("high," "normal," "low"). Use BullMQ's priority option so high-priority notifications are processed before normal ones.

2. Add a scheduled notification feature. Accept an optional scheduledFor timestamp in the payload. Use BullMQ's delay option to schedule the job for the future: notificationQueue.add("send-notification", payload, { delay: scheduledFor - Date.now() }).

3. Add a bulk send endpoint POST /notifications/bulk that accepts an array of notification payloads. Use notificationQueue.addBulk() to queue them efficiently in a single Redis round-trip.

4. Add a webhook notification type. When the type is "webhook," the worker should make an HTTP POST request to the to field (which would be a URL) with the subject and body as the JSON payload.

5. Implement a dead letter queue. When a job fails all 3 retry attempts, move it to a separate "notifications-dead-letter" queue for manual inspection.

## Summary

The notification service demonstrates the event-driven microservice pattern. By separating request acceptance (the HTTP API) from processing (the BullMQ worker), you gain resilience, scalability, and decoupling. The producer responds instantly with HTTP 202, the consumer processes at its own pace with automatic retries, and the client can poll for status at any time.

The key patterns at work are: the producer/consumer pattern via BullMQ, exponential backoff for retries, HTTP 202 for accepted-but-not-completed operations, job status tracking through Redis, and ordered graceful shutdown.

In the next lesson, we build the API gateway that ties these services together into a unified API surface.
