// Benchmark route — compare cached vs uncached performance

import { Router } from "express";
import { getAllProducts, getProductById } from "../db.js";
import { cacheAside } from "../cache.js";
import type { BenchmarkResult, Product } from "../types.js";

export const benchmarkRouter = Router();

// GET /benchmark/compare — run N requests cached vs uncached
benchmarkRouter.get("/compare", async (req, res) => {
  const iterations = Math.min(Number(req.query.n) || 10, 100);

  // Uncached: direct DB calls
  const uncachedLatencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await getAllProducts();
    uncachedLatencies.push(Date.now() - start);
  }

  // Cached: first call populates, rest hit cache
  const cachedLatencies: number[] = [];
  let cacheHits = 0;
  for (let i = 0; i < iterations; i++) {
    const result = await cacheAside<Product[]>(
      "benchmark:products",
      getAllProducts,
      30
    );
    cachedLatencies.push(result.latencyMs);
    if (result.source === "cache") cacheHits++;
  }

  const avg = (arr: number[]) =>
    arr.reduce((a, b) => a + b, 0) / arr.length;

  const p95 = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)];
  };

  const uncached: BenchmarkResult = {
    endpoint: "GET /products (uncached)",
    totalRequests: iterations,
    avgLatencyMs: Math.round(avg(uncachedLatencies)),
    p95LatencyMs: p95(uncachedLatencies),
    cacheHitRate: 0,
  };

  const cached: BenchmarkResult = {
    endpoint: "GET /products (cached)",
    totalRequests: iterations,
    avgLatencyMs: Math.round(avg(cachedLatencies)),
    p95LatencyMs: p95(cachedLatencies),
    cacheHitRate: Math.round((cacheHits / iterations) * 100),
  };

  const speedup =
    uncached.avgLatencyMs > 0
      ? Math.round(uncached.avgLatencyMs / Math.max(cached.avgLatencyMs, 1))
      : 0;

  res.json({
    iterations,
    uncached,
    cached,
    speedup: `${speedup}x faster with cache`,
  });
});

// GET /benchmark/single/:id — benchmark a single product lookup
benchmarkRouter.get("/single/:id", async (req, res) => {
  const id = req.params.id as string;
  const iterations = Math.min(Number(req.query.n) || 10, 100);

  const uncachedLatencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await getProductById(id);
    uncachedLatencies.push(Date.now() - start);
  }

  const cachedLatencies: number[] = [];
  let cacheHits = 0;
  for (let i = 0; i < iterations; i++) {
    const result = await cacheAside<Product | undefined>(
      `benchmark:product:${id}`,
      () => getProductById(id),
      30
    );
    cachedLatencies.push(result.latencyMs);
    if (result.source === "cache") cacheHits++;
  }

  const avg = (arr: number[]) =>
    arr.reduce((a, b) => a + b, 0) / arr.length;

  res.json({
    productId: id,
    iterations,
    uncachedAvgMs: Math.round(avg(uncachedLatencies)),
    cachedAvgMs: Math.round(avg(cachedLatencies)),
    cacheHitRate: `${Math.round((cacheHits / iterations) * 100)}%`,
  });
});
