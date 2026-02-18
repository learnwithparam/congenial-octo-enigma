# First Dockerfile

A Dockerfile is a recipe that tells Docker how to build an image for your application. In this lesson, we will write a Dockerfile for the LaunchPad startup directory API, understanding each instruction along the way.

## What You'll Learn

- What a Dockerfile is and how Docker reads it
- The core instructions: FROM, WORKDIR, COPY, RUN, EXPOSE, CMD
- How to build an image from a Dockerfile
- Layer caching and why instruction order matters

## Key Concepts

### What is a Dockerfile?

A Dockerfile is a plain text file (literally named `Dockerfile`, no extension) that contains a series of instructions. Each instruction creates a layer in the resulting image. Docker reads these instructions top-to-bottom and executes them in order.

### Anatomy of Our Dockerfile

Here is the Dockerfile at the root of the course directory:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY app/package*.json ./
RUN npm install
COPY app/ .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

Let us break down each line.

### FROM: The Base Image

```dockerfile
FROM node:20-alpine
```

Every Dockerfile starts with `FROM`. This specifies the base image to build on top of. We are using `node:20-alpine`, which gives us:

- **node:20** -- Node.js version 20 (matching our project requirements)
- **alpine** -- Alpine Linux, a minimal Linux distribution (~5MB vs ~100MB for Ubuntu)

The Alpine variant keeps our image small. Our LaunchPad API needs Node.js and npm, and this base image provides both.

### WORKDIR: Set the Working Directory

```dockerfile
WORKDIR /app
```

This sets the working directory inside the container. All subsequent commands run relative to `/app`. If the directory does not exist, Docker creates it. Think of it as `mkdir -p /app && cd /app`.

### COPY: Bring Files Into the Image

```dockerfile
COPY app/package*.json ./
```

This copies `package.json` and `package-lock.json` from our host machine into the container's `/app` directory. The `*` glob matches both files.

Notice we copy these files separately before copying the rest of the code. This is intentional -- it enables layer caching, which we will explain shortly.

### RUN: Execute a Command During Build

```dockerfile
RUN npm install
```

This runs `npm install` inside the container during the build process. It installs all the dependencies listed in `package.json`: Express, dotenv, TypeScript, tsx, and the type definitions.

The result (the `node_modules` directory) becomes part of the image layer. This means dependencies are baked into the image -- no one needs to run `npm install` separately.

### COPY (again): Bring in the Application Code

```dockerfile
COPY app/ .
```

Now we copy the entire `app/` directory (our source code) into the container. This includes:

- `src/index.ts` -- the entry point
- `src/app.ts` -- the Express application
- `src/routes/` -- health and startups route handlers
- `src/middleware/` -- request logger and error handler
- `tsconfig.json` -- TypeScript configuration

### EXPOSE: Document the Port

```dockerfile
EXPOSE 3000
```

This documents that the container listens on port 3000. It does not actually publish the port -- that happens at runtime with `-p`. Think of `EXPOSE` as documentation for anyone reading the Dockerfile.

Our `index.ts` reads the port from the environment:

```typescript
const PORT = parseInt(process.env.PORT || "3000", 10);
```

### CMD: The Default Command

```dockerfile
CMD ["npm", "run", "dev"]
```

This specifies what runs when a container starts from this image. In our case, `npm run dev` which executes `tsx watch src/index.ts` (as defined in `package.json`). The `tsx` tool compiles and runs TypeScript directly, and the `watch` flag enables hot reloading.

The array syntax `["npm", "run", "dev"]` is the exec form, which is preferred over the shell form (`CMD npm run dev`) because it handles signals properly.

### Layer Caching: Why Order Matters

Docker caches each instruction as a layer. If a layer has not changed, Docker reuses the cached version. This is why we copy `package*.json` before copying the source code:

```
Layer 1: FROM node:20-alpine          ← rarely changes
Layer 2: WORKDIR /app                  ← never changes
Layer 3: COPY app/package*.json ./     ← changes when deps change
Layer 4: RUN npm install               ← re-runs only if package.json changed
Layer 5: COPY app/ .                   ← changes on every code edit
Layer 6: EXPOSE 3000                   ← never changes
Layer 7: CMD ["npm", "run", "dev"]     ← rarely changes
```

If you only change a TypeScript file in `src/`, Docker reuses layers 1-4 from cache and only rebuilds layers 5-7. The expensive `npm install` step is skipped entirely. This can save minutes on every build.

## Step by Step

### Step 1: Read the Dockerfile

Open the Dockerfile at the project root and confirm it matches what we discussed:

```bash
cat Dockerfile
```

### Step 2: Check the .dockerignore

The `.dockerignore` file tells Docker which files to exclude from the build context:

```
node_modules
dist
.env
.git
.gitignore
*.md
lessons
tests
Makefile
docker-compose.yml
.dockerignore
```

This is important: we do not want to copy `node_modules` from the host into the image (we install fresh inside the container), and we exclude `.env` to avoid leaking secrets into images.

### Step 3: Build the Image

Run the build command from the course root directory:

```bash
docker build -t launchpad-api .
```

Here is what each part means:
- `docker build` -- build an image from a Dockerfile
- `-t launchpad-api` -- tag (name) the image as `launchpad-api`
- `.` -- use the current directory as the build context

Watch the output. You will see each instruction execute as a numbered step.

### Step 4: Verify the Image Was Created

```bash
docker images
```

You should see `launchpad-api` in the list with its size (around 200-250MB with Alpine).

### Step 5: Run a Container from the Image

```bash
docker run -p 3000:3000 launchpad-api
```

The `-p 3000:3000` flag maps port 3000 on your host to port 3000 in the container. Open `http://localhost:3000/health` in your browser and you should see:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 2.345,
    "timestamp": "2026-02-18T10:00:00.000Z",
    "environment": "development"
  }
}
```

Try the startups endpoint too: `http://localhost:3000/api/startups`

### Step 6: Rebuild After a Change

Edit any file in `app/src/` (add a comment, for example) and rebuild:

```bash
docker build -t launchpad-api .
```

Notice how the first few steps say "CACHED". Docker is reusing layers that have not changed. Only the `COPY app/ .` layer and beyond are rebuilt.

## Exercise

1. Build the LaunchPad API image with `docker build -t launchpad-api .`
2. Run it with `docker run -p 3000:3000 launchpad-api` and test the `/health` endpoint
3. Stop the container (Ctrl+C) and modify a file in `app/src/`. Rebuild and notice which layers are cached
4. Try swapping the two `COPY` instructions so all files are copied at once. Rebuild twice (once with a source change) and observe how caching behaves differently

## Summary

- A Dockerfile is a recipe of instructions that Docker executes top-to-bottom to build an image
- `FROM` sets the base image, `WORKDIR` sets the directory, `COPY` brings in files, `RUN` executes commands
- `EXPOSE` documents the port, and `CMD` defines the default startup command
- Layer caching makes rebuilds fast -- copy dependency files before source code to take advantage of it
- The `.dockerignore` file prevents unnecessary files from being included in the build context
