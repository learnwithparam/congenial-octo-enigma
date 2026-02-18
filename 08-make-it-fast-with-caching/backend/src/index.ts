// Entry point — load env vars and start the server

import "dotenv/config";
import { app } from "./app.js";
import { disconnectRedis } from "./redis.js";

const PORT = Number(process.env.PORT) || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log("\nShutting down...");
  server.close();
  await disconnectRedis();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
