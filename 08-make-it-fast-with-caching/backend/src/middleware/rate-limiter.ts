// Redis-backed sliding window rate limiter

import type { Request, Response, NextFunction } from "express";
import { redis } from "../redis.js";
import type { RateLimitInfo } from "../types.js";

interface RateLimitOptions {
  windowMs: number; // window size in milliseconds
  max: number; // max requests per window
  keyPrefix?: string; // Redis key prefix
  keyGenerator?: (req: Request) => string;
}

/**
 * Rate limiting middleware using Redis sorted sets (sliding window log).
 */
export function rateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyPrefix = "rl",
    keyGenerator = (req) => req.ip || "unknown",
  } = options;

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const clientKey = keyGenerator(req);
    const redisKey = `${keyPrefix}:${clientKey}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use a pipeline for atomicity
      const pipeline = redis.pipeline();

      // Remove entries outside the window
      pipeline.zremrangebyscore(redisKey, 0, windowStart);

      // Count remaining entries in the window
      pipeline.zcard(redisKey);

      // Add current request
      pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);

      // Set expiry on the key
      pipeline.pexpire(redisKey, windowMs);

      const results = await pipeline.exec();

      // zcard result is at index 1
      const requestCount = (results?.[1]?.[1] as number) || 0;

      const resetAt = now + windowMs;
      const remaining = Math.max(0, max - requestCount - 1);

      const info: RateLimitInfo = {
        limit: max,
        remaining,
        resetAt,
      };

      // Set rate limit headers
      res.set("X-RateLimit-Limit", String(info.limit));
      res.set("X-RateLimit-Remaining", String(info.remaining));
      res.set("X-RateLimit-Reset", String(Math.ceil(info.resetAt / 1000)));

      if (requestCount >= max) {
        res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
        res.status(429).json({
          error: "Too Many Requests",
          retryAfter: Math.ceil(windowMs / 1000),
          ...info,
        });
        return;
      }

      next();
    } catch (err) {
      // If Redis is down, allow the request (fail open)
      console.error("Rate limiter error:", err);
      next();
    }
  };
}
