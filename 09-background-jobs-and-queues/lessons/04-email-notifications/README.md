# 04 — Email Notifications

Sending emails is one of the most common reasons to use background jobs. Emails are slow (1-3 seconds per API call), unreliable (external services go down), and the user does not need to wait for them. In this lesson, you will integrate the Resend email service, build an email job processor, and learn patterns for structuring job data.

## What You'll Learn

- How to integrate Resend for sending transactional emails
- How to structure email job data for the queue
- How the email processor handles both live and mock modes
- Patterns for organizing job processors in separate files
- How to enqueue email jobs from API routes

## Key Concepts

### Why Emails Belong in a Queue

Email delivery involves calling a third-party API over the network. This introduces three problems:

1. **Latency** -- each email takes 1-3 seconds to send via an API like Resend, SendGrid, or AWS SES.
2. **Unreliability** -- the email service might be down, rate-limiting you, or returning transient errors.
3. **Volume** -- a single action might trigger dozens of emails (e.g., notifying all investors about a new startup).

By moving emails to a background queue, the API responds in milliseconds regardless of how long delivery takes or whether it succeeds on the first try.

### The Email Job Data Type

Every job carries a data payload. For emails, this is defined in `backend/src/types.ts`:

```typescript
export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}
```

This interface is intentionally simple. It contains everything the worker needs to send the email, without any references to application entities. This decoupling matters: the worker does not need to know about startups, users, or categories. It just sends emails.

If you need to send a welcome email when a startup is registered, the API route constructs the full email content before enqueuing:

```typescript
await emailQueue.add("send-email", {
  to: startup.founderEmail,
  subject: `Welcome to LaunchPad, ${startup.name}!`,
  html: `<h1>Welcome!</h1><p>Your startup ${startup.name} is now listed.</p>`,
});
```

### The Email Queue

The email queue in `backend/src/queues/email.ts` is configured with retry logic and cleanup policies:

```typescript
import { Queue } from "bullmq";
import { connection } from "./connection.js";
import type { EmailJobData } from "../types.js";

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

The `attempts: 3` and `backoff` settings are especially important for email. If Resend returns a transient error (rate limit, server error), the job retries automatically after 1 second, then 2 seconds, then 4 seconds. We keep more failed jobs (`500`) than completed ones (`100`) because failed jobs need investigation.

### The Email Processor

The processor function in `backend/src/jobs/email.ts` handles the actual email delivery:

```typescript
import type { Job } from "bullmq";
import { Resend } from "resend";
import type { EmailJobData } from "../types.js";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, html } = job.data;

  console.log(`[email] Processing job ${job.id}: sending to ${to}`);

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

    console.log(`[email] Job ${job.id}: email sent to ${to}`);
  } else {
    // Mock mode — no RESEND_API_KEY set
    console.log(`[email] Job ${job.id}: (mock) would send to ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  HTML length: ${html.length} chars`);

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
```

There are several important patterns in this code:

### Mock Mode for Development

The processor checks for `RESEND_API_KEY` at module load time. If the key is not set, `resend` is `null` and the processor runs in mock mode -- logging what it would send instead of actually calling the API.

This is a practical pattern for development. You can test the full queue pipeline without needing an email API key, without sending real emails, and without hitting rate limits.

### Error Handling by Throwing

When the Resend API returns an error, the processor throws:

```typescript
if (error) {
  throw new Error(`Resend error: ${error.message}`);
}
```

This is how you tell BullMQ that a job failed. BullMQ catches the thrown error, marks the job as failed, records the error message, and schedules a retry if attempts remain. You never need to manually manage retry logic -- just throw when something goes wrong.

### Resend Integration

Resend is a modern email API designed for developers. The integration is minimal:

```typescript
const resend = new Resend(process.env.RESEND_API_KEY);

const { error } = await resend.emails.send({
  from: "Workshop <onboarding@resend.dev>",
  to,
  subject,
  html,
});
```

The `from` address uses Resend's sandbox domain (`onboarding@resend.dev`), which works for testing without domain verification. In production, you would use your own verified domain.

## Step by Step

### Step 1: Set Up Resend (Optional)

For real email delivery, sign up at resend.com and get an API key. Add it to your `.env`:

```
RESEND_API_KEY=re_xxxxxxxxx
```

Without this key, everything still works in mock mode. The worker logs what it would send instead of calling the API.

### Step 2: Enqueue an Email Job via the API

The route in `backend/src/routes/jobs.ts` handles email job creation:

```typescript
router.post("/email", async (req, res) => {
  try {
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
  } catch (error) {
    console.error("[api] Failed to enqueue email job:", error);
    res.status(500).json({ error: "Failed to enqueue email job" });
  }
});
```

The route validates input, enqueues the job, and returns the job ID. The `"send-email"` string is the job name -- useful for filtering and debugging in the dashboard.

### Step 3: Send a Test Email

With both the API server and worker running:

```bash
curl -X POST http://localhost:3002/jobs/email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "investor@example.com",
    "subject": "New Startup Alert: TechCorp",
    "html": "<h1>New Listing</h1><p>TechCorp just joined LaunchPad in the AI category.</p>"
  }'
```

### Step 4: Check the Job Status

Poll the status endpoint to watch the job progress:

```bash
curl http://localhost:3002/jobs/email/1
```

The response includes the job state and metadata:

```json
{
  "id": "1",
  "name": "send-email",
  "state": "completed",
  "progress": 0,
  "attemptsMade": 1,
  "finishedOn": 1708300001000,
  "processedOn": 1708300000500,
  "timestamp": 1708300000000
}
```

### Step 5: Monitor Queue Counts

Check the overall health of all queues:

```bash
curl http://localhost:3002/jobs/counts
```

```json
{
  "email": {
    "waiting": 0,
    "active": 0,
    "completed": 1,
    "failed": 0,
    "delayed": 0
  },
  "reports": {
    "waiting": 0,
    "active": 0,
    "completed": 0,
    "failed": 0,
    "delayed": 0
  }
}
```

This endpoint is useful for building health checks and monitoring dashboards.

## Exercise

Add a new job name called `"startup-welcome"` to the email queue. Write a helper function that takes a startup name and founder email, constructs the HTML content for a welcome email, and enqueues it. The HTML should include the startup name and a link to a hypothetical dashboard. Test it by calling your helper and checking the worker output.

## Summary

- Email delivery is a classic use case for background jobs due to latency, unreliability, and volume
- The `EmailJobData` interface keeps job payloads simple and self-contained
- The email processor uses mock mode when no API key is configured, making development painless
- Throwing an error in the processor signals failure to BullMQ, which handles retries automatically
- Resend provides a clean API for transactional email with minimal setup
- The API route validates input, enqueues the job, and returns a job ID for status polling
