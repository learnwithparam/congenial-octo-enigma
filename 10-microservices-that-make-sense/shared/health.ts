// Health check endpoint factory

import { Router } from "express";
import type { Redis } from "ioredis";
import type { HealthStatus, HealthCheck, ServiceConfig } from "./types.js";
import { createLogger } from "./logger.js";

const logger = createLogger("health");

interface HealthDependency {
  name: string;
  check: () => Promise<HealthCheck>;
}

/**
 * Creates a Redis health check function
 */
export function redisHealthCheck(redis: Redis): () => Promise<HealthCheck> {
  return async () => {
    const start = Date.now();
    try {
      const result = await redis.ping();
      return {
        status: result === "PONG" ? "pass" : "fail",
        responseTime: Date.now() - start,
      };
    } catch (err) {
      return {
        status: "fail",
        responseTime: Date.now() - start,
        message: err instanceof Error ? err.message : "Redis ping failed",
      };
    }
  };
}

/**
 * Creates a health check router for a service
 */
export function createHealthRouter(
  config: ServiceConfig,
  dependencies: HealthDependency[] = []
): Router {
  const router = Router();
  const startTime = Date.now();

  router.get("/health", async (_req, res) => {
    const checks: Record<string, HealthCheck> = {};

    for (const dep of dependencies) {
      try {
        checks[dep.name] = await dep.check();
      } catch (err) {
        checks[dep.name] = {
          status: "fail",
          message: err instanceof Error ? err.message : "Check failed",
        };
      }
    }

    const allPass = Object.values(checks).every((c) => c.status === "pass");
    const anyFail = Object.values(checks).some((c) => c.status === "fail");

    let status: HealthStatus["status"] = "healthy";
    if (anyFail) status = "unhealthy";
    else if (!allPass && dependencies.length > 0) status = "degraded";

    const healthStatus: HealthStatus = {
      status,
      service: config.name,
      version: config.version,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks,
    };

    const httpStatus = status === "healthy" ? 200 : 503;
    logger.debug({ service: config.name, status }, "Health check");
    res.status(httpStatus).json(healthStatus);
  });

  return router;
}
