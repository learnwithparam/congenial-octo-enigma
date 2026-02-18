# 08 -- Make It Fast with Caching

Redis, HTTP Caching, and Performance Patterns.

## What You'll Learn

How to make your applications fast with caching -- from understanding why things are slow, to implementing cache-aside with Redis, HTTP caching headers, rate limiting, session stores, and measuring real performance gains.

## Prerequisites

- Familiar with Express and REST APIs
- Docker installed for running Redis locally
- Node.js 20+ installed

### Quick Start

```bash
make docker-up   # Start Redis + API
make setup       # Install dependencies (if running without Docker)
make dev         # Start API at http://localhost:3001
```

## Lessons

| # | Lesson | Topic |
|---|--------|-------|
| 01 | [why-things-are-slow](./lessons/01-why-things-are-slow/) | Identify common performance bottlenecks |
| 02 | [docker-redis](./lessons/02-docker-redis/) | Run Redis in Docker |
| 03 | [cache-aside](./lessons/03-cache-aside/) | Implement the cache-aside pattern |
| 04 | [cache-invalidation](./lessons/04-cache-invalidation/) | Invalidate stale data correctly |
| 05 | [http-caching](./lessons/05-http-caching/) | Use Cache-Control, ETags, and CDN caching |
| 06 | [rate-limiting](./lessons/06-rate-limiting/) | Protect APIs with Redis-backed rate limits |
| 07 | [session-store](./lessons/07-session-store/) | Store sessions in Redis instead of memory |
| 08 | [performance-benchmarks](./lessons/08-performance-benchmarks/) | Measure and prove your performance gains |

## Commands

Run `make help` to see all available commands.
