import "dotenv/config";
import express from "express";
import jobRoutes from "./routes/jobs.js";
import { setupDashboard } from "./dashboard.js";
import { scheduleReportJobs } from "./queues/reports.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3002", 10);

// Middleware
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Job routes
app.use("/jobs", jobRoutes);

// Bull Board dashboard
const dashboard = setupDashboard();
app.use("/dashboard", dashboard.getRouter());

// Start server
app.listen(PORT, async () => {
  console.log(`[server] API running on http://localhost:${PORT}`);
  console.log(`[server] Dashboard at http://localhost:${PORT}/dashboard`);

  // Schedule recurring report jobs
  await scheduleReportJobs();
});
