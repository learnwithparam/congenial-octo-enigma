// API Gateway — proxies requests to auth and notification microservices

import "dotenv/config";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createLogger } from "./shared/logger.js";
import { createHealthRouter } from "./shared/health.js";
import { correlationId } from "./middleware/correlation-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import type { ServiceConfig, ServiceRoute } from "./shared/types.js";

const logger = createLogger("gateway");

const config: ServiceConfig = {
  name: "gateway",
  port: parseInt(process.env.PORT || "3000", 10),
  version: "1.0.0",
};

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3001";
const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3002";

// --- Service routes ---
const routes: ServiceRoute[] = [
  { path: "/auth", target: AUTH_SERVICE_URL, name: "auth-service" },
  {
    path: "/notifications",
    target: NOTIFICATION_SERVICE_URL,
    name: "notification-service",
  },
];

const app = express();

// --- Global middleware ---
app.use(correlationId);
app.use(requestLogger(logger));

// --- Gateway health check (no Redis dependency) ---
app.use(createHealthRouter(config));

// --- Proxy routes ---
for (const route of routes) {
  logger.info(
    { path: route.path, target: route.target },
    "Registering proxy route"
  );

  app.use(
    route.path,
    createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq, req) => {
          // Forward correlation ID to downstream services
          const corrId = (req as express.Request).correlationId;
          if (corrId) {
            proxyReq.setHeader("x-correlation-id", corrId);
          }
          proxyReq.setHeader("x-forwarded-by", "gateway");
        },
        error: (err, _req, res) => {
          logger.error(
            { err: err.message, target: route.target },
            "Proxy error"
          );
          if ("writeHead" in res && typeof res.writeHead === "function") {
            (res as import("http").ServerResponse)
              .writeHead(502, { "Content-Type": "application/json" })
              .end(
                JSON.stringify({
                  error: `Service ${route.name} unavailable`,
                  service: route.name,
                })
              );
          }
        },
      },
    })
  );
}

// --- 404 for unmatched routes ---
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// --- Error handler ---
app.use(errorHandler(logger));

// --- Start server ---
const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, service: config.name, routes: routes.map((r) => r.path) },
    "API Gateway started"
  );
});

// --- Graceful shutdown ---
function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gateway");
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app };
