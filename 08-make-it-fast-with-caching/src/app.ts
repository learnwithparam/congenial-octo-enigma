// Express app setup — assembled with all middleware and routes

import express from "express";
import cookieParser from "cookie-parser";
import { productsRouter } from "./routes/products.js";
import { sessionsRouter } from "./routes/sessions.js";
import { benchmarkRouter } from "./routes/benchmark.js";
import { rateLimiter } from "./middleware/rate-limiter.js";
import { sessionMiddleware } from "./middleware/session.js";

export const app = express();

// Body parsing
app.use(express.json());
app.use(cookieParser());

// Global rate limiter: 100 requests per 15 minutes
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyPrefix: "rl:global",
  })
);

// Session middleware for session routes
app.use("/sessions", sessionMiddleware());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/products", productsRouter);
app.use("/sessions", sessionsRouter);
app.use("/benchmark", benchmarkRouter);
