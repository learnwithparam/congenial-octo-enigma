import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { redis } from "../src/redis.js";
import { cacheAside, invalidateKey, invalidatePattern } from "../src/cache.js";

describe("cache-aside", () => {
  beforeEach(async () => {
    // Clean up test keys
    const keys = await redis.keys("test:*");
    if (keys.length > 0) await redis.del(...keys);
  });

  afterAll(async () => {
    const keys = await redis.keys("test:*");
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
  });

  it("should fetch from origin on cache miss", async () => {
    const result = await cacheAside("test:miss", async () => ({ value: 42 }));

    expect(result.source).toBe("origin");
    expect(result.data).toEqual({ value: 42 });
  });

  it("should return cached data on cache hit", async () => {
    // First call — populates cache
    await cacheAside("test:hit", async () => ({ value: 1 }));

    // Second call — should hit cache
    const result = await cacheAside("test:hit", async () => ({ value: 999 }));

    expect(result.source).toBe("cache");
    expect(result.data).toEqual({ value: 1 }); // original, not 999
  });

  it("should invalidate a specific key", async () => {
    await cacheAside("test:inv", async () => "hello");
    await invalidateKey("test:inv");

    const result = await cacheAside("test:inv", async () => "world");
    expect(result.source).toBe("origin");
    expect(result.data).toBe("world");
  });

  it("should invalidate keys by pattern", async () => {
    await cacheAside("test:pattern:a", async () => "a");
    await cacheAside("test:pattern:b", async () => "b");

    const deleted = await invalidatePattern("test:pattern:*");
    expect(deleted).toBe(2);
  });
});
