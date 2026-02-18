# Hello Express

Every great API starts with a single endpoint. In this lesson, you will set up an Express server from scratch using TypeScript and ESM modules, add essential middleware, and create your first endpoint -- a health check that proves your server is alive.

## What You'll Learn

- How to initialize a Node.js project with TypeScript and ESM modules
- How to install and configure Express with TypeScript
- How to create a basic server that listens on a port
- What middleware is and how Express uses it
- How to add JSON body parsing and CORS support
- How to set up a development workflow with hot reloading

## Why Express?

Express is the most widely used web framework for Node.js. It has been around since 2010 and powers millions of APIs in production. While newer frameworks like Fastify and Hono exist, Express remains the go-to choice for learning server-side development because:

- It has a massive ecosystem of middleware and plugins
- Nearly every Node.js tutorial and Stack Overflow answer references Express
- The concepts you learn transfer directly to other frameworks
- Version 4.x is battle-tested and stable

For the LaunchPad API we are building in this course, Express gives us everything we need without unnecessary complexity.

## Concepts

### What Is a Web Server?

A web server is a program that listens for incoming HTTP requests on a specific port and sends back responses. When you visit a website, your browser sends an HTTP request to a server. The server processes that request and returns HTML, JSON, or some other format.

In our case, we are building an API server. Instead of returning HTML pages, our server will return JSON data that frontend applications can consume.

### What Is Express?

Express is a minimal, unopinionated web framework for Node.js. It provides a thin layer on top of Node's built-in HTTP module, giving you:

- Routing: map URL paths to handler functions
- Middleware: a pipeline of functions that process each request
- Request/Response helpers: convenient methods for reading request data and sending responses

### ESM vs CommonJS

Node.js historically used CommonJS modules (require/module.exports). Modern JavaScript uses ES Modules (import/export). We will use ESM throughout this course because:

- It is the JavaScript standard
- It works in both browsers and Node.js
- TypeScript compiles to ESM naturally
- Most new packages are ESM-first

To enable ESM in a Node.js project, you add `"type": "module"` to your package.json.

## Step by Step

### Step 1: Initialize the Project

Create a new directory for your project and initialize it with npm:

```bash
mkdir launchpad-api
cd launchpad-api
npm init -y
```

This creates a package.json file. Now open it and add the `"type": "module"` field to enable ESM:

```json
{
  "name": "launchpad-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {},
  "dependencies": {},
  "devDependencies": {}
}
```

The `"type": "module"` line tells Node.js to treat all `.js` files as ES Modules. Without it, Node defaults to CommonJS and your `import` statements will fail.

### Step 2: Install Dependencies

Install Express and its companion packages:

```bash
npm install express cors dotenv
```

Here is what each package does:

- express: the web framework itself
- cors: middleware that handles Cross-Origin Resource Sharing (allows frontends on different domains to call your API)
- dotenv: loads environment variables from a .env file

Now install the TypeScript tooling:

```bash
npm install -D typescript tsx @types/node @types/express @types/cors
```

- typescript: the TypeScript compiler
- tsx: a TypeScript runner that supports ESM and provides hot reloading
- @types/node, @types/express, @types/cors: type definitions so TypeScript understands these packages

### Step 3: Configure TypeScript

Create a `tsconfig.json` file in your project root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

Key settings explained:

- target and module set to ES2022 give us modern JavaScript output with ESM support
- moduleResolution "bundler" allows importing without file extensions in TypeScript while still producing valid ESM output
- strict enables all TypeScript strict checks -- catches more bugs at compile time
- outDir "dist" puts compiled JavaScript in a dist folder
- rootDir "src" tells TypeScript our source code lives in src

### Step 4: Create the Express Server

Create the `src` directory and the main entry file:

```bash
mkdir src
```

Now create `src/index.ts` with the following content:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});

export default app;
```

Let us walk through this file line by line.

The first three lines import our dependencies using ESM `import` syntax. If we were using CommonJS, these would be `require()` calls instead.

`dotenv.config()` reads a `.env` file from the project root and adds its values to `process.env`. This lets you configure things like the port number without hardcoding them.

`const app = express()` creates an Express application instance. This object is the heart of your server -- you attach routes and middleware to it.

`const PORT = process.env.PORT || 3000` reads the port from environment variables, falling back to 3000 if none is set. This pattern is important because hosting platforms like Railway and Render set PORT automatically.

The middleware section comes next -- we will explain this in detail shortly.

`app.get('/health', ...)` registers a route handler. When someone sends a GET request to /health, Express calls the provided function with the request and response objects.

`app.listen(PORT, ...)` starts the server. It binds to the specified port and begins accepting connections. The callback runs once the server is ready.

`export default app` exports the app instance. This is useful later when writing tests -- you can import the app and test it without starting the actual server.

### Step 5: Understand Middleware

Middleware is one of the most important concepts in Express. A middleware function is any function that has access to the request object, the response object, and the next function in the pipeline.

Think of middleware as a series of checkpoints that every request passes through before reaching your route handler:

```
Request → CORS → JSON Parser → Route Handler → Response
```

Each middleware can:
1. Execute any code
2. Modify the request or response objects
3. End the request-response cycle (send a response)
4. Call `next()` to pass control to the next middleware

Here is what a custom middleware looks like:

```typescript
app.use((req, _res, next) => {
  console.log(req.method + ' ' + req.url + ' at ' + new Date().toISOString());
  next();
});
```

This logs every incoming request. The `next()` call is critical -- without it, the request gets stuck and never reaches your route handler. The client would wait forever and eventually time out.

Let us look at the two middleware functions we already added:

`app.use(cors())` -- This adds CORS headers to every response. Without CORS headers, browsers block requests from a frontend running on a different domain (for example, localhost:5173 trying to call localhost:3000). The cors middleware adds headers like `Access-Control-Allow-Origin` that tell the browser the request is allowed.

`app.use(express.json())` -- This parses incoming JSON request bodies. When a client sends a POST request with `Content-Type: application/json`, this middleware reads the raw body, parses it as JSON, and attaches the result to `req.body`. Without this middleware, `req.body` would be `undefined`.

### Step 6: Create the .env File

Create a `.env` file in the project root:

```
PORT=3000
```

Also create a `.env.example` file that you can commit to version control (the actual .env should be in .gitignore):

```
PORT=3000
```

And add a `.gitignore`:

```
node_modules
dist
*.db
.env
```

### Step 7: Add Package Scripts

Update your package.json scripts section:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

Here is what each script does:

- `npm run dev` -- Starts the server using tsx with file watching enabled. Whenever you save a file, tsx automatically restarts the server. This is your main development command.
- `npm run build` -- Compiles TypeScript to JavaScript in the dist folder. You run this before deploying.
- `npm start` -- Runs the compiled JavaScript. This is what you use in production.

The `tsx watch` command is similar to nodemon but built specifically for TypeScript. It understands ESM modules natively and restarts almost instantly when files change.

### Step 8: Start the Server

Run the development server:

```bash
npm run dev
```

You should see:

```
Server running on http://localhost:3000
```

### Step 9: Test the Health Check

Open a new terminal and test your endpoint:

```bash
curl http://localhost:3000/health
```

You should get back:

```json
{"status":"ok","timestamp":"2026-02-17T10:30:00.000Z"}
```

The timestamp will reflect the current time, of course. This health check endpoint is a standard practice in API development. Monitoring services, load balancers, and container orchestrators all use health checks to verify that your server is responsive.

You can also try requesting a route that does not exist:

```bash
curl http://localhost:3000/nonexistent
```

Express returns an HTML error page by default for unknown routes. Later in the course, we will add a custom 404 handler that returns JSON instead.

### Step 10: Add a Request Logger

Let us add a simple request-logging middleware to see incoming requests in our terminal. Update `src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(req.method + ' ' + req.url);
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});

export default app;
```

Now when you hit any endpoint, you will see the request logged in your terminal:

```
GET /health
```

This is a simple example, but production APIs often use more sophisticated logging middleware like morgan or pino-http that include response times, status codes, and structured logging.

## The Complete File

Here is the final `src/index.ts` for reference:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(req.method + ' ' + req.url);
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});

export default app;
```

## Try It Yourself

1. Add a `GET /api/info` endpoint that returns JSON with the API name, version, and a description. For example: `{ "name": "LaunchPad API", "version": "0.1.0", "description": "API for managing startup data" }`.

2. Add a custom middleware that adds an `X-Request-Id` header to every response. You can generate a simple ID using `crypto.randomUUID()` (available in Node.js 18+). This is a common pattern in production APIs for tracing requests through logs.

3. Try changing the PORT in your .env file to 4000, then restart the server. Verify it works on the new port. Notice how you did not need to change any code.

## Key Takeaways

- Express is a minimal web framework that handles routing and middleware for Node.js
- ESM modules use `import`/`export` syntax and require `"type": "module"` in package.json
- Middleware functions form a pipeline that processes every request before it reaches your route handler
- `express.json()` parses JSON request bodies and `cors()` allows cross-origin requests
- tsx with the watch flag provides hot reloading during development
- A health check endpoint is a standard practice that lets monitoring tools verify your server is running
- Environment variables keep configuration out of your code and make deployment easier

## Next Steps

Your server is running and responding to requests. But right now we only have one endpoint and no real structure. In the next lesson, we will learn the principles behind REST API design -- the conventions that make APIs intuitive, predictable, and pleasant to work with. We will plan out every endpoint the LaunchPad API needs before writing a single line of implementation code.
