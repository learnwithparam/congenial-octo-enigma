# 08 — Environment Configuration

A web application needs to talk to different servers depending on where it is running. During development, your API is at `http://localhost:3001`. In staging, it might be at `https://api-staging.launchpad.dev`. In production, it is at `https://api.launchpad.dev`. Hardcoding any of these URLs means rewriting code every time you deploy. Environment variables solve this by externalizing configuration from your code.

Next.js has its own conventions for environment variables that differ from plain Node.js applications. Some variables are available everywhere, some only on the server, and the `NEXT_PUBLIC_` prefix controls which is which. In this lesson, we will understand these rules, see how they apply to our LaunchPad frontend, and set up a configuration pattern that works across development, staging, and production.

## What You Will Learn

- How environment variables work in Next.js and the NEXT_PUBLIC_ prefix rule
- The difference between server-only and client-accessible variables
- How .env, .env.local, and .env.production files are loaded
- How our api-client.ts and api-server.ts use different variables and why
- How to set up .env.example as documentation for your team
- Patterns for managing configuration across multiple environments
- Security considerations for environment variables in frontend applications

## Key Concepts

### The NEXT_PUBLIC_ Prefix

Next.js draws a hard line between server-side and client-side environment variables. Any environment variable that starts with `NEXT_PUBLIC_` is embedded into the client-side JavaScript bundle at build time. Any variable without that prefix is only available in server-side code (Server Components, API routes, middleware, server actions).

This is not just a convention. It is a security boundary. When Next.js builds your application, it performs a string replacement: every occurrence of `process.env.NEXT_PUBLIC_API_URL` in client-side code is replaced with the actual value. If you try to access `process.env.API_URL` (without the prefix) in a Client Component, it will be `undefined` because Next.js deliberately excludes it from the bundle.

### Build-Time vs Runtime

For `NEXT_PUBLIC_` variables, the values are baked into the JavaScript at build time. This means that if you change a `NEXT_PUBLIC_` variable, you need to rebuild the application for the change to take effect. Server-only variables, by contrast, are read at runtime and can be changed without rebuilding (depending on your deployment platform).

This distinction matters for deployment. If you build once and deploy to multiple environments, `NEXT_PUBLIC_` variables will all have the same value (whatever was set during the build). For truly dynamic client-side configuration, you may need alternative approaches like injecting values through a script tag or reading them from an API.

### The .env File Hierarchy

Next.js loads environment files in a specific order, with later files overriding earlier ones:

1. `.env` — default values for all environments
2. `.env.local` — local overrides (gitignored, for developer-specific values)
3. `.env.development` — only loaded when `NODE_ENV=development` (next dev)
4. `.env.production` — only loaded when `NODE_ENV=production` (next build, next start)
5. `.env.test` — only loaded when `NODE_ENV=test`

The `.local` variants (`.env.development.local`, `.env.production.local`) take the highest priority within their environment.

## Step by Step

### Step 1: Examining Our .env.example File

Open `frontend/.env.example`:

```bash
# API URL for the backend
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Server-side API URL (optional, falls back to NEXT_PUBLIC_API_URL)
API_URL=http://localhost:3001/api
```

This file serves as documentation. It tells every developer on the team which environment variables the application expects, with sensible default values. The `.env.example` file is committed to version control. The actual `.env.local` file (which might contain real credentials) is not.

Notice that we have two URL variables. We will explore why in the next steps.

### Step 2: Why Two API URL Variables

Look at how each variable is used in the codebase.

In `src/lib/api-client.ts` (used by Client Components):

```ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
```

In `src/lib/api-server.ts` (used by Server Components):

```ts
const API_BASE_URL =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
```

The client-side API client uses `NEXT_PUBLIC_API_URL` because it must be available in the browser. When a Client Component calls `createStartup()` or `upvoteStartup()`, the request originates from the user's browser and goes to the public-facing API URL.

The server-side API functions use `API_URL` first, falling back to `NEXT_PUBLIC_API_URL`. This is important because in many deployment architectures, the server can reach the backend through an internal network address. For example:

- The public URL might be `https://api.launchpad.dev` (goes through a load balancer, CDN, etc.)
- The internal URL might be `http://backend-service:3001/api` (direct service-to-service call inside a Docker network or Kubernetes cluster)

Using the internal URL for server-to-server calls is faster (no extra network hops) and more secure (the internal port does not need to be exposed to the internet). The `API_URL` variable (without the `NEXT_PUBLIC_` prefix) stays on the server and never appears in the client bundle.

### Step 3: Setting Up Your Local Environment

To get started developing, copy the example file:

```bash
cp .env.example .env.local
```

The `.env.local` file is automatically loaded by Next.js and is listed in `.gitignore`. Each developer can customize values without affecting the rest of the team.

For local development, the default values usually work as-is:

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api
API_URL=http://localhost:3001/api
```

Both point to the same local backend. This is typical for development where the frontend and backend run on the same machine.

### Step 4: Environment-Specific Files

For staging and production, you can create environment-specific files or set variables through your deployment platform.

Using .env files:

```bash
# .env.development (committed to git, shared defaults for dev)
NEXT_PUBLIC_API_URL=http://localhost:3001/api
API_URL=http://localhost:3001/api

# .env.production (committed to git, production defaults)
NEXT_PUBLIC_API_URL=https://api.launchpad.dev
API_URL=http://backend-service:3001/api
```

Using deployment platform settings (preferred for production):

Most hosting platforms (Vercel, Netlify, AWS, Railway) let you set environment variables through their dashboard or CLI. These override anything in .env files.

```bash
# Set via Vercel CLI
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://api.launchpad.dev

vercel env add API_URL production
# Enter: http://backend-service:3001/api
```

Setting variables through the deployment platform is preferred for production because the values never touch version control and can be rotated without code changes.

### Step 5: Verifying Variable Availability

A common debugging scenario is a variable being undefined when you expect it to have a value. Here is how to verify:

For server-side variables, add a temporary log to a Server Component or server action:

```ts
// In a Server Component
console.log('API_URL:', process.env.API_URL);
console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
```

Both variables will print their values because Server Components have access to all environment variables.

For client-side variables, add a temporary log to a Client Component:

```ts
// In a Client Component
'use client';

console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
console.log('API_URL:', process.env.API_URL); // undefined!
```

The `NEXT_PUBLIC_` variable will have its value. The non-prefixed variable will be `undefined` because Next.js excluded it from the client bundle.

If a `NEXT_PUBLIC_` variable is undefined in the client, the most common cause is that you added it after the dev server started. You need to restart the dev server for new `NEXT_PUBLIC_` variables to be picked up, because they are injected at build time (or dev server startup time).

### Step 6: Security Considerations

Never put secrets in `NEXT_PUBLIC_` variables. This is the most important rule. Anything with the `NEXT_PUBLIC_` prefix ends up in the JavaScript bundle that is sent to every user's browser. If you search the browser's Network tab or view the page source, you can find these values.

Variables that are safe for `NEXT_PUBLIC_`:

- API base URLs (the backend address is visible in network requests anyway)
- Public API keys (like a Google Maps client key that is restricted by domain)
- Feature flags
- Analytics IDs

Variables that must stay server-only (no `NEXT_PUBLIC_` prefix):

- Database connection strings
- JWT signing secrets
- API keys with write access
- OAuth client secrets
- Encryption keys

If you accidentally put a secret in a `NEXT_PUBLIC_` variable and deployed it, you should consider that secret compromised. Rotate it immediately even after fixing the variable name.

### Step 7: Creating a Configuration Module

Rather than scattering `process.env` access throughout your codebase, centralize it in a configuration module:

```ts
// src/lib/config.ts

// Client-safe configuration
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  appName: 'LaunchPad',
  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV === 'development',
} as const;
```

For server-only configuration, use a separate file:

```ts
// src/lib/config.server.ts

// Server-only configuration - never import this in Client Components
export const serverConfig = {
  apiUrl:
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001/api',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  databaseUrl: process.env.DATABASE_URL || '',
} as const;
```

This pattern has several benefits. All configuration is defined in one place, so when you need to change a default or add validation, there is only one file to update. IDE autocompletion works because you are importing a typed object instead of calling `process.env` with a string. And the separation into `config.ts` and `config.server.ts` makes the security boundary explicit.

To enforce the boundary, you can use Next.js's `server-only` package:

```ts
// src/lib/config.server.ts
import 'server-only';

export const serverConfig = {
  // ...
};
```

If any Client Component tries to import `config.server.ts`, the build will fail with a clear error message. This catches accidental secret exposure at build time rather than in production.

### Step 8: Validating Environment Variables at Startup

Missing environment variables often cause confusing runtime errors. It is better to fail fast with a clear message. Add validation to your configuration:

```ts
// src/lib/config.ts

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      'Missing required environment variable: ' + name +
      '. Check your .env.local file.'
    );
  }
  return value;
}

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
} as const;

// Server-side validation (runs at import time)
if (typeof window === 'undefined') {
  // These checks only run on the server
  if (process.env.NODE_ENV === 'production' && !process.env.API_URL) {
    console.warn(
      'Warning: API_URL is not set. Falling back to NEXT_PUBLIC_API_URL.'
    );
  }
}
```

The `typeof window === 'undefined'` check ensures the server-side validations do not run in the browser where those variables would not exist anyway.

For a more thorough approach, libraries like zod can validate the entire environment at startup:

```ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001/api'),
  API_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
```

If any variable is missing or has an invalid format, the application crashes immediately with a descriptive error instead of failing mysteriously later.

### Step 9: Environment Variables in Docker

If you deploy with Docker, environment variables are set through the Dockerfile, docker-compose.yml, or at runtime:

```yaml
# docker-compose.yml
services:
  frontend:
    build:
      context: ./frontend
      args:
        # Build-time args for NEXT_PUBLIC_ vars
        NEXT_PUBLIC_API_URL: https://api.launchpad.dev
    environment:
      # Runtime vars for server-only code
      API_URL: http://backend:3001/api
      JWT_SECRET: ${JWT_SECRET}
```

In the Dockerfile, build arguments become available during the build step:

```dockerfile
FROM node:20-alpine AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build
```

This is where the build-time vs runtime distinction really matters. `NEXT_PUBLIC_` variables must be available when `npm run build` runs because they get inlined into the JavaScript. Server-only variables can be passed at container startup time.

### Step 10: The Complete Configuration Picture

Let us put it all together. Here is how configuration flows through a Next.js application for the LaunchPad project:

Development:

- Developer copies `.env.example` to `.env.local`
- `next dev` loads `.env.local` and `.env.development`
- Both `NEXT_PUBLIC_API_URL` and `API_URL` point to `localhost:3001`
- Client Components and Server Components both reach the same local backend

Staging:

- CI/CD sets `NEXT_PUBLIC_API_URL=https://api-staging.launchpad.dev` as a build argument
- CI/CD sets `API_URL=http://backend-staging:3001/api` as a runtime environment variable
- `next build` embeds the public URL into client JavaScript
- At runtime, Server Components use the internal URL for faster API calls

Production:

- Same pattern as staging with production URLs
- `JWT_SECRET` and other secrets are set through the hosting platform's secret management
- No secrets appear in `.env` files or version control

The api-client.ts (client-side) always uses the public URL because the request comes from the user's browser:

```ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
```

The api-server.ts (server-side) prefers the internal URL and falls back to the public one:

```ts
const API_BASE_URL =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
```

This dual-URL pattern is standard in production Next.js applications and optimizes both security and performance.

## Exercise

1. Create a `.env.local` file by copying `.env.example`. Verify that the frontend connects to the backend correctly.
2. Change `NEXT_PUBLIC_API_URL` to a different port (like 3099) and observe the error. Then change it back.
3. Try accessing `process.env.API_URL` in a Client Component. Confirm that it is `undefined`. Then access it in a Server Component and confirm it has the correct value.
4. Create the `src/lib/config.ts` module from Step 7. Refactor api-client.ts to import from it instead of reading `process.env` directly.
5. Add a startup validation check that logs a warning if `NEXT_PUBLIC_API_URL` is still set to localhost when `NODE_ENV` is production.
6. Create a `.env.production` file with a placeholder production URL. Run `next build` and inspect the built JavaScript to find the embedded URL value. (Search the `.next/static` folder for the URL string.)

## Summary

Environment variables are the standard way to externalize configuration from code. Next.js enforces a clear security boundary: variables prefixed with `NEXT_PUBLIC_` are embedded in the client bundle and visible to users, while unprefixed variables are only available in server-side code.

Our LaunchPad frontend uses two API URL variables for good reason. `NEXT_PUBLIC_API_URL` is the public-facing URL used by Client Components when the browser makes requests. `API_URL` is the internal URL used by Server Components for faster, more secure server-to-server communication. The fallback chain in api-server.ts (`API_URL` then `NEXT_PUBLIC_API_URL` then `localhost`) ensures the application works in every environment from local development to production.

The `.env.example` file documents which variables the project expects. The `.env.local` file holds each developer's local values and is never committed to version control. Environment-specific files (`.env.development`, `.env.production`) provide shared defaults. And in production, the hosting platform's secret management is the safest place for sensitive configuration.
