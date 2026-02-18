// Auth microservice — standalone Express app on port 3001

import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { createLogger } from "../../shared/logger.js";
import { getRedis, closeRedis } from "../../shared/redis.js";
import {
  createHealthRouter,
  redisHealthCheck,
} from "../../shared/health.js";
import { correlationId } from "../../shared/middleware/correlation-id.js";
import { requestLogger } from "../../shared/middleware/request-logger.js";
import { errorHandler } from "../../shared/middleware/error-handler.js";
import type { User, ServiceConfig } from "../../shared/types.js";

const logger = createLogger("auth-service");

const config: ServiceConfig = {
  name: "auth-service",
  port: parseInt(process.env.AUTH_PORT || "3001", 10),
  version: "1.0.0",
};

const app = express();

// --- Middleware ---
app.use(express.json());
app.use(correlationId);
app.use(requestLogger(logger));

// --- Health check ---
const redis = getRedis();

app.use(
  createHealthRouter(config, [
    { name: "redis", check: redisHealthCheck(redis) },
  ])
);

// --- In-memory user store (for workshop purposes) ---
const users = new Map<string, User & { password: string }>();
const sessions = new Map<string, string>(); // token -> userId

// --- Routes ---

// Register
app.post("/auth/register", (req, res) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: "email, name, and password are required" });
    return;
  }

  const existing = Array.from(users.values()).find((u) => u.email === email);
  if (existing) {
    res.status(409).json({ error: "User already exists" });
    return;
  }

  const user: User & { password: string } = {
    id: crypto.randomUUID(),
    email,
    name,
    password, // In production, hash this!
    createdAt: new Date().toISOString(),
  };

  users.set(user.id, user);
  logger.info({ userId: user.id, email }, "User registered");

  const token = crypto.randomUUID();
  sessions.set(token, user.id);

  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name },
    token,
  });
});

// Login
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  const user = Array.from(users.values()).find(
    (u) => u.email === email && u.password === password
  );

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = crypto.randomUUID();
  sessions.set(token, user.id);

  logger.info({ userId: user.id }, "User logged in");

  res.json({
    user: { id: user.id, email: user.email, name: user.name },
    token,
  });
});

// Verify token (used by other services)
app.get("/auth/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid token" });
    return;
  }

  const token = authHeader.slice(7);
  const userId = sessions.get(token);

  if (!userId) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const user = users.get(userId);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({ userId: user.id, email: user.email });
});

// Get current user profile
app.get("/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid token" });
    return;
  }

  const token = authHeader.slice(7);
  const userId = sessions.get(token);

  if (!userId) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const user = users.get(userId);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({ id: user.id, email: user.email, name: user.name });
});

// Logout
app.post("/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    sessions.delete(token);
  }

  res.json({ message: "Logged out" });
});

// --- Error handler ---
app.use(errorHandler(logger));

// --- Start server ---
const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, service: config.name },
    "Auth service started"
  );
});

// --- Graceful shutdown ---
async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down auth service");
  server.close();
  await closeRedis();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app };
