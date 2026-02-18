import express from "express";
import healthRouter from "./routes/health.js";
import startupsRouter from "./routes/startups.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";

const app = express();

// Built-in middleware
app.use(express.json());

// Custom middleware
app.use(requestLogger);

// Routes
app.use("/health", healthRouter);
app.use("/api/startups", startupsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
