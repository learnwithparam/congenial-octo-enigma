// Shared types for the caching workshop

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  updatedAt: string;
}

export interface CacheResult<T> {
  data: T;
  source: "cache" | "origin";
  latencyMs: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface SessionData {
  userId: string;
  username: string;
  cart: CartItem[];
  createdAt: string;
  lastAccess: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface BenchmarkResult {
  endpoint: string;
  totalRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  cacheHitRate: number;
}
