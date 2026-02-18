# 09 — Background Jobs and Queues

Async Processing That Never Drops a Task.

## What You'll Learn

How to move slow, unreliable work out of your request/response cycle using background jobs and message queues. You will set up BullMQ with Redis, build workers, handle retries, and monitor everything through a dashboard.

## Prerequisites

- Comfortable with Node.js and Express
- Basic understanding of async/await
- Docker installed (for Redis)

### Quick Start

```bash
make docker-up   # Start Redis + API
make setup       # Install dependencies (if running without Docker)
make dev         # Start API at http://localhost:3001
```

## Lessons

| # | Lesson | Topic |
|---|--------|-------|
| 01 | [sync-vs-async](./lessons/01-sync-vs-async/) | Why blocking the request thread is a problem |
| 02 | [bullmq-setup](./lessons/02-bullmq-setup/) | Installing BullMQ and connecting to Redis |
| 03 | [first-worker](./lessons/03-first-worker/) | Creating your first background worker |
| 04 | [email-notifications](./lessons/04-email-notifications/) | Sending emails asynchronously with Resend |
| 05 | [scheduled-jobs](./lessons/05-scheduled-jobs/) | Running jobs on a schedule |
| 06 | [retry-backoff](./lessons/06-retry-backoff/) | Handling failures with retries and backoff |
| 07 | [job-dashboard](./lessons/07-job-dashboard/) | Monitoring jobs with a web dashboard |
| 08 | [scaling-workers](./lessons/08-scaling-workers/) | Scaling workers for production workloads |

## Commands

Run `make help` to see all available commands.
