# Multi-Stage Builds

Our current Dockerfile works great for development but ships unnecessary bloat to production: TypeScript source files, dev dependencies like `tsx`, and type definitions. Multi-stage builds let you use one stage to build your app and a separate, minimal stage to run it. The result is a dramatically smaller and more secure production image.

## What You'll Learn

- Why development images are too large for production
- How multi-stage builds work with multiple `FROM` instructions
- Building the LaunchPad API with a builder pattern
- Comparing image sizes between single-stage and multi-stage builds

## Key Concepts

### The Problem with Our Current Dockerfile

Our existing Dockerfile installs everything, including dev dependencies:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY app/package*.json ./
RUN npm install
COPY app/ .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

This image contains:
- TypeScript source files (`src/*.ts`) that are not needed at runtime
- `tsx` and `typescript` packages (dev dependencies only needed for building)
- `@types/node` and `@types/express` (type definitions, unused at runtime)
- `tsconfig.json` (build configuration, unused at runtime)

In production, you only need the compiled JavaScript, Express, and dotenv.

### How Multi-Stage Builds Work

A multi-stage Dockerfile has multiple `FROM` instructions. Each `FROM` starts a new stage. You can copy files from one stage to another using `COPY --from=`. Only the final stage becomes the output image.

```
Stage 1 (builder)          Stage 2 (production)
┌─────────────────┐        ┌─────────────────┐
│ Node.js + npm   │        │ Node.js         │
│ TypeScript      │        │ Compiled JS     │
│ Source .ts files│──COPY──>│ Production deps │
│ All dependencies│        │                 │
│ Compiled .js    │        │ That's it.      │
└─────────────────┘        └─────────────────┘
     (discarded)               (final image)
```

### Multi-Stage Dockerfile for Our API

Here is a production-ready Dockerfile using multi-stage builds:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY app/package*.json ./
RUN npm install
COPY app/ .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
```

Let us break down each stage.

### Stage 1: The Builder

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY app/package*.json ./
RUN npm install
COPY app/ .
RUN npm run build
```

This stage:
1. Starts from `node:20-alpine` and names itself `builder`
2. Installs all dependencies (including dev dependencies like `typescript`)
3. Copies the source code
4. Runs `npm run build`, which executes `tsc` (the TypeScript compiler)

The `tsc` command reads `tsconfig.json` and compiles all `.ts` files from `src/` into JavaScript in the `dist/` directory. After this stage, `dist/` contains:
- `dist/index.js` -- compiled entry point
- `dist/app.js` -- compiled Express app
- `dist/types.js` -- compiled type interfaces
- `dist/routes/health.js` and `dist/routes/startups.js`
- `dist/middleware/request-logger.js` and `dist/middleware/error-handler.js`

### Stage 2: The Production Image

```dockerfile
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
```

This stage:
1. Starts fresh from `node:20-alpine` (no leftover files from the builder)
2. Copies only `package.json` and `package-lock.json` from the builder stage
3. Installs only production dependencies (`--omit=dev` skips `typescript`, `tsx`, `@types/*`)
4. Copies only the compiled `dist/` directory from the builder stage
5. Sets `NODE_ENV=production`, which makes the error handler hide error details
6. Uses `npm start` which runs `node dist/index.js` (compiled JavaScript, no tsx needed)

The TypeScript source files, dev dependencies, and build tools are all left behind in the discarded builder stage.

### What Changes at Runtime

With `NODE_ENV=production`, our error handler behaves differently:

```typescript
res.status(statusCode).json({
  success: false,
  error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
});
```

In production, error details are hidden from users. In development, the actual error message is shown for debugging.

## Step by Step

### Step 1: Build the Development Image

First, build the original single-stage image and check its size:

```bash
docker build -t launchpad-api:dev .
docker images launchpad-api:dev
```

Note the image size.

### Step 2: Create the Multi-Stage Dockerfile

Create a file called `Dockerfile.prod` at the course root:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY app/package*.json ./
RUN npm install
COPY app/ .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
```

### Step 3: Build the Production Image

```bash
docker build -f Dockerfile.prod -t launchpad-api:prod .
```

The `-f` flag specifies which Dockerfile to use.

### Step 4: Compare Image Sizes

```bash
docker images launchpad-api
```

```
REPOSITORY      TAG    SIZE
launchpad-api   dev    ~250MB
launchpad-api   prod   ~180MB
```

The production image is noticeably smaller because it excludes TypeScript, tsx, type definitions, and source files. The savings grow even more with larger applications.

### Step 5: Run the Production Image

```bash
docker run -d -p 3000:3000 --name launchpad-prod launchpad-api:prod
```

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Notice that the `environment` field now shows `"production"`.

### Step 6: Verify No Dev Files in Production

```bash
docker exec launchpad-prod ls /app
```

You should see only:
```
dist
node_modules
package-lock.json
package.json
```

No `src/` directory, no `tsconfig.json`, no TypeScript files. Only what is needed to run.

### Step 7: Build a Specific Stage

You can build just the builder stage for debugging:

```bash
docker build -f Dockerfile.prod --target builder -t launchpad-api:builder .
```

The `--target` flag stops the build at the named stage. Useful when you need to inspect intermediate build artifacts.

### Step 8: Clean Up

```bash
docker rm -f launchpad-prod
```

## Exercise

1. Build the current (dev) image and note its size with `docker images`
2. Create `Dockerfile.prod` with the multi-stage build shown above
3. Build the production image and compare sizes -- how much smaller is it?
4. Run the production image and test the `/health` endpoint. Confirm `NODE_ENV` is `production`
5. Use `docker exec` to verify the production image has no `src/` directory or TypeScript files
6. Try building with `--target builder` and compare that image's size to the production image

## Summary

- Development images contain build tools and source files that are unnecessary in production
- Multi-stage builds use multiple `FROM` instructions: one stage builds, another stage runs
- `COPY --from=builder` selectively brings files from one stage to the next
- `npm install --omit=dev` skips devDependencies like TypeScript and tsx
- `npm start` runs the compiled JavaScript (`node dist/index.js`) without needing tsx
- The production image is smaller, faster to deploy, and has a smaller attack surface
- `NODE_ENV=production` changes runtime behavior like error message visibility
