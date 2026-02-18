# Environment Variables

Applications need configuration that changes between environments: database URLs, API keys, feature flags, and port numbers. Docker provides multiple ways to pass environment variables into containers. In this lesson, we will explore each approach and understand when to use which.

## What You'll Learn

- How our LaunchPad API uses environment variables
- The difference between ARG (build-time) and ENV (run-time) in Dockerfiles
- Passing environment variables through docker-compose.yml
- Using .env files to keep secrets out of version control

## Key Concepts

### How Our App Uses Environment Variables

The LaunchPad API reads environment variables in several places. Let us trace through the code:

**`app/src/index.ts`** reads `PORT` and `NODE_ENV`:

```typescript
const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
```

**`app/src/routes/health.ts`** reports the environment in the health check:

```typescript
res.json({
  success: true,
  data: {
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  },
});
```

**`app/src/middleware/error-handler.ts`** hides error details in production:

```typescript
res.status(statusCode).json({
  success: false,
  error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
});
```

Each of these uses a sensible default when the variable is not set, which is a good practice.

### ARG vs ENV in Dockerfiles

Dockerfiles have two instructions for variables, and they serve completely different purposes:

**`ARG`** is a build-time variable. It exists only during `docker build` and is not available when the container runs:

```dockerfile
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine
```

You set ARG values with `--build-arg`:

```bash
docker build --build-arg NODE_VERSION=22 -t myapp .
```

**`ENV`** is a runtime variable. It is baked into the image and available whenever a container starts:

```dockerfile
ENV NODE_ENV=production
ENV PORT=3000
```

In our multi-stage production Dockerfile, we use `ENV` to set the runtime environment:

```dockerfile
ENV NODE_ENV=production
```

Here is when to use each:

| Use | ARG | ENV |
|-----|-----|-----|
| Selecting a base image version | Yes | No |
| Setting a runtime default | No | Yes |
| Available during build | Yes | Yes |
| Available at runtime | No | Yes |
| Visible in `docker inspect` | No | Yes |

### Environment Variables in docker-compose.yml

Our Compose file sets environment variables with the `environment` key:

```yaml
services:
  app:
    environment:
      - NODE_ENV=development
      - PORT=3000
```

These override any `ENV` defaults set in the Dockerfile. This is useful because the Dockerfile might set `NODE_ENV=production` as a default, but for local development, Compose overrides it to `development`.

There are two syntax forms:

```yaml
# List form (our Compose file uses this)
environment:
  - NODE_ENV=development
  - PORT=3000

# Map form (equivalent)
environment:
  NODE_ENV: development
  PORT: "3000"
```

Both produce the same result.

### The .env File

Our project includes a `.env.example` file:

```
PORT=3000
NODE_ENV=development
```

Developers copy this to `.env` and customize it. The `.env` file is listed in `.dockerignore` so it never gets baked into the image.

In docker-compose.yml, you can reference `.env` files:

```yaml
services:
  app:
    env_file:
      - ./app/.env
```

Or Compose automatically loads a `.env` file at the project root for variable substitution in the YAML itself:

```yaml
# .env at project root
APP_PORT=3000

# docker-compose.yml
services:
  app:
    ports:
      - "${APP_PORT}:3000"
```

This is powerful for customizing ports, image tags, and other settings without editing the Compose file.

### The Priority Order

When the same variable is defined in multiple places, Docker uses this priority (highest wins):

1. `docker compose run -e VAR=value` (command line)
2. `environment:` in docker-compose.yml
3. `env_file:` in docker-compose.yml
4. `ENV` in Dockerfile
5. Application default (`process.env.PORT || "3000"`)

## Step by Step

### Step 1: See Current Environment Variables

Start the stack and check what the container sees:

```bash
docker compose up -d
docker compose exec app /bin/sh -c 'env | sort'
```

You will see `NODE_ENV=development` and `PORT=3000` among the output, set by the Compose file's `environment` section.

### Step 2: Override at Runtime

Stop the stack and start with an override:

```bash
docker compose down
PORT=4000 docker compose up -d
```

Wait -- this does not work as you might expect. The `PORT=4000` only affects Compose variable substitution in the YAML, not the container's environment. Since our YAML hardcodes `PORT=3000`, the container still gets 3000.

To actually override, modify the Compose file to use substitution:

```yaml
environment:
  - NODE_ENV=${NODE_ENV:-development}
  - PORT=${PORT:-3000}
```

Now `PORT=4000 docker compose up -d` would pass `PORT=4000` to the container.

### Step 3: Use an env_file

Create a file called `.env.docker` at the course root:

```
NODE_ENV=staging
PORT=3000
LOG_LEVEL=debug
```

Reference it in docker-compose.yml:

```yaml
services:
  app:
    env_file:
      - .env.docker
    environment:
      - PORT=3000
```

Variables from `env_file` are loaded first, then `environment` entries override them.

### Step 4: Use ARG for Build-Time Customization

Add an `ARG` to the Dockerfile for the Node.js version:

```dockerfile
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine
WORKDIR /app
COPY app/package*.json ./
RUN npm install
COPY app/ .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

Build with a specific version:

```bash
docker build --build-arg NODE_VERSION=22 -t launchpad-api:node22 .
```

Verify inside the container:

```bash
docker run --rm launchpad-api:node22 node --version
# v22.x.x
```

### Step 5: Keep Secrets Safe

Never put real secrets (API keys, database passwords) directly in docker-compose.yml or Dockerfiles, because these files are committed to version control.

Instead:
1. Use `.env` files that are in `.gitignore`
2. Use `env_file:` to load them in Compose
3. For production, use Docker secrets or your deployment platform's secret management

Our `.dockerignore` already excludes `.env`:

```
.env
```

And `app/.env.example` shows developers what variables are needed without exposing actual values.

### Step 6: Verify Environment-Dependent Behavior

Test how the health endpoint reports the environment:

```bash
# Development mode (default from Compose)
docker compose up -d
curl http://localhost:3000/health
```

The response includes `"environment": "development"` because our Compose file sets `NODE_ENV=development`. If you changed it to `NODE_ENV=production`, the health check would report `"production"` and the error handler would hide detailed error messages.

## Exercise

1. Start the stack and use `docker compose exec app env` to list all environment variables
2. Modify `docker-compose.yml` to use variable substitution with defaults: `${PORT:-3000}`
3. Create a `.env.docker` file and use `env_file:` to load it in Compose
4. Add an `ARG NODE_VERSION=20` to the Dockerfile and build with `--build-arg NODE_VERSION=22`
5. Verify the health endpoint reports the correct `environment` value when you change `NODE_ENV`

## Summary

- Our LaunchPad API reads `PORT` and `NODE_ENV` from environment variables with sensible defaults
- `ARG` is for build-time variables (selecting base images, setting build options)
- `ENV` is for runtime variables (application configuration)
- docker-compose.yml `environment:` sets container environment variables and overrides Dockerfile `ENV`
- `.env` files keep secrets out of version control; `env_file:` loads them into containers
- Variable substitution (`${VAR:-default}`) in Compose files makes configuration flexible
- Never commit real secrets to Dockerfiles or Compose files
