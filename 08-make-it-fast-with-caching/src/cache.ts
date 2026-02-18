// Cache-aside pattern utilities with invalidation support

import { redis } from "./redis.js";
import type { CacheResult } from "./types.js";

const DEFAULT_TTL = 60; // seconds

/**
 * Cache-aside: check cache first, fall back to origin function,
 * then populate cache for next time.
 */
export async function cacheAside<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<CacheResult<T>> {
  const start = Date.now();

  // 1. Try cache
  const cached = await redis.get(key);
  if (cached !== null) {
    return {
      data: JSON.parse(cached) as T,
      source: "cache",
      latencyMs: Date.now() - start,
    };
  }

  // 2. Cache miss — fetch from origin
  const data = await fetchFn();

  // 3. Populate cache
  await redis.set(key, JSON.stringify(data), "EX", ttl);

  return {
    data,
    source: "origin",
    latencyMs: Date.now() - start,
  };
}

/**
 * Invalidate a single cache key.
 */
export async function invalidateKey(key: string): Promise<void> {
  await redis.del(key);
}

/**
 * Invalidate all keys matching a pattern (e.g., "products:*").
 * Uses SCAN to avoid blocking Redis.
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  let cursor = "0";
  let deleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== "0");

  return deleted;
}
