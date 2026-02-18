// Redis client setup using ioredis

import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL);

redis.on("connect", () => {
  console.log("Connected to Redis");
});

redis.on("error", (err: Error) => {
  console.error("Redis connection error:", err.message);
});

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
