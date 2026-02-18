# 10 — Microservices That Make Sense

Split Your Monolith When (and Only When) It Matters.

## What You'll Learn

How to identify service boundaries, extract services from a monolith, set up an API gateway, and handle cross-service communication. You will also learn health checks, distributed logging, and how to run everything locally.

## Prerequisites

- Familiar with Express, REST APIs, and async/await patterns
- Docker and Docker Compose installed

### Quick Start

```bash
make docker-up       # Start Redis + all services
make setup           # Install dependencies (if running without Docker)
make dev-gateway     # Start gateway at http://localhost:3000
make dev-auth        # Start auth service at http://localhost:3001
make dev-notifications  # Start notification service at http://localhost:3002
```

## Lessons

| # | Lesson | Topic |
|---|--------|-------|
| 01 | [monolith-first](./lessons/01-monolith-first/) | Why you should start with a monolith |
| 02 | [identifying-boundaries](./lessons/02-identifying-boundaries/) | Finding natural service boundaries |
| 03 | [extract-auth](./lessons/03-extract-auth/) | Extracting the auth service |
| 04 | [extract-notifications](./lessons/04-extract-notifications/) | Extracting the notification service |
| 05 | [api-gateway](./lessons/05-api-gateway/) | Building an API gateway |
| 06 | [service-communication](./lessons/06-service-communication/) | How services talk to each other |
| 07 | [shared-nothing](./lessons/07-shared-nothing/) | The shared-nothing architecture principle |
| 08 | [health-checks](./lessons/08-health-checks/) | Implementing health check endpoints |
| 09 | [distributed-logging](./lessons/09-distributed-logging/) | Centralized logging across services |
| 10 | [local-development](./lessons/10-local-development/) | Running all services locally |

## Commands

Run `make help` to see all available commands.
