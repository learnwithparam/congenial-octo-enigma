// Notification microservice — Express app + BullMQ worker on port 3002

import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { Queue, Worker, type Job } from "bullmq";
import { createLogger } from "../shared/logger.js";
import { getRedis, closeRedis } from "../shared/redis.js";
import {
  createHealthRouter,
  redisHealthCheck,
} from "../shared/health.js";
import { correlationId } from "../middleware/correlation-id.js";
import { requestLogger } from "../middleware/request-logger.js";
import { errorHandler } from "../middleware/error-handler.js";
import type {
  NotificationPayload,
  NotificationResult,
  ServiceConfig,
} from "../shared/types.js";

const logger = createLogger("notification-service");

const config: ServiceConfig = {
  name: "notification-service",
  port: parseInt(process.env.NOTIFICATION_PORT || "3002", 10),
  version: "1.0.0",
};

const QUEUE_NAME = "notifications";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// BullMQ connection config — uses its own bundled ioredis internally
const redisConnectionOpts = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || "6379", 10),
  maxRetriesPerRequest: null as null,
};

// --- BullMQ Queue ---
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

// --- BullMQ Worker ---
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

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Notification job completed");
});

worker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, err: err.message },
    "Notification job failed"
  );
});

// --- Express app ---
const app = express();

app.use(express.json());
app.use(correlationId);
app.use(requestLogger(logger));

// Health check — uses the shared ioredis connection for ping
const redis = getRedis();
app.use(
  createHealthRouter(config, [
    { name: "redis", check: redisHealthCheck(redis) },
  ])
);

// --- Routes ---

// Send a notification (queues it)
app.post("/notifications/send", async (req, res) => {
  const { to, subject, body, type, userId } = req.body as NotificationPayload;

  if (!to || !subject || !body || !type) {
    res
      .status(400)
      .json({ error: "to, subject, body, and type are required" });
    return;
  }

  const job = await notificationQueue.add("send-notification", {
    to,
    subject,
    body,
    type,
    userId,
  });

  const result: NotificationResult = {
    id: job.id || crypto.randomUUID(),
    status: "queued",
    queuedAt: new Date().toISOString(),
  };

  logger.info({ notificationId: result.id, to, type }, "Notification queued");

  res.status(202).json(result);
});

// Get notification status
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

// Get queue stats
app.get("/notifications/stats", async (_req, res) => {
  const [waiting, active, completed, failed] = await Promise.all([
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
  ]);

  res.json({ waiting, active, completed, failed });
});

// --- Error handler ---
app.use(errorHandler(logger));

// --- Start server ---
const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, service: config.name },
    "Notification service started"
  );
});

// --- Graceful shutdown ---
async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down notification service");
  server.close();
  await worker.close();
  await notificationQueue.close();
  await closeRedis();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app };
