# Debugging Containers

Containers are great until something goes wrong. The server is not responding, the database connection fails, or a container keeps crashing on startup. In this lesson, we will build a toolkit of debugging techniques so you can diagnose and fix problems inside Docker containers quickly.

## What You'll Learn

- Reading and filtering container logs effectively
- Using `docker exec` to investigate a running container
- Inspecting container configuration and networking
- Diagnosing the most common container issues

## Key Concepts

### The Debugging Mindset

When a containerized application misbehaves, the problem usually falls into one of these categories:

1. **Application errors**: Bugs in your code, just like without Docker
2. **Configuration errors**: Wrong environment variables, missing `.env` file
3. **Network errors**: Services cannot reach each other, port conflicts
4. **Build errors**: Missing files, wrong base image, incorrect COPY paths
5. **Resource errors**: Out of memory, disk full

Docker provides tools for each category. The key is knowing which tool to reach for.

### Logs Are Your First Stop

The `requestLogger` middleware in our LaunchPad API logs every request:

```typescript
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const log = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    console.log(`[${new Date().toISOString()}] ${log}`);
  });

  next();
}
```

And the `errorHandler` middleware logs errors:

```typescript
export function errorHandler(err: Error, _req: Request, res: Response<ApiResponse>, _next: NextFunction): void {
  console.error(`[ERROR] ${err.message}`);
  // ...
}
```

All of this output is captured by Docker's logging system. Everything your app writes to stdout or stderr becomes available through `docker logs`.

## Step by Step

### Step 1: Reading Container Logs

Start the stack:

```bash
docker compose up -d
```

View all logs:

```bash
docker compose logs app
```

Stream logs in real-time:

```bash
docker compose logs -f app
```

Show only the last 50 lines:

```bash
docker compose logs --tail 50 app
```

Show logs since a specific time:

```bash
docker compose logs --since 5m app
```

Add timestamps to every line:

```bash
docker compose logs -t app
```

### Step 2: Generating Log Output for Debugging

Make some requests to generate logs, then look at the output:

```bash
# Successful request
curl http://localhost:3000/api/startups

# 404 request
curl http://localhost:3000/nonexistent

# Create a startup
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{"name":"DebugCo","description":"Testing logs","industry":"DevTools","founded":2025}'

# Request a non-existent startup
curl http://localhost:3000/api/startups/fake-id-12345
```

In the logs, you will see entries like:

```
[2026-02-18T10:00:01.123Z] GET /api/startups 200 2ms
[2026-02-18T10:00:02.456Z] GET /nonexistent 404 0ms
[2026-02-18T10:00:03.789Z] POST /api/startups 201 1ms
[2026-02-18T10:00:04.012Z] GET /api/startups/fake-id-12345 404 0ms
```

Each log line from the request logger shows the HTTP method, path, status code, and response time. This tells you what is happening at a glance.

### Step 3: Exploring a Running Container

Use `docker exec` to open a shell inside the container:

```bash
docker compose exec app /bin/sh
```

Or using the Makefile shortcut:

```bash
make shell
```

Once inside, you can run diagnostics:

```sh
# Check the file system
ls -la /app/
ls -la /app/src/routes/

# Check what Node.js version is running
node --version

# Verify environment variables are set correctly
env | grep NODE_ENV
env | grep PORT

# Check running processes
ps aux

# Check memory usage
free -m

# Check disk usage
df -h

# Exit the shell
exit
```

### Step 4: Running One-Off Commands

You do not need to open an interactive shell for quick checks. Run a single command:

```bash
# Check environment variables
docker compose exec app env

# List files
docker compose exec app ls /app/src/

# Check the node_modules size
docker compose exec app du -sh /app/node_modules

# Test DNS resolution (if you have multiple services)
docker compose exec app ping -c 2 db
```

### Step 5: Inspecting Container Configuration

The `docker inspect` command reveals everything about a container -- its configuration, network settings, mount points, and more:

```bash
docker inspect $(docker compose ps -q app)
```

This outputs a large JSON document. Filter for specific information:

```bash
# Check network settings
docker inspect $(docker compose ps -q app) --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'

# Check mounted volumes
docker inspect $(docker compose ps -q app) --format '{{json .Mounts}}'

# Check environment variables
docker inspect $(docker compose ps -q app) --format '{{json .Config.Env}}'
```

### Step 6: Inspecting the Docker Network

When services cannot talk to each other, inspect the network:

```bash
# List all networks
docker network ls

# Find the Compose project's network
docker network ls | grep docker-for-humans

# Inspect the network to see connected containers
docker network inspect $(docker network ls --filter name=docker-for-humans -q)
```

This shows you every container on the network with its IP address. If a service is missing, it is not connected to the network properly.

### Step 7: Diagnosing Common Issues

**Container keeps restarting (exit code 1)**:

```bash
# Check the exit code
docker compose ps -a

# Read the logs to see the error
docker compose logs app
```

Common causes: syntax error in code, missing environment variable, port already in use.

**"Port already in use" error**:

```bash
# Find what is using port 3000 on the host
lsof -i :3000
```

Either stop the conflicting process or change the host port in docker-compose.yml:

```yaml
ports:
  - "3001:3000"  # Use 3001 on host, still 3000 in container
```

**"Cannot connect to database" from the app**:

Check that:
1. The database service is running: `docker compose ps`
2. The service name matches the hostname in the connection URL
3. The database has finished initializing (check `docker compose logs db`)

**Image build fails at COPY**:

```bash
# Rebuild with no cache to see full output
docker build --no-cache -t debug .
```

Review `.dockerignore` to make sure you are not excluding needed files. Our `.dockerignore` excludes `node_modules`, `dist`, and `.env`:

```
node_modules
dist
.env
```

If `package.json` were accidentally listed here, the build would fail at the `COPY app/package*.json ./` step.

**Container runs but app returns errors**:

```bash
# Check if the app process is actually running
docker compose exec app ps aux

# Check if the right files were copied
docker compose exec app ls /app/src/

# Check if dependencies were installed
docker compose exec app ls /app/node_modules/.package-lock.json
```

### Step 8: Using docker compose events

Watch container lifecycle events in real-time:

```bash
docker compose events
```

In another terminal, restart a service:

```bash
docker compose restart app
```

You will see events like `container start`, `container die`, `container start` -- useful for understanding what is happening during deployment.

### Step 9: Checking Resource Usage

```bash
docker stats
```

This shows a live view of CPU, memory, network, and disk I/O for every running container. Press Ctrl+C to exit.

For a one-shot snapshot:

```bash
docker stats --no-stream
```

### Step 10: Clean Up

When debugging leaves behind stale containers, images, and volumes:

```bash
# Stop everything
docker compose down -v

# Remove unused resources
docker system prune

# Nuclear option: remove everything
docker system prune -a --volumes
```

## Exercise

1. Start the stack with `make docker-up` and generate some log entries by curling various endpoints (GET, POST, 404s)
2. Use `docker compose logs --tail 20 app` to see only recent logs
3. Open a shell in the container with `make shell` and check the environment variables, file system, and running processes
4. Run `docker stats --no-stream` to see resource usage of the running containers
5. Simulate a port conflict: while the stack is running, try to start another container on port 3000 and diagnose the error
6. Stop the stack and intentionally introduce an error (like a typo in the Dockerfile COPY path). Build and read the error message to practice interpreting build failures

## Summary

- `docker compose logs -f` is your first debugging tool -- read the application output
- `docker exec -it` (or `make shell`) lets you explore a running container's file system, environment, and processes
- `docker inspect` reveals detailed configuration including network settings and mounts
- `docker network inspect` helps diagnose service-to-service communication issues
- `docker stats` shows real-time resource usage for all containers
- Common issues include port conflicts, missing environment variables, DNS resolution failures, and incorrect file paths in Dockerfiles
- The request logger and error handler middleware in our LaunchPad API produce structured logs that make debugging easier
