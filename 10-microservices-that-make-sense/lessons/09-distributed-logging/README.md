# 09 — Distributed Logging

In a monolith, following a request through the code is straightforward: one process, one log stream, one stack trace. In a microservices architecture, a single user action can generate log entries in three different services running on three different machines. Without a strategy for connecting these log entries, debugging becomes a guessing game. This lesson covers structured logging with Pino, correlation IDs that thread across service boundaries, log levels for controlling verbosity, and patterns for aggregating logs from multiple services.

## What You'll Learn

- Why structured (JSON) logging is essential for microservices
- How to use Pino for high-performance structured logging in Node.js
- How correlation IDs propagate through the gateway, auth-service, and notification-service
- How log levels (trace, debug, info, warn, error, fatal) control output verbosity
- How to aggregate and search logs from multiple services in production

## Key Concepts

### Why Structured Logging

Traditional text-based logging produces human-readable but machine-unfriendly output:

```
[2025-01-15 10:30:00] INFO: User logged in - userId=abc-123 email=user@example.com
```

Parsing this with a regex is fragile. Different log messages have different formats. Searching for all logs related to a specific user requires pattern matching that breaks when the format changes.

Structured logging produces JSON:

```json
{"level":"info","time":"2025-01-15T10:30:00.000Z","service":"auth-service","userId":"abc-123","email":"user@example.com","msg":"User logged in"}
```

Every field is a key-value pair. Log aggregation tools (Elasticsearch, Datadog, CloudWatch) can index each field independently. You can query for all logs where service equals "auth-service" and userId equals "abc-123" without regex. You can build dashboards that count error-level logs per service. You can alert when the rate of errors in a specific service exceeds a threshold.

### Pino Logger Configuration

Our project uses Pino, the fastest JSON logger for Node.js. The shared/logger.ts module creates a base logger and a factory function for service-specific child loggers:

```ts
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
```

Several design decisions deserve explanation.

The log level is configurable through the LOG_LEVEL environment variable, defaulting to "info." This means debug and trace messages are suppressed unless explicitly enabled. In production, you typically run at "info" or "warn." When debugging an issue, you can set LOG_LEVEL=debug on a single service instance without restarting all services.

The transport option uses pino-pretty during development. pino-pretty formats JSON log lines into colorized, human-readable output in the terminal. In production (NODE_ENV=production), the transport is undefined, which means Pino writes raw JSON to stdout. This is intentional: log aggregation tools expect JSON, and pino-pretty would add overhead and break machine parsing.

The base option is set to undefined, which removes Pino's default fields (hostname, pid) from every log line. Our services run in containers where the hostname is a random Docker ID and the PID is always 1. These fields add noise without value. The service field, added by the child logger, is far more useful.

The timestamp uses pino.stdTimeFunctions.isoTime, producing ISO 8601 timestamps like "2025-01-15T10:30:00.000Z." This format is universally parseable and timezone-unambiguous.

The createLogger function creates a child logger with the service name baked in. Every log line from the auth-service automatically includes "service":"auth-service" without the developer needing to add it manually:

```ts
// In auth-service/src/index.ts
const logger = createLogger("auth-service");

// Every call to logger.info, logger.error, etc. includes service:"auth-service"
logger.info({ userId: user.id, email }, "User registered");
// Output: {"level":"info","time":"...","service":"auth-service","userId":"abc-123","email":"user@example.com","msg":"User registered"}
```

### Correlation IDs Across Services

A correlation ID is a unique identifier that follows a request through every service it touches. In our project, the correlation ID middleware generates or extracts this ID:

```ts
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const id =
    (req.headers["x-correlation-id"] as string) || crypto.randomUUID();

  req.correlationId = id;
  res.setHeader("x-correlation-id", id);
  next();
}
```

The flow works like this:

1. A client sends POST /auth/login to the gateway. No x-correlation-id header is present.
2. The gateway's correlationId middleware generates a UUID, say "corr-abc-123."
3. The gateway's requestLogger logs the incoming request with correlationId: "corr-abc-123."
4. The proxy middleware forwards the request to auth-service with the header x-correlation-id: corr-abc-123:

```ts
proxyReq: (proxyReq, req) => {
  const corrId = (req as express.Request).correlationId;
  if (corrId) {
    proxyReq.setHeader("x-correlation-id", corrId);
  }
  proxyReq.setHeader("x-forwarded-by", "gateway");
},
```

5. The auth-service's correlationId middleware finds the existing x-correlation-id header and uses it instead of generating a new one.
6. The auth-service's requestLogger logs the request with the same correlationId: "corr-abc-123."
7. All log entries for this request, across both services, share the same correlation ID.

When debugging, you search your log aggregation tool for correlationId="corr-abc-123" and see every log entry from every service involved in that request, in chronological order.

The correlation ID is also included in error responses:

```ts
res.status(statusCode).json({
  error: message,
  correlationId: req.correlationId,
});
```

When a user reports an error, they can provide the correlation ID from the response. The operations team can then find all related logs instantly.

### Request Logging Middleware

The request logger middleware in shared/middleware/request-logger.ts logs every completed request with timing data:

```ts
export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        correlationId: req.correlationId,
      };

      if (res.statusCode >= 500) {
        logger.error(logData, "Request failed");
      } else if (res.statusCode >= 400) {
        logger.warn(logData, "Request client error");
      } else {
        logger.info(logData, "Request completed");
      }
    });

    next();
  };
}
```

This middleware records the start time when the request begins, then listens for the "finish" event on the response. When the response is sent, it calculates the duration and logs the complete request data.

The log level is chosen based on the status code:

- 500+ is logged at error level (server errors need immediate attention)
- 400-499 is logged at warn level (client errors might indicate a problem)
- 200-399 is logged at info level (successful requests)

This means in production, if you set LOG_LEVEL=warn, you only see client errors and server errors. Successful requests are silently dropped. This dramatically reduces log volume while keeping the important signals.

A typical log entry from the request logger:

```json
{
  "level": "info",
  "time": "2025-01-15T10:30:00.000Z",
  "service": "auth-service",
  "method": "POST",
  "url": "/auth/login",
  "statusCode": 200,
  "duration": 45,
  "correlationId": "corr-abc-123",
  "msg": "Request completed"
}
```

### Log Levels

Pino supports six log levels, from most verbose to least:

- trace (10): extremely detailed debugging, like "entered function X with arguments Y"
- debug (20): detailed internal state, like "session map has 42 entries"
- info (30): normal operations, like "User registered" or "Request completed"
- warn (40): unexpected but handled situations, like "Client sent invalid token" or "Redis response slow (250ms)"
- error (50): failures that need attention, like "Redis connection failed" or "Unhandled error"
- fatal (60): the process is about to crash, like "Cannot bind to port 3001"

In our project, the default level is info. This means trace and debug messages are suppressed. You can override this per service:

```bash
# Show debug logs for auth-service only
AUTH_PORT=3001 LOG_LEVEL=debug npx tsx auth-service/src/index.ts

# Show trace logs for notification-service
NOTIFICATION_PORT=3002 LOG_LEVEL=trace npx tsx notification-service/src/index.ts
```

### Error Logging with Context

The error handler middleware logs errors with full context:

```ts
export function errorHandler(logger: Logger) {
  return (err: AppError, req: Request, res: Response, _next: NextFunction): void => {
    logger.error(
      {
        err: {
          message: err.message,
          stack: err.stack,
          code: err.code,
        },
        method: req.method,
        url: req.originalUrl,
        correlationId: req.correlationId,
      },
      "Unhandled error"
    );

    res.status(statusCode).json({
      error: message,
      correlationId: req.correlationId,
    });
  };
}
```

The logged error object includes the message, stack trace, and error code. The request context (method, URL, correlation ID) is included so you can find the exact request that caused the error. In a log aggregation tool, you can search for level="error" and get every unhandled error across all services, each with enough context to investigate.

### Log Aggregation Patterns

In production, each service writes JSON logs to stdout. From there, several aggregation patterns are common:

Pattern 1 -- Docker log driver. Docker can send container stdout to various destinations. The json-file driver writes to the host filesystem. The fluentd driver sends to a Fluentd collector. The awslogs driver sends directly to CloudWatch.

Pattern 2 -- Sidecar collector. In Kubernetes, a sidecar container (like Fluent Bit) runs alongside each service container, reads its log files, and ships them to a centralized store (Elasticsearch, Loki, CloudWatch).

Pattern 3 -- Direct shipping. The application sends logs directly to the aggregation service using an HTTP transport. Pino supports this through custom transports.

For our LaunchPad project in local development, logs go to the terminal with pino-pretty formatting. In production, they would go to stdout as raw JSON, collected by the container runtime.

### Logging in the Notification Worker

The BullMQ worker in the notification-service demonstrates logging for background job processing:

```ts
const worker = new Worker<NotificationPayload, unknown, string>(
  QUEUE_NAME,
  async (job) => {
    logger.info(
      { jobId: job.id, to: job.data.to, type: job.data.type, subject: job.data.subject },
      "Processing notification"
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    logger.info(
      { jobId: job.id, to: job.data.to, type: job.data.type },
      "Notification sent successfully"
    );

    return { delivered: true, timestamp: new Date().toISOString() };
  },
  { connection: { ...redisConnectionOpts }, concurrency: 5 }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Notification job completed");
});

worker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, err: err.message },
    "Notification job failed"
  );
});
```

Each job is logged with its jobId, which serves as a correlation mechanism for background processing. If you need to trace a notification from the HTTP request that created it to the worker that processed it, you can follow the chain: the HTTP request logs the notificationId (which is the job ID), and the worker logs the same jobId.

## Step by Step

### Step 1: Create the Logger

Use createLogger with your service name. This gives you a child logger that automatically includes the service field in every log entry.

### Step 2: Apply Middleware

Register correlationId middleware first (so every request has an ID), then requestLogger (so every request is logged with timing and the correlation ID).

### Step 3: Log Business Events

At key points in your business logic (user registered, notification queued, payment processed), add log statements with relevant context fields. Use the appropriate level: info for normal events, warn for unexpected-but-handled cases, error for failures.

### Step 4: Handle Errors with Context

Use the errorHandler middleware to catch unhandled errors. The logged error includes the request context (method, URL, correlation ID) so you can trace the failure back to the originating request.

### Step 5: Configure for Environment

Set LOG_LEVEL via environment variables. Use pino-pretty in development for readability. Use raw JSON in production for machine parsing. Configure your container runtime to collect stdout logs.

### Step 6: Search by Correlation ID

When debugging an issue, find the correlation ID (from the error response, from the client, or from a monitoring alert) and search your log aggregation tool for that ID. You will see every log entry from every service involved in that request.

## Exercise

Extend the logging system with these features:

1. Add a custom Pino serializer for the request object that logs the user-agent header, client IP, and content-length. Register it in the base logger configuration.

2. Add a log-rotation mechanism for local development. Use a Pino transport that writes to a file and rotates when it exceeds 10MB.

3. Add request/response body logging at the debug level. When LOG_LEVEL=debug, log the request body on entry and the response body on completion. Be careful not to log passwords: redact the password field from auth requests.

4. Implement a log correlation for BullMQ jobs. When a job is created via the HTTP API, include the HTTP request's correlation ID in the job data. When the worker processes the job, use that correlation ID in its log entries. This connects the HTTP request log to the worker processing log.

5. Create a simple log viewer script that reads JSON log lines from stdin, filters by service name and log level, and formats them with pino-pretty. Test it by piping multiple services' output together.

## Summary

Distributed logging is the observability layer that makes microservices debuggable. Structured JSON logging with Pino produces machine-parseable output that log aggregation tools can index, search, and visualize. Correlation IDs thread through every service boundary, connecting all log entries for a single user request into a traceable chain.

The middleware stack (correlationId, requestLogger, errorHandler) provides automatic logging for every request without cluttering business logic. Log levels give operators control over verbosity: run at info in production, switch to debug when investigating, and use trace for deep internal diagnostics.

In production, logs flow from service stdout through a collection mechanism (Docker log driver, sidecar container, direct shipping) into a centralized store where they can be searched, correlated, and alerted on.

In the next lesson, we put everything together with local development tooling: docker-compose, Makefile orchestration, and techniques for debugging individual services.
