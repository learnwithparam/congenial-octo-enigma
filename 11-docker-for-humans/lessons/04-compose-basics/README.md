# Compose Basics

Running `docker build` and `docker run` with a dozen flags gets tedious fast. Docker Compose lets you define your entire container setup in a single YAML file and manage it with simple commands. In this lesson, we will explore our existing `docker-compose.yml` and understand every line.

## What You'll Learn

- What Docker Compose is and why it exists
- The structure of a `docker-compose.yml` file
- Services, ports, volumes, and environment configuration
- Using `docker compose` commands to manage your stack

## Key Concepts

### What is Docker Compose?

Docker Compose is a tool for defining and running container setups using a YAML configuration file. Instead of remembering long `docker run` commands with multiple flags, you declare everything in `docker-compose.yml` and run `docker compose up`.

Think of it this way:
- **Dockerfile** defines how to build a single image
- **docker-compose.yml** defines how to run one or more containers together

### Our docker-compose.yml

Here is the `docker-compose.yml` at the course root:

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

Let us break down each section.

### Services

```yaml
services:
  app:
```

The `services` key is the top-level entry point. Each child key defines a service -- a container that Compose will manage. Here we have one service called `app`. The name is arbitrary but should be descriptive. In a later lesson, we will add more services like a database.

### Build Configuration

```yaml
    build:
      context: .
      dockerfile: Dockerfile
```

This tells Compose how to build the image for this service:

- `context: .` -- the build context is the current directory (the course root)
- `dockerfile: Dockerfile` -- use the Dockerfile at the root

This is equivalent to running `docker build -f Dockerfile .` manually. Compose builds the image automatically when needed.

### Port Mapping

```yaml
    ports:
      - "3000:3000"
```

This maps port 3000 on your host machine to port 3000 inside the container. The format is `"host:container"`. This is equivalent to the `-p 3000:3000` flag we used with `docker run`.

Our `index.ts` starts the Express server on this port:

```typescript
const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

### Volumes (Bind Mounts)

```yaml
    volumes:
      - ./app/src:/app/src
```

This creates a bind mount that maps the `./app/src` directory on your host to `/app/src` inside the container. Changes you make to source files on your machine are immediately reflected inside the container.

Combined with `tsx watch` (our dev command), this gives us hot reloading -- edit a file in `app/src/`, save it, and the server restarts automatically inside the container. You get the Docker isolation benefits without losing the fast feedback loop.

### Environment Variables

```yaml
    environment:
      - NODE_ENV=development
      - PORT=3000
```

This sets environment variables inside the container. Our application reads these in multiple places:

- `index.ts` reads `PORT` to know which port to listen on
- `health.ts` reads `NODE_ENV` to report the environment in the health check response
- `error-handler.ts` reads `NODE_ENV` to decide whether to expose error details

This is equivalent to `docker run -e NODE_ENV=development -e PORT=3000`.

## Step by Step

### Step 1: Start the Stack

From the course root directory, run:

```bash
docker compose up
```

Compose will:
1. Build the image (if it does not exist or if the Dockerfile changed)
2. Create a container from that image
3. Apply the port mapping, volumes, and environment variables
4. Stream logs from all services to your terminal

You should see:

```
launchpad-api-app-1  | Server running on http://localhost:3000
launchpad-api-app-1  | Environment: development
launchpad-api-app-1  | Health check: http://localhost:3000/health
```

### Step 2: Run in Detached Mode

Press Ctrl+C to stop, then start in the background:

```bash
docker compose up -d
```

Compose reports the container names and returns your terminal.

### Step 3: Check Status

```bash
docker compose ps
```

This shows only the containers managed by this Compose file, not all containers on your system:

```
NAME                          SERVICE   STATUS    PORTS
11-docker-for-humans-app-1    app       Up        0.0.0.0:3000->3000/tcp
```

### Step 4: View Logs

```bash
docker compose logs -f
```

This streams logs from all services. You can also target a specific service:

```bash
docker compose logs -f app
```

Test it by making a request in another terminal:

```bash
curl http://localhost:3000/api/startups
```

You will see the request logger output from the `requestLogger` middleware.

### Step 5: Stop the Stack

```bash
docker compose down
```

This stops and removes the containers. Add `-v` to also remove any named volumes (we will cover volumes in a later lesson):

```bash
docker compose down -v
```

### Step 6: Rebuild After Changes

If you change the Dockerfile or dependencies, force a rebuild:

```bash
docker compose up --build -d
```

The `--build` flag tells Compose to rebuild images even if they already exist.

### Compose Commands Quick Reference

| Command | What It Does |
|---------|-------------|
| `docker compose up` | Build and start all services |
| `docker compose up -d` | Start in detached (background) mode |
| `docker compose up --build` | Rebuild images before starting |
| `docker compose down` | Stop and remove containers |
| `docker compose down -v` | Also remove volumes |
| `docker compose ps` | List running services |
| `docker compose logs -f` | Stream logs from all services |
| `docker compose logs -f app` | Stream logs from one service |
| `docker compose exec app /bin/sh` | Open shell in a service |
| `docker compose build` | Build images without starting |

## Exercise

1. Run `docker compose up -d` and verify the LaunchPad API is running at `http://localhost:3000/health`
2. Use `docker compose logs -f` to watch logs while you curl `http://localhost:3000/api/startups`
3. Edit a file in `app/src/` (for example, change the seed data in `routes/startups.ts` to add a third startup). Watch the logs to see `tsx watch` restart the server
4. Run `docker compose down` and confirm the containers are removed with `docker compose ps`
5. Compare `docker compose ps` output with `docker ps` -- notice that Compose only shows its own containers

## Summary

- Docker Compose lets you define container configuration in a `docker-compose.yml` file
- Services are the building blocks -- each service becomes a container
- `ports` maps host ports to container ports
- `volumes` with bind mounts enable live code reloading during development
- `environment` sets environment variables that the application reads at runtime
- `docker compose up -d` starts everything; `docker compose down` tears it all down
- Compose commands mirror Docker commands but are scoped to the services in your YAML file
