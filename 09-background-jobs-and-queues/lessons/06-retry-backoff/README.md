# 06 — Retry and Backoff

Jobs fail. External APIs go down, databases run out of connections, network requests time out. A good queue system does not just report failures -- it recovers from them automatically. In this lesson, you will learn how BullMQ retries failed jobs, the difference between exponential and fixed backoff, how to configure max attempts, and what happens when a job exhausts all its retries.

## What You'll Learn

- How BullMQ retries failed jobs automatically
- The difference between exponential and fixed backoff strategies
- How to configure `attempts` and `backoff` on a per-queue or per-job basis
- What happens when a job exceeds its maximum attempts
- How `removeOnComplete` and `removeOnFail` manage queue storage
- How to use worker events to track retry behavior

## Key Concepts

### How Retries Work

When a job processor throws an error, BullMQ does not immediately give up. It checks the job's `attempts` setting. If the job has attempts remaining, BullMQ moves it to a `delayed` state for a backoff period, then re-queues it for another try.

The retry flow:

```
Job fails (throw Error)
  --> Has attempts remaining?
    --> Yes: Move to "delayed" state for backoff period
      --> Backoff expires: Move back to "waiting"
        --> Worker picks it up again
    --> No: Move to "failed" state permanently
```

### Exponential Backoff

The email queue in `backend/src/queues/email.ts` uses exponential backoff:

```typescript
export const emailQueue = new Queue<EmailJobData>("email", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 500,
    },
  },
});
```

With `type: "exponential"` and `delay: 1000`, the backoff doubles with each attempt:

| Attempt | Backoff Delay | Total Wait |
|---------|--------------|------------|
| 1st retry | 1,000ms (1s) | 1s |
| 2nd retry | 2,000ms (2s) | 3s |
| 3rd retry | 4,000ms (4s) | 7s |
| 4th retry | 8,000ms (8s) | 15s |

Exponential backoff is ideal for external API calls like email delivery. If Resend is rate-limiting you, waiting longer between each retry gives the service time to recover. The first retry is quick (in case of a transient blip), but subsequent retries back off progressively.

### Fixed Backoff

The report queue in `backend/src/queues/reports.ts` uses fixed backoff:

```typescript
export const reportQueue = new Queue<ReportJobData>("reports", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 5000,
    },
    removeOnComplete: {
      count: 50,
    },
    removeOnFail: {
      count: 200,
    },
  },
});
```

With `type: "fixed"` and `delay: 5000`, every retry waits exactly 5 seconds:

| Attempt | Backoff Delay |
|---------|--------------|
| 1st retry | 5,000ms (5s) |
| 2nd retry | 5,000ms (5s) |

Fixed backoff suits internal operations where the failure cause is likely consistent. If report generation fails because the data source is temporarily unavailable, waiting a flat 5 seconds before retrying is reasonable.

### Why Different Strategies?

The email queue uses 3 attempts with exponential backoff because:
- External APIs have transient failures that resolve quickly
- Rate limiting means you should wait longer between each retry
- Three attempts covers most transient issues without excessive delay

The report queue uses 2 attempts with fixed backoff because:
- Report generation is resource-intensive, so limiting retries conserves resources
- Internal failures tend to be consistent, so there is less benefit to increasing wait times
- A fixed 5-second delay gives the system time to stabilize

### How the Processor Signals Failure

Look at the email processor in `backend/src/jobs/email.ts`:

```typescript
if (resend) {
  const { error } = await resend.emails.send({
    from: "Workshop <onboarding@resend.dev>",
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
```

The key line is `throw new Error(...)`. This is the only way to signal failure in a BullMQ processor. If the function returns normally, the job is marked as completed. If it throws, the job is marked as failed and the retry logic kicks in.

The error message is stored on the job and accessible via the `failedReason` field in the status endpoint.

### Tracking Retries with Events

The worker in `backend/src/worker.ts` logs retry information:

```typescript
emailWorker.on("failed", (job, err) => {
  console.error(
    `[worker:email] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
    err.message
  );
});
```

The `job.attemptsMade` property tells you which attempt just failed. If `attemptsMade` is less than the configured `attempts`, the job will be retried. If they are equal, this is the final failure.

### Job State After Exhausting Retries

When a job exhausts all attempts, it enters the `failed` state permanently. You can see this through the status endpoint:

```bash
curl http://localhost:3002/jobs/email/5
```

```json
{
  "id": "5",
  "name": "send-email",
  "state": "failed",
  "progress": 0,
  "attemptsMade": 3,
  "failedReason": "Resend error: rate limit exceeded",
  "timestamp": 1708300000000
}
```

The `failedReason` contains the error message from the last attempt. The `attemptsMade` shows that all 3 attempts were used.

### Cleanup Policies

Failed and completed jobs accumulate in Redis. Without cleanup, they consume memory indefinitely. The `removeOnComplete` and `removeOnFail` options control this:

```typescript
removeOnComplete: {
  count: 100,  // Keep the last 100 completed jobs
},
removeOnFail: {
  count: 500,  // Keep the last 500 failed jobs
},
```

The email queue keeps 500 failed jobs because they need investigation -- you want to know if emails are consistently failing. It keeps only 100 completed jobs because successful deliveries rarely need review.

The report queue uses lower limits (`50` completed, `200` failed) because reports generate less frequently and each job record is less important to retain long-term.

### Per-Job Override

Default job options apply to all jobs in a queue, but you can override them for individual jobs:

```typescript
// Critical welcome email — retry more aggressively
await emailQueue.add(
  "send-email",
  { to, subject, html },
  {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 500,
    },
  }
);
```

This job will retry up to 5 times with a 500ms base delay, overriding the queue's default of 3 attempts with a 1000ms delay. Use this sparingly for jobs that are more critical than average.

## Step by Step

### Step 1: Simulate a Failing Job

To see retry behavior, temporarily modify the email processor to always fail:

```typescript
export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  throw new Error("Simulated failure for testing retries");
}
```

### Step 2: Enqueue a Job and Watch Retries

Send an email job:

```bash
curl -X POST http://localhost:3002/jobs/email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Retry Test",
    "html": "<p>Testing retries</p>"
  }'
```

Watch the worker output:

```
[worker:email] Job 1 failed (attempt 1): Simulated failure for testing retries
[worker:email] Job 1 failed (attempt 2): Simulated failure for testing retries
[worker:email] Job 1 failed (attempt 3): Simulated failure for testing retries
```

Notice the increasing gap between attempts: approximately 1 second, then 2 seconds, then 4 seconds (exponential backoff).

### Step 3: Inspect the Failed Job

After all retries are exhausted:

```bash
curl http://localhost:3002/jobs/email/1
```

```json
{
  "id": "1",
  "name": "send-email",
  "state": "failed",
  "attemptsMade": 3,
  "failedReason": "Simulated failure for testing retries"
}
```

### Step 4: Check Queue Counts

```bash
curl http://localhost:3002/jobs/counts
```

The `failed` count for the email queue should be 1. As you send more failing jobs, this count increases until it reaches the `removeOnFail.count` limit of 500, at which point the oldest failed jobs are cleaned up.

### Step 5: Restore the Processor

Remove the simulated failure and restore the original processor code. The next job you enqueue will process normally.

## Exercise

Modify the report queue to use exponential backoff with a base delay of 3000ms and 4 retry attempts. Calculate the total time a job will spend in backoff before finally being marked as permanently failed. Then add a custom per-job override for a "monthly" report that uses 6 attempts with a 10-second fixed backoff, since monthly reports are the most critical.

## Summary

- BullMQ retries failed jobs automatically based on the `attempts` and `backoff` configuration
- Exponential backoff doubles the delay between retries, ideal for external API calls with rate limits
- Fixed backoff uses the same delay every time, suited for internal operations
- Throwing an error in the processor signals failure; returning normally signals success
- `removeOnComplete` and `removeOnFail` prevent Redis from accumulating unlimited job records
- Per-job options override queue defaults for individual high-priority or low-priority jobs
- The `failedReason` field on a job stores the error message from the last failed attempt
