# 05 — Scheduled Jobs

Not all jobs are triggered by user actions. Some need to run on a fixed schedule: daily reports, weekly digests, hourly data syncs. BullMQ supports repeatable jobs with cron-like scheduling, delayed jobs that run after a specified interval, and the management of existing schedules. In this lesson, you will set up recurring report generation for the startup directory.

## What You'll Learn

- How to create repeatable jobs using cron patterns
- How to manage and clean up existing repeatable jobs
- The difference between repeated jobs and delayed jobs
- How cron patterns work in BullMQ
- How to schedule jobs at server startup

## Key Concepts

### Repeatable Jobs

A repeatable job is a job that BullMQ creates automatically on a schedule. You define the schedule once, and BullMQ ensures a new job is added to the queue at each interval.

Look at `backend/src/queues/reports.ts`:

```typescript
import { Queue } from "bullmq";
import { connection } from "./connection.js";
import type { ReportJobData } from "../types.js";

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

The report queue has different defaults than the email queue. It uses `attempts: 2` instead of 3, and `fixed` backoff with a 5-second delay instead of exponential. Report generation is heavier, so fewer retries with a longer delay avoids hammering the system when something goes wrong.

### The scheduleReportJobs Function

The scheduling logic lives in the same file:

```typescript
export async function scheduleReportJobs(): Promise<void> {
  // Remove existing repeatable jobs to avoid duplicates
  const repeatableJobs = await reportQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await reportQueue.removeRepeatableByKey(job.key);
  }

  // Daily report — every day at 8:00 AM
  await reportQueue.add(
    "daily-report",
    { reportType: "daily" },
    {
      repeat: {
        pattern: "0 8 * * *",
      },
    }
  );

  // Weekly report — every Monday at 9:00 AM
  await reportQueue.add(
    "weekly-report",
    { reportType: "weekly" },
    {
      repeat: {
        pattern: "0 9 * * 1",
      },
    }
  );

  console.log("[scheduler] Report jobs scheduled");
}
```

This function does three important things:

### Cleaning Up Before Scheduling

```typescript
const repeatableJobs = await reportQueue.getRepeatableJobs();
for (const job of repeatableJobs) {
  await reportQueue.removeRepeatableByKey(job.key);
}
```

Every time the server starts, it removes all existing repeatable jobs before creating new ones. Without this cleanup, restarting the server would create duplicate schedules. If you deployed 5 times in a day, you would have 5 copies of the daily report job running at 8 AM.

The `getRepeatableJobs()` method returns the list of registered schedules, and `removeRepeatableByKey()` deletes each one. This is an idempotent pattern -- run it as many times as you want and the result is the same.

### Cron Patterns

BullMQ uses standard cron syntax for the `repeat.pattern` option:

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, 0 and 7 are Sunday)
│ │ │ │ │
* * * * *
```

The two patterns in our codebase:

- `"0 8 * * *"` -- minute 0, hour 8, every day of month, every month, every day of week. Runs daily at 8:00 AM.
- `"0 9 * * 1"` -- minute 0, hour 9, every day of month, every month, Monday only. Runs every Monday at 9:00 AM.

More examples:

| Pattern | Schedule |
|---------|----------|
| `*/5 * * * *` | Every 5 minutes |
| `0 */2 * * *` | Every 2 hours |
| `0 0 1 * *` | First day of every month at midnight |
| `30 14 * * 1-5` | Weekdays at 2:30 PM |

### Job Data for Scheduled Jobs

Each scheduled job carries a data payload, just like manually enqueued jobs:

```typescript
await reportQueue.add(
  "daily-report",
  { reportType: "daily" },
  { repeat: { pattern: "0 8 * * *" } }
);
```

The job name `"daily-report"` and data `{ reportType: "daily" }` are passed to the worker every time the job fires. The worker does not know or care whether the job was scheduled or manually triggered -- it processes both the same way.

### Scheduling at Server Startup

The `scheduleReportJobs` function is called when the Express server starts, in `backend/src/index.ts`:

```typescript
app.listen(PORT, async () => {
  console.log(`[server] API running on http://localhost:${PORT}`);
  console.log(`[server] Dashboard at http://localhost:${PORT}/dashboard`);

  // Schedule recurring report jobs
  await scheduleReportJobs();
});
```

This ensures that schedules are always registered when the application is running. The cleanup-then-schedule pattern makes it safe to call this on every restart.

### Delayed Jobs

In addition to repeatable (cron) jobs, BullMQ supports one-off delayed jobs. A delayed job runs once, after a specified delay:

```typescript
// Send a follow-up email 24 hours after signup
await emailQueue.add(
  "followup-email",
  {
    to: "founder@example.com",
    subject: "How is your first day on LaunchPad?",
    html: "<p>Need help getting started?</p>",
  },
  {
    delay: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  }
);
```

The job sits in a `delayed` state until the delay period passes, then moves to `waiting` for the next available worker. This is useful for drip campaigns, reminder emails, or any action that should happen "later" relative to a trigger event.

### Repeat vs Delay

| Feature | `repeat` | `delay` |
|---------|----------|---------|
| Runs | On a schedule, indefinitely | Once, after the delay |
| Pattern | Cron expression | Milliseconds |
| Use case | Daily reports, hourly syncs | Follow-up emails, reminders |
| Managed by | BullMQ scheduler | BullMQ delayed set |

## Step by Step

### Step 1: Start the Server and Observe Scheduling

Start the API server:

```bash
npm run dev
```

Look for this line in the output:

```
[scheduler] Report jobs scheduled
```

This confirms that the daily and weekly report schedules are registered in Redis.

### Step 2: Manually Trigger a Report Job

You can also trigger reports on demand through the API. The route in `backend/src/routes/jobs.ts` handles this:

```typescript
router.post("/report", async (req, res) => {
  const { reportType, userId } = req.body as ReportJobData;

  if (!reportType || !["daily", "weekly", "monthly"].includes(reportType)) {
    res.status(400).json({
      error: "Invalid reportType. Must be: daily, weekly, or monthly",
    });
    return;
  }

  const job = await reportQueue.add("generate-report", { reportType, userId });

  res.status(201).json({
    message: "Report job enqueued",
    jobId: job.id,
  });
});
```

Test it:

```bash
curl -X POST http://localhost:3002/jobs/report \
  -H "Content-Type: application/json" \
  -d '{"reportType": "daily"}'
```

### Step 3: Watch the Worker Process the Report

With the worker running in a second terminal, you should see progress updates:

```
[reports] Processing job 1: generating daily report
[reports] Job 1: Gathering data...
[reports] Job 1: Aggregating metrics...
[reports] Job 1: Formatting output...
[reports] Job 1: daily report complete
[worker:reports] Job 1 completed
```

The report processor in `backend/src/jobs/reports.ts` uses `job.updateProgress()` to report progress through three stages. You can poll `GET /jobs/report/:id` to see the progress value change from 33 to 67 to 100.

### Step 4: Trigger a Report for a Specific User

The `ReportJobData` type includes an optional `userId`:

```typescript
export interface ReportJobData {
  reportType: "daily" | "weekly" | "monthly";
  userId?: string;
}
```

Pass a user ID to generate a user-specific report:

```bash
curl -X POST http://localhost:3002/jobs/report \
  -H "Content-Type: application/json" \
  -d '{"reportType": "monthly", "userId": "user-42"}'
```

## Exercise

Add a third scheduled job for a monthly report that runs on the first day of every month at midnight. The cron pattern should be `"0 0 1 * *"` and the job data should be `{ reportType: "monthly" }`. Add this to the `scheduleReportJobs` function in `backend/src/queues/reports.ts`. Then add a delayed job that sends a "LaunchPad weekly highlights" email 7 days after enqueuing, using the email queue with a `delay` option.

## Summary

- Repeatable jobs use cron patterns to run on a schedule indefinitely
- Always clean up existing repeatable jobs before registering new ones to prevent duplicates
- Cron syntax follows the standard five-field format: minute, hour, day of month, month, day of week
- Delayed jobs run once after a specified number of milliseconds
- Scheduled jobs carry the same data payload as manually enqueued jobs
- The worker processes scheduled and manual jobs identically
- Scheduling is registered at server startup for reliability
