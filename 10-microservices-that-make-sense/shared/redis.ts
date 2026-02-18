// Shared Redis connection using ioredis

import { Redis } from "ioredis";
import { createLogger } from "./logger.js";

const logger = createLogger("redis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export function createRedisConnection(name: string): Redis {
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    lazyConnect: true,
  });

  redis.on("connect", () => {
    logger.info({ connection: name }, "Redis connected");
  });

  redis.on("error", (err) => {
    logger.error({ connection: name, err: err.message }, "Redis error");
  });

  redis.on("close", () => {
    logger.info({ connection: name }, "Redis disconnected");
  });

  return redis;
}

// Default shared connection
let sharedConnection: Redis | null = null;

export function getRedis(): Redis {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection("shared");
  }
  return sharedConnection;
}

export async function closeRedis(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
}
