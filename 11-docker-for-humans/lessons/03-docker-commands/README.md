# Docker Commands

Now that you can build images and run containers, it is time to master the essential Docker CLI commands. These are the tools you will reach for daily when working with containers.

## What You'll Learn

- How to build, run, and manage containers
- Inspecting running containers with `ps`, `logs`, and `exec`
- Stopping and removing containers and images
- The difference between detached and foreground mode

## Key Concepts

### The Docker CLI Pattern

Most Docker commands follow a consistent pattern:

```
docker <command> [options] [arguments]
```

Commands operate on either images (blueprints) or containers (running instances). Keeping this distinction clear will save you confusion.

### Foreground vs Detached Mode

When you run a container, it can operate in two modes:

- **Foreground** (default): The container's output streams to your terminal. Ctrl+C stops it.
- **Detached** (`-d` flag): The container runs in the background. You get your terminal back immediately.

For development, you will often use detached mode and then check logs separately.

## Step by Step

### Step 1: Build the Image

If you have not already built the LaunchPad API image, do so now:

```bash
docker build -t launchpad-api .
```

The `-t` flag tags the image with a name. You can also add a version tag:

```bash
docker build -t launchpad-api:v1 .
```

Without a version tag, Docker defaults to `:latest`.

### Step 2: Run in Foreground Mode

```bash
docker run -p 3000:3000 launchpad-api
```

You will see the server output directly:

```
Server running on http://localhost:3000
Environment: development
Health check: http://localhost:3000/health
```

Press Ctrl+C to stop the container.

### Step 3: Run in Detached Mode

```bash
docker run -d -p 3000:3000 --name launchpad launchpad-api
```

This returns a container ID and gives you your terminal back. The `--name launchpad` flag gives the container a human-readable name instead of Docker's random name generator.

### Step 4: List Running Containers

```bash
docker ps
```

Output shows running containers with their ID, image, command, status, ports, and name:

```
CONTAINER ID   IMAGE           COMMAND         STATUS         PORTS                    NAMES
a1b2c3d4e5f6   launchpad-api   "npm run dev"   Up 2 minutes   0.0.0.0:3000->3000/tcp   launchpad
```

To see all containers (including stopped ones):

```bash
docker ps -a
```

### Step 5: View Container Logs

Since the container is running in detached mode, use `logs` to see its output:

```bash
docker logs launchpad
```

This shows all output since the container started. For live streaming (like `tail -f`):

```bash
docker logs -f launchpad
```

When you hit the API endpoints, you will see the request logger middleware output:

```
[2026-02-18T10:00:01.234Z] GET /health 200 3ms
[2026-02-18T10:00:05.678Z] GET /api/startups 200 1ms
```

This output comes from the `requestLogger` middleware in `app/src/middleware/request-logger.ts`, which logs every request's method, URL, status code, and duration.

Press Ctrl+C to stop following logs (the container keeps running).

### Step 6: Execute Commands Inside a Running Container

The `exec` command runs a command inside a running container. This is invaluable for debugging:

```bash
docker exec launchpad ls /app
```

This lists the files inside the container's `/app` directory. You should see `package.json`, `node_modules`, `src/`, and other files.

For an interactive shell session:

```bash
docker exec -it launchpad /bin/sh
```

The flags mean:
- `-i` -- interactive (keep stdin open)
- `-t` -- allocate a TTY (terminal)

Inside the shell, you can explore:

```sh
# Check Node version
node --version

# List source files
ls src/

# Check environment variables
echo $NODE_ENV

# View the running processes
ps aux

# Exit the shell
exit
```

### Step 7: Stop a Container

```bash
docker stop launchpad
```

This sends a `SIGTERM` signal, giving the process time to shut down gracefully. After 10 seconds, if it has not stopped, Docker sends `SIGKILL`.

Verify it stopped:

```bash
docker ps      # Should not show launchpad
docker ps -a   # Shows it with "Exited" status
```

### Step 8: Start a Stopped Container

You can restart a stopped container without creating a new one:

```bash
docker start launchpad
```

### Step 9: Remove a Container

A stopped container still exists on disk. To remove it:

```bash
docker stop launchpad
docker rm launchpad
```

Or combine stop and remove:

```bash
docker rm -f launchpad
```

The `-f` flag force-removes a running container (stops it first).

### Step 10: Manage Images

List all images on your machine:

```bash
docker images
```

Remove an image (all containers using it must be removed first):

```bash
docker rmi launchpad-api
```

Remove all unused images, containers, and networks:

```bash
docker system prune
```

Add `-a` to also remove images not referenced by any container:

```bash
docker system prune -a
```

### Command Quick Reference

| Command | What It Does |
|---------|-------------|
| `docker build -t name .` | Build image from Dockerfile |
| `docker run -d -p 3000:3000 --name c image` | Run container in background |
| `docker ps` | List running containers |
| `docker ps -a` | List all containers |
| `docker logs -f name` | Stream container logs |
| `docker exec -it name /bin/sh` | Open shell in container |
| `docker stop name` | Stop a container gracefully |
| `docker start name` | Start a stopped container |
| `docker rm name` | Remove a stopped container |
| `docker rm -f name` | Force remove (stop + remove) |
| `docker images` | List all images |
| `docker rmi name` | Remove an image |
| `docker system prune` | Clean up unused resources |

## Exercise

1. Build the LaunchPad API image and run it in detached mode with the name `launchpad`
2. Use `docker ps` to confirm it is running
3. Use `docker logs -f launchpad` to watch the logs, then in another terminal hit `http://localhost:3000/api/startups` with curl and see the request logged
4. Use `docker exec -it launchpad /bin/sh` to open a shell. Run `ls src/routes/` to see the route files
5. Stop the container, verify it shows as "Exited" with `docker ps -a`, then remove it
6. Confirm the image still exists with `docker images` even after the container is gone

## Summary

- `docker run -d` starts a container in the background; `docker run` (no `-d`) runs in foreground
- `docker ps` shows running containers; add `-a` to include stopped ones
- `docker logs -f` streams real-time output from a container
- `docker exec -it` lets you open a shell inside a running container for debugging
- `docker stop` gracefully shuts down a container; `docker rm` deletes it
- Containers and images are separate -- removing a container does not remove its image
