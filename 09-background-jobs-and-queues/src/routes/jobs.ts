import { Router } from "express";
import { emailQueue } from "../queues/email.js";
import { reportQueue } from "../queues/reports.js";
import type { EmailJobData, ReportJobData, JobStatusResponse } from "../types.js";

const router = Router();

// POST /jobs/email — Enqueue an email job
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

// POST /jobs/report — Enqueue a report generation job
router.post("/report", async (req, res) => {
  try {
    const { reportType, userId } = req.body as ReportJobData;

    if (!reportType || !["daily", "weekly", "monthly"].includes(reportType)) {
      res.status(400).json({
        error: "Invalid reportType. Must be: daily, weekly, or monthly",
      });
      return;
    }

    const job = await reportQueue.add("generate-report", {
      reportType,
      userId,
    });

    res.status(201).json({
      message: "Report job enqueued",
      jobId: job.id,
    });
  } catch (error) {
    console.error("[api] Failed to enqueue report job:", error);
    res.status(500).json({ error: "Failed to enqueue report job" });
  }
});

// GET /jobs/email/:id — Check email job status
router.get("/email/:id", async (req, res) => {
  try {
    const job = await emailQueue.getJob(req.params.id);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const state = await job.getState();

    const response: JobStatusResponse = {
      id: job.id!,
      name: job.name,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      timestamp: job.timestamp,
    };

    res.json(response);
  } catch (error) {
    console.error("[api] Failed to get job status:", error);
    res.status(500).json({ error: "Failed to get job status" });
  }
});

// GET /jobs/report/:id — Check report job status
router.get("/report/:id", async (req, res) => {
  try {
    const job = await reportQueue.getJob(req.params.id);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const state = await job.getState();

    const response: JobStatusResponse = {
      id: job.id!,
      name: job.name,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      timestamp: job.timestamp,
    };

    res.json(response);
  } catch (error) {
    console.error("[api] Failed to get job status:", error);
    res.status(500).json({ error: "Failed to get job status" });
  }
});

// GET /jobs/counts — Get queue counts for all queues
router.get("/counts", async (_req, res) => {
  try {
    const [emailCounts, reportCounts] = await Promise.all([
      emailQueue.getJobCounts(),
      reportQueue.getJobCounts(),
    ]);

    res.json({
      email: emailCounts,
      reports: reportCounts,
    });
  } catch (error) {
    console.error("[api] Failed to get job counts:", error);
    res.status(500).json({ error: "Failed to get job counts" });
  }
});

export default router;
