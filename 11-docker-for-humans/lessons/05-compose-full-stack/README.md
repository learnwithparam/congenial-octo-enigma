# Compose Full-Stack

Real applications rarely run in isolation. Your Express API needs a database to persist startup listings, and you might want Redis for caching. Docker Compose makes running multiple services together trivial. In this lesson, we will extend our `docker-compose.yml` to include PostgreSQL and Redis alongside the LaunchPad API.

## What You'll Learn

- How to define multiple services in a single Compose file
- Adding PostgreSQL and Redis as services
- Service networking and how containers talk to each other
- Using `depends_on` to control startup order

## Key Concepts

### Multi-Service Architecture

Right now, our LaunchPad API stores startups in an in-memory `Map` (see `app/src/routes/startups.ts`):

```typescript
const startups: Map<string, Startup> = new Map();
```

This means all data disappears when the container restarts. In a production setup, you would store this data in PostgreSQL. You might also use Redis for caching or session storage. With Docker Compose, you can run all three services together.

### Service Networking

When you define multiple services in a Compose file, Docker automatically creates a network that connects them. Each service can reach other services by name. If your Compose file has services named `app`, `db`, and `redis`, then from inside the `app` container:

- `db` resolves to the PostgreSQL container's IP address
- `redis` resolves to the Redis container's IP address

No IP addresses, no special configuration. Just use the service name as the hostname.

### The depends_on Directive

```yaml
depends_on:
  - db
  - redis
```

This tells Compose to start `db` and `redis` before starting `app`. Note that `depends_on` only waits for the container to start, not for the application inside to be ready. PostgreSQL might need a few seconds to initialize even after the container is running.

## Step by Step

### Step 1: Understand the Current Setup

Our current `docker-compose.yml` has a single service:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ./app/src:/app/src
    environment:
      - NODE_ENV=development
      - PORT=3000
```

We will extend this with two more services.

### Step 2: Add PostgreSQL and Redis

Here is what the full multi-service Compose file looks like:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ./app/src:/app/src
    environment:
      - NODE_ENV=development
      - PORT=3000
      - DATABASE_URL=postgres://launchpad:secret@db:5432/launchpad
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: launchpad
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: launchpad
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

Let us examine the new pieces.

### Step 3: Understand the Database Service

```yaml
  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: launchpad
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: launchpad
    volumes:
      - pgdata:/var/lib/postgresql/data
```

Key differences from the `app` service:

- **`image` instead of `build`**: We do not need a custom Dockerfile for PostgreSQL. We use the official `postgres:16-alpine` image directly from Docker Hub.
- **Environment variables**: The PostgreSQL image reads these to create the initial user, password, and database on first startup.
- **Named volume** (`pgdata`): This persists database data across container restarts. We will explore volumes in detail in the next lesson.

### Step 4: Understand the Redis Service

```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

Redis is even simpler -- it needs no environment variables for basic usage. The `redis:7-alpine` image starts a Redis server with default configuration.

### Step 5: Understand the Connection URL

Look at the `DATABASE_URL` in the app service:

```
postgres://launchpad:secret@db:5432/launchpad
```

Breaking this down:
- `launchpad:secret` -- the username and password (matching `POSTGRES_USER` and `POSTGRES_PASSWORD`)
- `db` -- the hostname, which is the service name in Compose
- `5432` -- PostgreSQL's default port
- `launchpad` -- the database name (matching `POSTGRES_DB`)

Similarly, `redis://redis:6379` uses the service name `redis` as the hostname. Docker's internal DNS resolves these names automatically.

### Step 6: Start the Full Stack

```bash
docker compose up -d
```

Watch the output. Compose starts services in dependency order:
1. `db` and `redis` start first (they have no dependencies)
2. `app` starts after both are running

Check that all three are running:

```bash
docker compose ps
```

```
NAME                    SERVICE   STATUS    PORTS
11-docker-...-app-1     app       Up        0.0.0.0:3000->3000/tcp
11-docker-...-db-1      db        Up        0.0.0.0:5432->5432/tcp
11-docker-...-redis-1   redis     Up        0.0.0.0:6379->6379/tcp
```

### Step 7: Verify Services Can Talk to Each Other

Open a shell in the app container and test connectivity:

```bash
docker compose exec app /bin/sh
```

Inside the container:

```sh
# Ping the database (by service name)
ping -c 2 db

# Ping Redis (by service name)
ping -c 2 redis
```

Both should resolve and respond. This is Docker's built-in service discovery at work.

### Step 8: Connect to PostgreSQL Directly

You can interact with the database from your host machine because we mapped port 5432:

```bash
docker compose exec db psql -U launchpad -d launchpad
```

Inside the psql shell:

```sql
\dt          -- list tables (empty for now)
\conninfo    -- show connection info
\q           -- quit
```

### Step 9: View Logs for a Specific Service

```bash
docker compose logs -f db
```

This shows only PostgreSQL logs, useful when debugging database issues. You can combine services:

```bash
docker compose logs -f app db
```

### Step 10: Tear Down Everything

```bash
docker compose down
```

This stops and removes all containers. The named volume `pgdata` is preserved so your database data survives restarts. To also remove volumes:

```bash
docker compose down -v
```

## Exercise

1. Extend the `docker-compose.yml` with the PostgreSQL and Redis services as shown above
2. Run `docker compose up -d` and verify all three services are running with `docker compose ps`
3. Open a shell in the `app` container and ping both `db` and `redis` by service name
4. Connect to PostgreSQL using `docker compose exec db psql -U launchpad -d launchpad`
5. Run `docker compose down` and then `docker compose up -d` again -- verify the startup is faster the second time because images are cached
6. Run `docker compose down -v` to also remove the database volume

## Summary

- Docker Compose can orchestrate multiple services (app, database, cache) in a single file
- Each service can use either `build` (custom Dockerfile) or `image` (pre-built from a registry)
- Services on the same Compose network can reach each other by service name (e.g., `db`, `redis`)
- `depends_on` controls startup order but does not wait for application readiness
- Named volumes persist data across container restarts
- Port mappings let you access services from your host machine for development and debugging
