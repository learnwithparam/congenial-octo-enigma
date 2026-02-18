# 10 — Local Development

Running three services, a Redis instance, and keeping everything in sync on your laptop can feel overwhelming. A bad local development setup is the fastest way to make a team hate microservices. This lesson covers strategies for running the full system locally, from running services individually with `tsx watch` to orchestrating everything with Docker Compose, and the Makefile shortcuts that tie it all together.

## What You'll Learn

- How to run all services locally using separate terminal windows
- How Docker Compose orchestrates the full system with one command
- How the Makefile provides ergonomic shortcuts for common operations
- How environment variables differ between local and Docker modes
- Strategies for debugging across multiple services simultaneously

## Key Concepts

### The Local Development Challenge

In a monolith, you run one command and the entire application starts. With microservices, you need to start the gateway, auth-service, notification-service, and Redis — each with their own port, environment variables, and startup sequence. Get any piece wrong and requests fail silently or with confusing connection errors.

There are two approaches: run everything natively with Node.js, or run everything in Docker containers. Each has trade-offs.

### Approach 1: Native Node.js with tsx watch

The `package.json` defines three dev scripts, one per service:

```json
{
  "scripts": {
    "dev": "tsx watch gateway/src/index.ts",
    "dev:auth": "tsx watch auth-service/src/index.ts",
    "dev:notifications": "tsx watch notification-service/src/index.ts"
  }
}
```

Each script uses `tsx watch` which compiles TypeScript on the fly and restarts on file changes. You need three terminal windows (or tabs):

Terminal 1 — Redis (required by auth and notifications):

```bash
docker compose up redis
```

Terminal 2 — Auth service:

```bash
make dev-auth
# Auth service listening on port 3001
```

Terminal 3 — Notification service:

```bash
make dev-notifications
# Notification service listening on port 3002
```

Terminal 4 — Gateway:

```bash
make dev-gateway
# Gateway listening on port 3000
```

The gateway must start last because it proxies requests to the other services. If auth or notifications are not running when the gateway starts, that is fine — requests to those services will fail until they come up. But starting in dependency order avoids confusing errors during development.

### Approach 2: Docker Compose

The `docker-compose.yml` defines the full system as a single unit:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  gateway:
    build:
      context: .
      dockerfile: gateway/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - AUTH_SERVICE_URL=http://auth:3001
      - NOTIFICATION_SERVICE_URL=http://notifications:3002
    depends_on:
      - auth
      - notifications

  auth:
    build:
      context: .
      dockerfile: auth-service/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - AUTH_PORT=3001
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  notifications:
    build:
      context: .
      dockerfile: notification-service/Dockerfile
    ports:
      - "3002:3002"
    environment:
      - NOTIFICATION_PORT=3002
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

volumes:
  redisdata:
```

One command brings everything up:

```bash
make docker-up
# Gateway: http://localhost:3000
# Auth: http://localhost:3001
# Notifications: http://localhost:3002
```

### Environment Variables: Local vs Docker

The key difference between native and Docker mode is how services find each other.

In native mode, all services run on `localhost`. The gateway reaches auth at `http://localhost:3001` and notifications at `http://localhost:3002`. Redis is at `localhost:6379`.

In Docker mode, each service runs in its own container on a shared Docker network. Docker's internal DNS resolves service names, so the gateway reaches auth at `http://auth:3001` (using the service name from `docker-compose.yml`) and Redis is at `redis://redis:6379`.

This is why the environment variables in `docker-compose.yml` use service names:

```yaml
# Docker mode: uses container names
AUTH_SERVICE_URL=http://auth:3001
REDIS_URL=redis://redis:6379

# Native mode: uses localhost
AUTH_SERVICE_URL=http://localhost:3001
REDIS_URL=redis://localhost:6379
```

### The Makefile as Developer Interface

The Makefile acts as a discoverable command palette. Running `make help` lists everything:

```bash
make help
# 10 -- Microservices That Make Sense
#
# Usage:
#   setup           Initial setup (create .env, install deps)
#   install         Install dependencies
#   dev             Start all services (instructions)
#   dev-gateway     Start API gateway (port 3000)
#   dev-auth        Start auth service (port 3001)
#   dev-notifications  Start notification service (port 3002)
#   test            Run tests
#   clean           Remove node_modules and dist
#   docker-up       Start all services with Docker
#   docker-down     Stop Docker containers
```

The `dev` target prints instructions rather than trying to start everything in one terminal. This is intentional — you want separate log streams per service so you can follow a request through the system:

```bash
make dev
# Start services in separate terminals:
#   make dev-gateway
#   make dev-auth
#   make dev-notifications
```

## Step by Step

### Step 1: First-Time Setup

Clone the repo and run the setup target:

```bash
make setup
```

This copies `.env.example` to `.env` in the gateway directory and installs all npm dependencies. Since the project uses npm workspaces (a single `package.json` at the root), one `npm install` handles dependencies for all three services plus the shared library.

### Step 2: Start with Docker (Quick Path)

The fastest way to verify everything works:

```bash
make docker-up
```

Docker builds images for all three services, starts Redis, and wires them together. Test with:

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"gateway","timestamp":"..."}

curl http://localhost:3001/health
# {"status":"ok","service":"auth-service","uptime":...}

curl http://localhost:3002/health
# {"status":"ok","service":"notification-service","uptime":...}
```

When done:

```bash
make docker-down
```

### Step 3: Start Natively (Development Path)

For active development, native mode gives you faster restarts and direct access to Node.js debugging.

First, start Redis in the background:

```bash
docker compose up redis -d
```

Then open three terminals and start each service:

```bash
# Terminal 1
make dev-auth

# Terminal 2
make dev-notifications

# Terminal 3
make dev-gateway
```

Each service restarts automatically when you edit its source files. The gateway's log stream shows incoming requests, and you can watch the auth and notification logs to see how requests propagate.

### Step 4: Test a Full Request Flow

With all services running, trace a request through the system:

```bash
# Register a user (gateway → auth-service → Redis)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@launchpad.io", "password": "test1234"}'
```

Watch the logs in each terminal:
1. The gateway logs the incoming POST to `/auth/register`
2. The auth-service logs the user creation and token generation
3. If registration triggers a welcome notification, the notification-service logs the event

This is the power of separate log streams — you can see the full request lifecycle across services in real time.

### Step 5: Debugging a Single Service

When you need to debug one service, you do not need to restart everything. If the auth-service has a bug:

1. Stop only the auth-service terminal (Ctrl+C)
2. Add `console.log` statements or use the Node.js inspector:

```bash
node --inspect tsx watch auth-service/src/index.ts
```

3. Open `chrome://inspect` in Chrome to attach the debugger
4. The gateway will return 502 errors for auth routes until the service comes back up — other routes continue working

This fault isolation is one of the practical benefits of microservices: a broken auth-service does not crash the notification-service.

### Step 6: Inspecting Redis

During development, inspect Redis to understand what the services store:

```bash
# Connect to Redis CLI
docker exec -it $(docker ps -q -f ancestor=redis:7-alpine) redis-cli

# List all keys
KEYS *

# Check session data
GET session:abc-123

# Monitor all commands in real time
MONITOR
```

The `MONITOR` command is especially useful — it shows every Redis command from every service in real time, letting you trace data flow without adding log statements.

## Exercise

1. Run `make setup` to initialize the project
2. Start the full system with `make docker-up` and verify all three health endpoints return `200`
3. Stop Docker with `make docker-down` and switch to native mode: start Redis, then each service in separate terminals
4. Make a change to `auth-service/src/index.ts` (add a log statement to the health endpoint) and verify `tsx watch` restarts automatically
5. Open a Redis CLI session and run `MONITOR` while making requests through the gateway — observe the Redis commands generated by auth and notification services
6. Stop only the notification-service and verify the gateway and auth-service continue working for non-notification routes

## Summary

- Native mode (tsx watch) gives fast restarts and easy debugging but requires multiple terminals
- Docker Compose mode orchestrates everything with one command but has slower rebuild cycles
- Environment variables control how services discover each other: `localhost` for native, service names for Docker
- The Makefile provides a discoverable interface — `make help` lists all available commands
- Start services in dependency order: Redis first, then backend services, then the gateway
- Debug individual services without restarting the entire system
- Use `redis-cli MONITOR` to observe cross-service data flow in real time
- Use native mode for active development, Docker mode for integration testing and demos
