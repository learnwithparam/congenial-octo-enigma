# 03 — First Worker

You have a queue and a way to add jobs. Now you need something to process them. A worker is a separate Node.js process that listens for jobs on a queue and executes a handler function for each one. In this lesson, you will build your first worker, understand concurrency settings, handle worker lifecycle events, and implement graceful shutdown.

## What You'll Learn

- How to create a BullMQ Worker that processes jobs
- How worker concurrency controls throughput
- How to listen for worker lifecycle events (completed, failed, error)
- How to implement graceful shutdown so jobs are not lost
- The two-process architecture: API server and worker running side by side

## Key Concepts

### The Worker Class

A BullMQ Worker subscribes to a named queue and processes jobs using a callback function. The worker runs in its own process, completely independent of the API server.

Look at the report worker in `backend/src/worker.ts`:

```typescript
import { Worker } from "bullmq";
import { connection } from "./queues/connection.js";
import { processReportJob } from "./jobs/reports.js";
import type { ReportJobData } from "./types.js";

const reportWorker = new Worker<ReportJobData>(
  "reports",
  async (job) => {
    await processReportJob(job);
  },
  {
    connection,
    concurrency: 1, // Reports are heavy, process one at a time
  }
);
```

Three arguments define a worker:

1. **Queue name** (`"reports"`) -- must match the name used when creating the Queue. The worker only picks up jobs from this specific queue.
2. **Processor function** (`async (job) => { ... }`) -- the function that does the actual work. It receives a `Job` object with the data payload.
3. **Options** -- connection config, concurrency, rate limiting, and more.

### Concurrency

Concurrency controls how many jobs a single worker processes in parallel. The right value depends on the nature of the work.

In `backend/src/worker.ts`, the two workers have different concurrency settings:

```typescript
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "3", 10);

// Email worker -- lightweight I/O, can handle multiple at once
const emailWorker = new Worker<EmailJobData>(
  "email",
  async (job) => {
    await processEmailJob(job);
  },
  {
    connection,
    concurrency: CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Report worker -- CPU-heavy, process one at a time
const reportWorker = new Worker<ReportJobData>(
  "reports",
  async (job) => {
    await processReportJob(job);
  },
  {
    connection,
    concurrency: 1,
  }
);
```

The email worker uses `concurrency: 3` (configurable via `WORKER_CONCURRENCY` env var) because sending an email is mostly waiting for an API response -- the CPU is idle. Processing three emails in parallel triples throughput without adding load.

The report worker uses `concurrency: 1` because report generation is heavier. Processing one report at a time prevents the worker from running out of memory or CPU.

### Rate Limiting

The email worker also includes a rate limiter:

```typescript
limiter: {
  max: 10,
  duration: 1000,
}
```

This means the worker processes at most 10 jobs per 1000 milliseconds (1 second). This is important when calling external APIs like Resend that have rate limits. Without this, a burst of 1000 email jobs would hammer the API and trigger rate limit errors.

### Worker Events

Workers emit events that let you observe job lifecycle. Our worker listens to three events:

```typescript
emailWorker.on("completed", (job) => {
  console.log(`[worker:email] Job ${job.id} completed`);
});

emailWorker.on("failed", (job, err) => {
  console.error(
    `[worker:email] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
    err.message
  );
});

emailWorker.on("error", (err) => {
  console.error("[worker:email] Worker error:", err);
});
```

- **`completed`** -- fired after the processor function returns successfully. Use this for logging or triggering downstream actions.
- **`failed`** -- fired when the processor throws an error. The `job.attemptsMade` property tells you which attempt just failed. If retries are configured, the job may be retried automatically.
- **`error`** -- fired for worker-level errors, usually Redis connection problems. This is different from a job failure.

### The Processor Function

The processor function is where your business logic lives. Look at `backend/src/jobs/reports.ts`:

```typescript
import type { Job } from "bullmq";
import type { ReportJobData } from "../types.js";

export async function processReportJob(
  job: Job<ReportJobData>
): Promise<void> {
  const { reportType, userId } = job.data;

  console.log(
    `[reports] Processing job ${job.id}: generating ${reportType} report`
  );

  // Simulate report generation with progress updates
  const steps = ["Gathering data", "Aggregating metrics", "Formatting output"];

  for (let i = 0; i < steps.length; i++) {
    console.log(`[reports] Job ${job.id}: ${steps[i]}...`);
    await job.updateProgress(Math.round(((i + 1) / steps.length) * 100));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(
    `[reports] Job ${job.id}: ${reportType} report complete` +
      (userId ? ` for user ${userId}` : "")
  );
}
```

Key patterns:

- **`job.data`** -- contains the payload you passed to `queue.add()`. TypeScript generics ensure type safety.
- **`job.updateProgress()`** -- reports progress as a number (0-100). Clients polling `GET /jobs/report/:id` can see this value in real time.
- **Throwing an error** -- if the processor throws, BullMQ marks the job as failed and may retry it based on the queue's retry configuration.

### Graceful Shutdown

When the worker process receives a shutdown signal (SIGTERM or SIGINT), you must close workers properly to avoid losing jobs that are mid-processing:

```typescript
async function shutdown(): Promise<void> {
  console.log("[worker] Shutting down gracefully...");
  await Promise.all([emailWorker.close(), reportWorker.close()]);
  console.log("[worker] All workers closed");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

Calling `worker.close()` tells BullMQ to:
1. Stop picking up new jobs from the queue
2. Wait for any in-progress jobs to finish
3. Disconnect from Redis

Without graceful shutdown, a job that was mid-processing would be left in a "stuck" state and would need to be manually retried.

## Step by Step

### Step 1: Create the Worker File

The worker lives in `backend/src/worker.ts`. It imports the shared connection, the processor functions, and creates Worker instances for each queue.

Start the worker in a separate terminal:

```bash
npm run worker
```

You should see:

```
[worker] Started with concurrency: 3
[worker] Listening for jobs on queues: email, reports
```

### Step 2: Run Both Processes

You need two terminals running simultaneously:

**Terminal 1 -- API server:**
```bash
npm run dev
```

**Terminal 2 -- Worker:**
```bash
npm run worker
```

The API server enqueues jobs. The worker processes them. They communicate through Redis.

### Step 3: Enqueue a Test Job

With both processes running, send a test email job:

```bash
curl -X POST http://localhost:3002/jobs/email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "founder@example.com",
    "subject": "Welcome to LaunchPad",
    "html": "<p>Your startup has been registered!</p>"
  }'
```

The API responds immediately:

```json
{
  "message": "Email job enqueued",
  "jobId": "1"
}
```

In the worker terminal, you should see:

```
[email] Processing job 1: sending to founder@example.com
[email] Job 1: (mock) would send to founder@example.com
  Subject: Welcome to LaunchPad
  HTML length: 44 chars
[worker:email] Job 1 completed
```

### Step 4: Check Job Status

Use the job ID to check the status:

```bash
curl http://localhost:3002/jobs/email/1
```

```json
{
  "id": "1",
  "name": "send-email",
  "state": "completed",
  "progress": 0,
  "attemptsMade": 1,
  "finishedOn": 1708300000000,
  "processedOn": 1708299999500,
  "timestamp": 1708299999000
}
```

The `state` field shows where the job is in its lifecycle: `waiting`, `active`, `completed`, `failed`, or `delayed`.

## Exercise

Modify the email worker's concurrency to 1 and send five email jobs rapidly using curl in a loop. Observe how the worker processes them one at a time. Then change concurrency back to 5 and repeat the test. Notice how all five are processed nearly simultaneously. Record the total time for each configuration.

## Summary

- A Worker subscribes to a named queue and processes jobs with a callback function
- Concurrency controls how many jobs run in parallel within a single worker process
- Rate limiting prevents overwhelming external APIs during job bursts
- Worker events (completed, failed, error) provide visibility into job lifecycle
- The processor function receives a typed Job object with data and utility methods like `updateProgress()`
- Graceful shutdown ensures in-progress jobs finish before the worker stops
- The API server and worker are separate processes that communicate through Redis
