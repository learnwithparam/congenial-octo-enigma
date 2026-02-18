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
