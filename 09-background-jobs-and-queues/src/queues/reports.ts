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

// Schedule recurring report jobs
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
