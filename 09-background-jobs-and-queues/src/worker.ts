import "dotenv/config";
import { Worker } from "bullmq";
import { connection } from "./queues/connection.js";
import { processEmailJob } from "./jobs/email.js";
import { processReportJob } from "./jobs/reports.js";
import type { EmailJobData, ReportJobData } from "./types.js";

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "3", 10);

// Email worker
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

// Report worker
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

reportWorker.on("completed", (job) => {
  console.log(`[worker:reports] Job ${job.id} completed`);
});

reportWorker.on("failed", (job, err) => {
  console.error(
    `[worker:reports] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
    err.message
  );
});

reportWorker.on("error", (err) => {
  console.error("[worker:reports] Worker error:", err);
});

console.log(`[worker] Started with concurrency: ${CONCURRENCY}`);
console.log("[worker] Listening for jobs on queues: email, reports");

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log("[worker] Shutting down gracefully...");
  await Promise.all([emailWorker.close(), reportWorker.close()]);
  console.log("[worker] All workers closed");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
