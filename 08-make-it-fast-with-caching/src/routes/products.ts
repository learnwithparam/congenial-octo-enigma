// Product routes with cache-aside, invalidation, and HTTP caching

import { Router } from "express";
import {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  updateProduct,
} from "../db.js";
import { cacheAside, invalidateKey, invalidatePattern } from "../cache.js";
import { httpCache, etag } from "../middleware/http-cache.js";
import type { Product } from "../types.js";

export const productsRouter = Router();

// GET /products — list all products
productsRouter.get(
  "/",
  httpCache({ maxAge: 30, staleWhileRevalidate: 60 }),
  etag(),
  async (_req, res) => {
    const result = await cacheAside<Product[]>(
      "products:all",
      getAllProducts,
      60
    );

    res.set("X-Cache", result.source === "cache" ? "HIT" : "MISS");
    res.set("X-Latency-Ms", String(result.latencyMs));
    res.json({ data: result.data, meta: { source: result.source, latencyMs: result.latencyMs } });
  }
);

// GET /products/category/:category
productsRouter.get(
  "/category/:category",
  httpCache({ maxAge: 30, staleWhileRevalidate: 60 }),
  etag(),
  async (req, res) => {
    const category = req.params.category as string;
    const result = await cacheAside<Product[]>(
      `products:category:${category}`,
      () => getProductsByCategory(category),
      60
    );

    res.set("X-Cache", result.source === "cache" ? "HIT" : "MISS");
    res.set("X-Latency-Ms", String(result.latencyMs));
    res.json({ data: result.data, meta: { source: result.source, latencyMs: result.latencyMs } });
  }
);

// GET /products/:id — single product
productsRouter.get(
  "/:id",
  httpCache({ maxAge: 60, staleWhileRevalidate: 120 }),
  etag(),
  async (req, res) => {
    const id = req.params.id as string;
    const result = await cacheAside<Product | undefined>(
      `products:${id}`,
      () => getProductById(id),
      120
    );

    if (!result.data) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.set("X-Cache", result.source === "cache" ? "HIT" : "MISS");
    res.set("X-Latency-Ms", String(result.latencyMs));
    res.json({ data: result.data, meta: { source: result.source, latencyMs: result.latencyMs } });
  }
);

// PUT /products/:id — update a product and invalidate related caches
productsRouter.put("/:id", async (req, res) => {
  const id = req.params.id as string;
  const updated = await updateProduct(id, req.body);

  if (!updated) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Invalidate specific product cache
  await invalidateKey(`products:${id}`);

  // Invalidate list caches (all products and category lists)
  await invalidatePattern("products:all");
  await invalidatePattern(`products:category:*`);

  res.json({ data: updated, cacheInvalidated: true });
});
