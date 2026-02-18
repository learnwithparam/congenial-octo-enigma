# 07 — Job Dashboard

Logging to the console is fine during development, but in production you need a visual way to monitor queues, inspect jobs, retry failures, and understand throughput. Bull Board is a web-based dashboard that mounts directly into your Express application and gives you real-time visibility into every queue. In this lesson, you will set up Bull Board, explore its features, and learn how to use it for debugging.

## What You'll Learn

- How to install and configure Bull Board with Express
- How to register queues with the dashboard
- How to inspect job states, data, and error details
- How to retry failed jobs from the dashboard
- How the dashboard fits into the application architecture

## Key Concepts

### What Is Bull Board?

Bull Board is a UI library that provides a web dashboard for BullMQ queues. It shows:

- All registered queues and their job counts
- Individual job details: data, state, progress, timestamps, error messages
- The ability to retry, remove, or clean jobs directly from the UI
- Real-time updates as jobs move through their lifecycle

It consists of three packages:
- `@bull-board/api` -- the core logic that reads queue data
- `@bull-board/api/bullMQAdapter` -- the adapter for BullMQ (as opposed to Bull or other queue libraries)
- `@bull-board/express` -- the Express middleware that serves the dashboard UI

### Setting Up the Dashboard

The dashboard configuration lives in `backend/src/dashboard.ts`:

```typescript
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "./queues/email.js";
import { reportQueue } from "./queues/reports.js";

export function setupDashboard(): ExpressAdapter {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/dashboard");

  createBullBoard({
    queues: [
      new BullMQAdapter(emailQueue),
      new BullMQAdapter(reportQueue),
    ],
    serverAdapter,
  });

  return serverAdapter;
}
```

Let's break this down:

### The ExpressAdapter

```typescript
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/dashboard");
```

The `ExpressAdapter` creates Express-compatible middleware that serves the Bull Board UI. The `setBasePath` call tells the UI where it is mounted -- this must match the path used in `app.use()`.

### Registering Queues

```typescript
createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(reportQueue),
  ],
  serverAdapter,
});
```

Each queue you want to monitor is wrapped in a `BullMQAdapter` and passed to `createBullBoard`. The dashboard reads directly from the same Redis connection that the queues use, so it always shows live data.

If you add a new queue to your application, you must also add it here for it to appear in the dashboard.

### Mounting in Express

In `backend/src/index.ts`, the dashboard is mounted at the `/dashboard` path:

```typescript
import { setupDashboard } from "./dashboard.js";

const dashboard = setupDashboard();
app.use("/dashboard", dashboard.getRouter());
```

The `getRouter()` method returns a standard Express router that handles all dashboard routes: the main page, API endpoints for fetching queue data, and static assets for the UI.

### Dashboard URL

When the server starts, it logs the dashboard URL:

```typescript
app.listen(PORT, async () => {
  console.log(`[server] API running on http://localhost:${PORT}`);
  console.log(`[server] Dashboard at http://localhost:${PORT}/dashboard`);
  await scheduleReportJobs();
});
```

Open `http://localhost:3002/dashboard` in your browser to access the dashboard.

### What You See in the Dashboard

The dashboard displays a sidebar with all registered queues. Clicking a queue shows:

**Queue Overview:**
- Count of jobs in each state: waiting, active, completed, failed, delayed, paused
- A visual timeline of recent job activity

**Job List:**
- Sortable and filterable list of jobs
- Each job shows its ID, name, state, and timestamps

**Job Detail (click on a job):**
- The full job data payload (the JSON you passed to `queue.add()`)
- Attempt history and error messages for failed jobs
- Progress value for jobs that report progress
- Timestamps: created, processed, finished
- Backoff and retry configuration

### Debugging Failed Jobs

The dashboard is most valuable when things go wrong. When an email fails to send:

1. Open the dashboard and click the "email" queue
2. Filter by "Failed" state
3. Click on the failed job
4. Read the `failedReason` -- this is the error message from the processor
5. Check `attemptsMade` to see how many retries were attempted
6. Review the job data to verify the payload is correct

From the dashboard, you can also:
- **Retry** a failed job -- moves it back to the waiting state for reprocessing
- **Remove** a job -- deletes it from Redis entirely
- **Clean** a queue -- bulk-remove jobs in a specific state

### Production Considerations

In production, you should protect the dashboard with authentication. Bull Board does not include built-in auth, so you need to add Express middleware before the dashboard route:

```typescript
// Example: basic authentication for the dashboard
app.use("/dashboard", (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.DASHBOARD_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}, dashboard.getRouter());
```

Without authentication, anyone who can reach your server can view job data and manipulate queues.

## Step by Step

### Step 1: Install Bull Board Packages

The project already includes these in `backend/package.json`:

```json
{
  "dependencies": {
    "@bull-board/api": "^6.0.0",
    "@bull-board/express": "^6.0.0"
  }
}
```

These are installed as part of `npm install` or `make setup`.

### Step 2: Start the Server

```bash
npm run dev
```

Look for:

```
[server] Dashboard at http://localhost:3002/dashboard
```

### Step 3: Open the Dashboard

Navigate to `http://localhost:3002/dashboard` in your browser. You should see the Bull Board interface with two queues listed: "email" and "reports".

### Step 4: Generate Some Jobs

Create a few jobs to populate the dashboard:

```bash
# Send several email jobs
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:3002/jobs/email \
    -H "Content-Type: application/json" \
    -d "{\"to\": \"user${i}@example.com\", \"subject\": \"Test ${i}\", \"html\": \"<p>Email ${i}</p>\"}"
done

# Trigger a report
curl -s -X POST http://localhost:3002/jobs/report \
  -H "Content-Type: application/json" \
  -d '{"reportType": "weekly", "userId": "user-1"}'
```

### Step 5: Explore Job Details

Refresh the dashboard. You should see:
- The "email" queue with 5 completed (or processing) jobs
- The "reports" queue with 1 completed job plus the scheduled repeatable jobs

Click on any job to see its full data, timestamps, and processing details. For the report job, you should see the progress value at 100 if processing is complete.

### Step 6: Use the Counts API

The dashboard visualizes the same data available through the API. Compare the dashboard view with the API response:

```bash
curl http://localhost:3002/jobs/counts
```

```json
{
  "email": {
    "waiting": 0,
    "active": 0,
    "completed": 5,
    "failed": 0,
    "delayed": 0
  },
  "reports": {
    "waiting": 0,
    "active": 0,
    "completed": 1,
    "failed": 0,
    "delayed": 0
  }
}
```

Both the dashboard and the API read from the same Redis data.

## Exercise

Add authentication middleware to protect the dashboard route. Use an environment variable `DASHBOARD_TOKEN` and check the `Authorization` header. When the token is missing or incorrect, return a 401 response. Test by accessing the dashboard without the token (should fail) and with the correct token using a browser extension or curl.

## Summary

- Bull Board provides a web UI for monitoring BullMQ queues in real time
- Setup requires three packages: `@bull-board/api`, the BullMQ adapter, and the Express adapter
- Each queue must be wrapped in a `BullMQAdapter` and registered with `createBullBoard`
- The dashboard mounts as Express middleware at a configurable path
- You can inspect job data, error messages, progress, and retry history from the UI
- Failed jobs can be retried or removed directly through the dashboard
- In production, always protect the dashboard with authentication middleware
