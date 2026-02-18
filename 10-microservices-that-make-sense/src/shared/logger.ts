// Shared Pino logger with child loggers per service

import { pino } from "pino";

const baseLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createLogger(service: string) {
  return baseLogger.child({ service });
}

export { baseLogger as logger };
