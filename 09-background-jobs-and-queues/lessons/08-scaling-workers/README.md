# 08 — Scaling Workers

A single worker process can handle hundreds of jobs per minute for most workloads. But when your startup directory grows and you are sending thousands of emails, generating reports for hundreds of users, and processing file uploads simultaneously, one worker is not enough. In this lesson, you will learn strategies for scaling BullMQ workers horizontally, managing Redis connections under load, and deploying workers in production.

## What You'll Learn

- How to run multiple worker processes for the same queue
- How BullMQ distributes jobs across competing workers
- How concurrency and worker count interact
- Connection pooling and Redis resource management
- Deploying workers with Docker and process managers
- Strategies for separating API and worker deployments

## Key Concepts

### Horizontal Scaling with Multiple Workers

BullMQ workers use Redis-based locking to ensure that each job is delivered to exactly one worker. This means you can start multiple instances of `backend/src/worker.ts` and they will automatically share the workload.

Start three worker processes in separate terminals:

```bash
# Terminal 1
npm run worker

# Terminal 2
npm run worker

# Terminal 3
npm run worker
```

Each worker connects to the same Redis instance and competes for jobs on the `email` and `reports` queues. When a new job arrives, whichever worker claims the Redis lock first gets to process it.

There is no coordination code required. BullMQ handles job distribution atomically using Redis BRPOPLPUSH (or its modern equivalent, BLMOVE). This guarantees:
- Each job is processed exactly once
- No two workers process the same job simultaneously
- If a worker crashes mid-job, BullMQ detects the stale lock and re-queues the job

### Concurrency vs Worker Count

There are two dimensions to scaling:

1. **Concurrency** -- how many jobs a single worker handles in parallel (configured per worker)
2. **Worker count** -- how many worker processes are running

These multiply together. Look at the email worker configuration in `backend/src/worker.ts`:

```typescript
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "3", 10);

const emailWorker = new Worker<EmailJobData>(
  "email",
  async (job) => {
    await processEmailJob(job);
  },
  {
    connection,
    concurrency: CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);
```

With default concurrency of 3:

| Workers | Concurrency | Max Parallel Jobs |
|---------|------------|-------------------|
| 1 | 3 | 3 |
| 2 | 3 | 6 |
| 3 | 3 | 9 |
| 5 | 3 | 15 |

For I/O-bound work (like sending emails), higher concurrency is efficient because the CPU is idle while waiting for API responses. For CPU-bound work (like report generation), concurrency should stay at 1 and you scale by adding more worker processes.

### Rate Limiting Across Workers

The rate limiter on the email worker is per-worker, not global:

```typescript
limiter: {
  max: 10,
  duration: 1000,
}
```

With 3 workers, the effective rate limit is 30 jobs per second (10 per worker). If the downstream API (like Resend) has a global rate limit, you need to account for the total across all workers.

For global rate limiting, BullMQ offers a queue-level rate limiter:

```typescript
const emailQueue = new Queue("email", {
  connection,
  limiter: {
    max: 20,
    duration: 1000,
  },
});
```

This limits the entire queue to 20 jobs per second, regardless of how many workers are consuming from it.

### Redis Connection Management

Each worker opens multiple Redis connections. A single Worker instance typically uses 2-3 connections: one for command execution, one for blocking operations (listening for new jobs), and sometimes one for events.

With many workers, Redis connections add up. The connection module in `backend/src/queues/connection.ts` sets `maxRetriesPerRequest: null`:

```typescript
function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
    maxRetriesPerRequest: null,
  };
}
```

This is critical for worker stability. The default ioredis behavior is to throw an error after a fixed number of retries, which would crash your worker on any transient Redis hiccup. Setting it to `null` means ioredis retries indefinitely, which is what you want for a long-running worker process.

For production environments with many workers, monitor these Redis metrics:
- **Connected clients** -- each worker adds 2-3 connections
- **Memory usage** -- job data is stored in Redis
- **Command rate** -- more workers means more Redis operations per second

### Graceful Shutdown in Production

When scaling with multiple workers, graceful shutdown becomes even more important. The shutdown handler in `backend/src/worker.ts` ensures that in-flight jobs complete before the process exits:

```typescript
async function shutdown(): Promise<void> {
  console.log("[worker] Shutting down gracefully...");
  await Promise.all([emailWorker.close(), reportWorker.close()]);
  console.log("[worker] All workers closed");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

In Kubernetes, Docker Swarm, or any orchestration platform, the container runtime sends SIGTERM before killing a process. This handler catches that signal and drains the workers cleanly. Without it, jobs would be abandoned mid-processing and eventually retried by another worker (if retries are configured).

### Separating API and Workers

In our codebase, the API server (`src/index.ts`) and the worker (`src/worker.ts`) are separate entry points. This is intentional and important for production:

**API process (`npm run dev`):**
- Handles HTTP requests
- Enqueues jobs via Queue.add()
- Serves the Bull Board dashboard
- Scales based on request volume

**Worker process (`npm run worker`):**
- Processes jobs from queues
- Runs processor functions
- Scales based on job volume

These can be deployed independently. If email volume spikes, you add more worker containers without touching the API. If request volume spikes, you add more API containers without affecting workers. The only shared dependency is Redis.

### Docker Deployment

The project includes a `Dockerfile` for containerized deployment:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
EXPOSE 3001
CMD ["npm", "run", "dev"]
```

For production, you would create separate containers for the API and worker:

```yaml
# docker-compose.yml for production-like setup
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  api:
    build: .
    command: npm run dev
    ports:
      - "3001:3001"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  worker:
    build: .
    command: npm run worker
    environment:
      - REDIS_URL=redis://redis:6379
      - WORKER_CONCURRENCY=5
    depends_on:
      - redis

  worker-2:
    build: .
    command: npm run worker
    environment:
      - REDIS_URL=redis://redis:6379
      - WORKER_CONCURRENCY=5
    depends_on:
      - redis

volumes:
  redisdata:
```

This runs two worker containers alongside one API container. Each worker processes up to 5 email jobs in parallel. The `WORKER_CONCURRENCY` environment variable is read by the worker:

```typescript
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "3", 10);
```

### Scaling Strategies

Different queue types benefit from different scaling approaches:

**Email queue (I/O-bound):**
- High concurrency per worker (5-10)
- Multiple worker processes
- Rate limiting to respect API limits
- Quick to scale up and down

**Report queue (CPU-bound):**
- Low concurrency per worker (1)
- Scale by adding worker processes
- Consider dedicated worker containers
- Monitor memory usage during generation

The report worker in our codebase already follows this pattern with `concurrency: 1`:

```typescript
const reportWorker = new Worker<ReportJobData>(
  "reports",
  async (job) => {
    await processReportJob(job);
  },
  {
    connection,
    concurrency: 1, // Reports are heavy, process one at a time
  }
);
```

## Step by Step

### Step 1: Run Multiple Workers

Open three terminals and start a worker in each:

```bash
# Terminal 1
npm run worker

# Terminal 2
npm run worker

# Terminal 3
npm run worker
```

Each should log:

```
[worker] Started with concurrency: 3
[worker] Listening for jobs on queues: email, reports
```

### Step 2: Send a Burst of Jobs

With the API server running, enqueue 20 email jobs quickly:

```bash
for i in $(seq 1 20); do
  curl -s -X POST http://localhost:3002/jobs/email \
    -H "Content-Type: application/json" \
    -d "{\"to\": \"user${i}@startup.com\", \"subject\": \"Burst Test ${i}\", \"html\": \"<p>Job ${i}</p>\"}" &
done
wait
```

### Step 3: Observe Job Distribution

Watch the three worker terminals. You should see jobs distributed across all three workers. Each worker picks up a subset of the 20 jobs. No two workers process the same job ID.

### Step 4: Adjust Concurrency via Environment Variable

Stop one worker and restart it with higher concurrency:

```bash
WORKER_CONCURRENCY=10 npm run worker
```

This single worker now handles 10 jobs in parallel, compensating for the loss of the other two workers.

### Step 5: Monitor Queue Drain Time

After the burst, check how quickly the queue drains:

```bash
watch -n 1 'curl -s http://localhost:3002/jobs/counts | python3 -m json.tool'
```

With 3 workers at concurrency 3, the queue should drain roughly 3 times faster than with a single worker.

## Exercise

Create a `docker-compose.prod.yml` file that runs:
- 1 Redis container
- 1 API container on port 3001
- 3 worker containers with `WORKER_CONCURRENCY=5`

Each worker should use the same image but override the command to `npm run worker`. Calculate the theoretical maximum email throughput considering the rate limiter of 10 jobs per second per worker.

## Summary

- Multiple worker processes can consume from the same queue without coordination -- BullMQ handles distribution via Redis locking
- Total throughput = worker count multiplied by concurrency per worker
- I/O-bound jobs (email) benefit from high concurrency; CPU-bound jobs (reports) should use concurrency of 1
- Rate limiters are per-worker by default; use queue-level limiters for global rate control
- `maxRetriesPerRequest: null` is essential for long-running worker processes
- API servers and workers should be separate deployable units that share only Redis
- Graceful shutdown is critical in container environments to prevent abandoned jobs
- Docker Compose makes it easy to scale workers by adding service replicas
