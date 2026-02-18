# API Documentation

You have built a solid API with CRUD operations, validation, pagination, and tests. But if another developer (or your future self in six months) tries to use this API, they will be staring at code trying to figure out what endpoints exist, what parameters they accept, and what responses they return.

Documentation is how you make your API usable. In this lesson you will create comprehensive API documentation, learn the OpenAPI specification format, and build a spec for the LaunchPad API. Then we will wrap up the course and look at what comes next.

## What You Will Learn

- Why API documentation matters and who it serves
- Writing clear endpoint documentation with request and response examples
- The OpenAPI (Swagger) specification format
- Building an OpenAPI spec for the LaunchPad API
- Auto-generation vs manual documentation approaches
- Documenting error responses

## Concepts

### Why Document Your API?

APIs are products. Even if your only consumer is your own frontend team, they need to know how to use it. Documentation serves three audiences:

1. Other developers who consume your API. They need to know what endpoints exist, what data to send, and what to expect back.

2. Your future self. You will forget the details in a few months. Good docs save you from re-reading the source code.

3. Automated tools. OpenAPI specs can generate client SDKs, test suites, and interactive documentation automatically.

### What Good API Docs Include

For each endpoint, document:

- The HTTP method and URL path
- A description of what the endpoint does
- Path parameters (like `:id`)
- Query parameters with types, defaults, and constraints
- Request body schema with required and optional fields
- Response schema for success and error cases
- Example requests and responses
- Authentication requirements (if any)

### OpenAPI Specification

OpenAPI (formerly Swagger) is an industry-standard format for describing REST APIs. It is a YAML or JSON file that machines can read. From an OpenAPI spec, tools can:

- Generate interactive documentation (Swagger UI, Redoc)
- Generate client SDKs in any language
- Generate server stubs
- Validate requests and responses
- Run automated contract tests

The spec is verbose but structured. Once you learn the format, it is straightforward.

## Step by Step

### Step 1: Create the API Documentation

Create a `docs` directory and write the human-readable documentation.

Create `docs/api.md`:

```md
# LaunchPad API Documentation

Base URL: `http://localhost:3000`

## Overview

The LaunchPad API provides endpoints for managing startups and categories.
All responses use JSON format. List endpoints support pagination, sorting,
filtering, and search.

## Authentication

This version of the API does not require authentication. Authentication
will be added in a future course.

---

## Health Check

### GET /health

Check if the server is running.

Response (200):

    {
      "status": "ok",
      "timestamp": "2026-02-17T10:30:00.000Z"
    }

---

## Startups

### GET /api/startups

List startups with pagination, sorting, filtering, and search.

Query Parameters:

| Parameter | Type   | Default    | Description |
|-----------|--------|------------|-------------|
| page      | number | 1          | Page number (starts at 1) |
| limit     | number | 10         | Items per page (1-100) |
| sort      | string | created_at | Sort field: created_at, name, upvotes |
| order     | string | desc       | Sort order: asc, desc |
| category  | number | -          | Filter by category ID |
| search    | string | -          | Search in name and tagline |

Response (200):

    {
      "data": [
        {
          "id": 1,
          "name": "TechFlow AI",
          "tagline": "AI-powered workflow automation",
          "description": "...",
          "url": "https://techflow.ai",
          "category_id": 1,
          "upvotes": 42,
          "created_at": "2026-02-17T10:00:00.000Z",
          "updated_at": "2026-02-17T10:00:00.000Z",
          "category_name": "AI/ML"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 47,
        "totalPages": 5
      }
    }

Examples:

    GET /api/startups?page=2&limit=5
    GET /api/startups?sort=name&order=asc
    GET /api/startups?category=1&search=ai
    GET /api/startups?page=1&limit=20&sort=upvotes&order=desc

---

### GET /api/startups/:id

Get a single startup by ID.

Path Parameters:

| Parameter | Type   | Description |
|-----------|--------|-------------|
| id        | number | Startup ID  |

Response (200):

    {
      "data": {
        "id": 1,
        "name": "TechFlow AI",
        "tagline": "AI-powered workflow automation",
        "description": "TechFlow AI is a platform that uses...",
        "url": "https://techflow.ai",
        "category_id": 1,
        "upvotes": 42,
        "created_at": "2026-02-17T10:00:00.000Z",
        "updated_at": "2026-02-17T10:00:00.000Z",
        "category_name": "AI/ML"
      }
    }

Error Response (404):

    {
      "error": "Startup with id '999' not found"
    }

---

### POST /api/startups

Create a new startup.

Request Body:

| Field       | Type   | Required | Constraints |
|-------------|--------|----------|-------------|
| name        | string | yes      | 2-100 characters |
| tagline     | string | yes      | 10-200 characters |
| description | string | yes      | 50-2000 characters |
| url         | string | yes      | Must be a valid URL |
| category_id | number | yes      | Must be a positive integer |

Request:

    POST /api/startups
    Content-Type: application/json

    {
      "name": "CloudDeploy",
      "tagline": "Deploy anywhere in seconds with zero configuration",
      "description": "CloudDeploy is a deployment platform that automatically detects your framework, builds your application, and deploys it to the cloud.",
      "url": "https://clouddeploy.dev",
      "category_id": 2
    }

Response (201):

    {
      "data": {
        "id": 9,
        "name": "CloudDeploy",
        "tagline": "Deploy anywhere in seconds with zero configuration",
        "description": "CloudDeploy is a deployment platform...",
        "url": "https://clouddeploy.dev",
        "category_id": 2,
        "upvotes": 0,
        "created_at": "2026-02-17T10:35:00.000Z",
        "updated_at": "2026-02-17T10:35:00.000Z"
      }
    }

Error Response (400):

    {
      "error": "Validation failed",
      "details": [
        { "field": "name", "message": "Name is required" },
        { "field": "tagline", "message": "Tagline is required" }
      ]
    }

---

### PUT /api/startups/:id

Update an existing startup. Only include the fields you want to change.

Path Parameters:

| Parameter | Type   | Description |
|-----------|--------|-------------|
| id        | number | Startup ID  |

Request Body (all fields optional):

| Field       | Type   | Constraints |
|-------------|--------|-------------|
| name        | string | 2-100 characters |
| tagline     | string | 10-200 characters |
| description | string | 50-2000 characters |
| url         | string | Must be a valid URL |
| category_id | number | Must be a positive integer |

Request:

    PUT /api/startups/1
    Content-Type: application/json

    {
      "tagline": "The best AI workflow automation platform"
    }

Response (200):

    {
      "data": {
        "id": 1,
        "name": "TechFlow AI",
        "tagline": "The best AI workflow automation platform",
        "description": "...",
        "url": "https://techflow.ai",
        "category_id": 1,
        "upvotes": 42,
        "created_at": "2026-02-17T10:00:00.000Z",
        "updated_at": "2026-02-17T10:40:00.000Z"
      }
    }

Error Response (404):

    {
      "error": "Startup with id '999' not found"
    }

---

### DELETE /api/startups/:id

Delete a startup.

Path Parameters:

| Parameter | Type   | Description |
|-----------|--------|-------------|
| id        | number | Startup ID  |

Response (204): No content

Error Response (404):

    {
      "error": "Startup with id '999' not found"
    }

---

## Categories

### GET /api/categories

List all categories.

Response (200):

    {
      "data": [
        {
          "id": 1,
          "name": "AI/ML",
          "description": "Artificial Intelligence and Machine Learning",
          "created_at": "2026-02-17T10:00:00.000Z"
        }
      ]
    }

### GET /api/categories/:id

Get a single category by ID.

Response (200):

    {
      "data": {
        "id": 1,
        "name": "AI/ML",
        "description": "Artificial Intelligence and Machine Learning",
        "created_at": "2026-02-17T10:00:00.000Z"
      }
    }

Error Response (404):

    {
      "error": "Category not found"
    }

---

## Error Responses

All error responses follow a consistent format.

### Validation Errors (400)

Returned when the request body or query parameters fail validation.

    {
      "error": "Validation failed",
      "details": [
        {
          "field": "name",
          "message": "Name must be at least 2 characters"
        },
        {
          "field": "url",
          "message": "URL must be a valid URL (e.g. https://example.com)"
        }
      ]
    }

### Not Found Errors (404)

Returned when a requested resource does not exist.

    {
      "error": "Startup with id '999' not found"
    }

### Server Errors (500)

Returned when an unexpected error occurs. The response never exposes
internal details.

    {
      "error": "Internal server error"
    }
```

That is a complete, human-readable API reference. Every endpoint is documented with its parameters, request format, response format, and error cases. Anyone reading this file can start using the API immediately.

### Step 2: Create the OpenAPI Specification

Now create the machine-readable version. OpenAPI specs are typically written in YAML.

Create `docs/openapi.yaml`:

```yaml
openapi: 3.0.3
info:
  title: LaunchPad API
  description: API for the LaunchPad startup discovery platform.
  version: 1.0.0
  contact:
    name: LaunchPad Team

servers:
  - url: http://localhost:3000
    description: Local development server

paths:
  /health:
    get:
      summary: Health check
      description: Check if the server is running.
      tags:
        - System
      responses:
        '200':
          description: Server is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: ok
                  timestamp:
                    type: string
                    format: date-time

  /api/startups:
    get:
      summary: List startups
      description: >
        Returns a paginated list of startups. Supports sorting,
        filtering by category, and text search.
      tags:
        - Startups
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
          description: Page number
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 10
          description: Items per page
        - name: sort
          in: query
          schema:
            type: string
            enum: [created_at, name, upvotes]
            default: created_at
          description: Sort field
        - name: order
          in: query
          schema:
            type: string
            enum: [asc, desc]
            default: desc
          description: Sort order
        - name: category
          in: query
          schema:
            type: integer
          description: Filter by category ID
        - name: search
          in: query
          schema:
            type: string
          description: Search in name and tagline
      responses:
        '200':
          description: List of startups with pagination metadata
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Startup'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
        '400':
          description: Invalid query parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationError'

    post:
      summary: Create a startup
      description: Create a new startup listing.
      tags:
        - Startups
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateStartup'
      responses:
        '201':
          description: Startup created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Startup'
        '400':
          description: Validation failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationError'

  /api/startups/{id}:
    get:
      summary: Get a startup
      description: Get a single startup by ID.
      tags:
        - Startups
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
          description: Startup ID
      responses:
        '200':
          description: Startup found
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Startup'
        '404':
          description: Startup not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NotFoundError'

    put:
      summary: Update a startup
      description: Update an existing startup. Only include fields to change.
      tags:
        - Startups
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
          description: Startup ID
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateStartup'
      responses:
        '200':
          description: Startup updated successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Startup'
        '400':
          description: Validation failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationError'
        '404':
          description: Startup not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NotFoundError'

    delete:
      summary: Delete a startup
      description: Delete a startup by ID.
      tags:
        - Startups
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
          description: Startup ID
      responses:
        '204':
          description: Startup deleted (no content)
        '404':
          description: Startup not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NotFoundError'

  /api/categories:
    get:
      summary: List categories
      description: Returns all categories.
      tags:
        - Categories
      responses:
        '200':
          description: List of categories
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Category'

  /api/categories/{id}:
    get:
      summary: Get a category
      description: Get a single category by ID.
      tags:
        - Categories
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
          description: Category ID
      responses:
        '200':
          description: Category found
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Category'
        '404':
          description: Category not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NotFoundError'

components:
  schemas:
    Startup:
      type: object
      properties:
        id:
          type: integer
          example: 1
        name:
          type: string
          example: TechFlow AI
        tagline:
          type: string
          example: AI-powered workflow automation
        description:
          type: string
          example: TechFlow AI is a platform that...
        url:
          type: string
          format: uri
          example: https://techflow.ai
        category_id:
          type: integer
          example: 1
        upvotes:
          type: integer
          example: 42
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        category_name:
          type: string
          example: AI/ML

    CreateStartup:
      type: object
      required:
        - name
        - tagline
        - description
        - url
        - category_id
      properties:
        name:
          type: string
          minLength: 2
          maxLength: 100
          example: CloudDeploy
        tagline:
          type: string
          minLength: 10
          maxLength: 200
          example: Deploy anywhere in seconds with zero configuration
        description:
          type: string
          minLength: 50
          maxLength: 2000
          example: CloudDeploy is a deployment platform that automatically detects your framework and deploys it.
        url:
          type: string
          format: uri
          example: https://clouddeploy.dev
        category_id:
          type: integer
          minimum: 1
          example: 2

    UpdateStartup:
      type: object
      properties:
        name:
          type: string
          minLength: 2
          maxLength: 100
        tagline:
          type: string
          minLength: 10
          maxLength: 200
        description:
          type: string
          minLength: 50
          maxLength: 2000
        url:
          type: string
          format: uri
        category_id:
          type: integer
          minimum: 1

    Category:
      type: object
      properties:
        id:
          type: integer
          example: 1
        name:
          type: string
          example: AI/ML
        description:
          type: string
          example: Artificial Intelligence and Machine Learning
        created_at:
          type: string
          format: date-time

    Pagination:
      type: object
      properties:
        page:
          type: integer
          example: 1
        limit:
          type: integer
          example: 10
        total:
          type: integer
          example: 47
        totalPages:
          type: integer
          example: 5

    ValidationError:
      type: object
      properties:
        error:
          type: string
          example: Validation failed
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
                example: name
              message:
                type: string
                example: Name is required

    NotFoundError:
      type: object
      properties:
        error:
          type: string
          example: Startup with id '999' not found
```

That is a lot of YAML, but the structure is repetitive and predictable once you understand it. Let us walk through the key sections.

### Understanding the OpenAPI Structure

The `info` section describes the API at a high level: name, version, description.

The `servers` section lists where the API is hosted. You can list multiple servers (dev, staging, production).

The `paths` section is the bulk of the spec. Each path (like `/api/startups`) lists the HTTP methods it supports. Each method describes its parameters, request body, and responses.

The `components/schemas` section defines reusable data shapes. Instead of repeating the Startup schema in every endpoint, you define it once and reference it with `$ref: '#/components/schemas/Startup'`. This keeps the spec DRY.

### Step 3: Serve Interactive Documentation

You can turn the OpenAPI spec into interactive documentation with Swagger UI. There are a few options:

Option 1: Use the online Swagger Editor. Go to https://editor.swagger.io and paste your YAML. You get instant interactive docs.

Option 2: Serve Swagger UI from your Express app. Install the package:

```bash
npm install swagger-ui-express
npm install -D @types/swagger-ui-express
```

You would also need a YAML parser. Install `yamljs`:

```bash
npm install yamljs
npm install -D @types/yamljs
```

Then add a docs route to your app:

```ts
// Add to src/app.ts
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swaggerDocument = YAML.load(
  path.join(__dirname, '../docs/openapi.yaml')
);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
```

Now visit http://localhost:3000/docs to see interactive documentation where you can try out every endpoint directly in the browser.

This step is optional. Serving Swagger UI adds dependencies and complexity. For a small project or internal API, the markdown docs and the YAML spec may be sufficient. For a public-facing API, interactive docs are worth the effort.

### Step 4: Auto-Generation vs Manual Documentation

There are two schools of thought on API documentation:

Code-first (auto-generation): Write your code, then generate the spec from it. Libraries like `tsoa` or `express-openapi-validator` can generate OpenAPI specs from TypeScript decorators or route definitions. The advantage is that docs and code cannot drift apart. The disadvantage is that you are locked into the library's conventions.

Spec-first (manual): Write the OpenAPI spec first as a contract, then implement the code to match. The advantage is that the spec serves as the design document before you write any code. The disadvantage is that the spec can drift from the implementation if you are not careful.

For this course, we wrote the code first and the spec after. This is common in practice, especially when you are learning. For larger teams and public APIs, spec-first is generally better because it forces you to think about the API design before writing code.

A hybrid approach works well: write the spec manually but add validation middleware that checks requests and responses against the spec. The `express-openapi-validator` package does exactly this.

### Step 5: Document Error Conventions

One of the most overlooked parts of API documentation is error responses. Consumers need to know what error shapes to expect so they can handle them in their code.

Our API follows these error conventions:

1. All errors return a JSON object with an `error` field containing a human-readable message.

2. Validation errors (400) include a `details` array with field-level errors. Each detail has a `field` and `message`.

3. Not found errors (404) include a descriptive message that mentions the resource type and ID.

4. Server errors (500) return a generic message and never expose internal details.

Document these conventions clearly. Frontend developers will build error handling logic based on these patterns:

```ts
// Example frontend error handling
async function createStartup(data) {
  const res = await fetch('/api/startups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();

    if (res.status === 400 && error.details) {
      // Show field-level errors next to form inputs
      return { fieldErrors: error.details };
    }

    // Show generic error message
    return { error: error.error };
  }

  return { data: (await res.json()).data };
}
```

When your error format is consistent and documented, frontend code like this is straightforward to write.

## Course Recap

Over 10 lessons, you built a complete REST API from scratch. Let us review what you learned:

Lesson 01 -- Hello Express: Set up an Express server with TypeScript, added JSON body parsing and CORS.

Lesson 02 -- REST Principles: Learned the conventions that make APIs predictable: resources, HTTP methods, status codes, URL design.

Lesson 03 -- CRUD In Memory: Built Create, Read, Update, and Delete endpoints using in-memory arrays. Got the request-response cycle working before adding a database.

Lesson 04 -- SQLite Setup: Added better-sqlite3 as a persistent database, created tables, wrote a seed script.

Lesson 05 -- CRUD With Database: Moved the in-memory CRUD operations to use SQL queries against SQLite.

Lesson 06 -- Validation and Errors: Added Zod schema validation, custom error classes, and a global error handler. The API now rejects bad data with clear messages.

Lesson 07 -- Pagination and Filtering: Added pagination, sorting, category filtering, and text search to the list endpoint. Built dynamic SQL queries safely.

Lesson 08 -- Postman Pro: Learned to test APIs systematically with curl and Postman. Built a reusable test collection.

Lesson 09 -- Automated Tests: Set up Vitest and Supertest for integration testing. Wrote 25 tests covering CRUD, validation, pagination, and error handling.

Lesson 10 -- API Documentation: Created human-readable docs and an OpenAPI spec. Explored interactive documentation with Swagger UI.

### What You Built

The LaunchPad API has these endpoints:

```
GET    /health                 Health check
GET    /api/startups           List startups (paginated, filtered, sorted)
GET    /api/startups/:id       Get a single startup
POST   /api/startups           Create a startup (validated)
PUT    /api/startups/:id       Update a startup (validated)
DELETE /api/startups/:id       Delete a startup
GET    /api/categories         List categories
GET    /api/categories/:id     Get a single category
```

The project structure looks like this:

```
src/
  app.ts                   Express app configuration
  index.ts                 Server startup
  db/
    index.ts               Database connection and schema
    seed.ts                Seed data script
  routes/
    startups.ts            Startup CRUD routes
    categories.ts          Category routes
  middleware/
    validate.ts            Zod validation middleware
    error-handler.ts       Global error handler
    async-handler.ts       Async error wrapper
  schemas/
    startup.ts             Zod schemas and TypeScript types
  errors.ts                Custom error classes
tests/
  setup.ts                 Test database setup
  startups.test.ts         Startup integration tests
  categories.test.ts       Category integration tests
docs/
  api.md                   Human-readable API documentation
  openapi.yaml             OpenAPI 3.0 specification
vitest.config.ts           Test runner configuration
```

### Where This Connects to Course 04

In Course 04, you will connect the frontend you built in Course 02 to this API. Instead of mock data, the frontend will make real HTTP requests to your Express server. You will handle loading states, error states, and optimistic updates. The API documentation you wrote here will serve as the contract between the frontend and backend.

You will also add authentication so users can sign in, submit their own startups, and upvote others. The API structure you built here -- routes, validation, error handling -- will extend naturally to support authenticated endpoints.

## File Summary

Here is every file you created in this lesson:

- `docs/api.md` -- Human-readable API documentation with examples for every endpoint
- `docs/openapi.yaml` -- OpenAPI 3.0 specification for the LaunchPad API

Optional additions:
- `src/app.ts` -- Updated to serve Swagger UI at /docs (if you chose to add it)

## Key Takeaways

- API documentation is not optional. Undocumented APIs are unusable APIs.
- Document every endpoint with its parameters, request body, responses, and error cases.
- OpenAPI is the industry standard for machine-readable API specs. Learn the format.
- Interactive documentation (Swagger UI) lets consumers try endpoints without writing code.
- Error response documentation is just as important as success response documentation.
- Consistent error formats make frontend error handling straightforward.
- Choose between code-first and spec-first documentation based on your team size and API audience.

## Exercises

1. Add Swagger UI to your Express app and verify that all endpoints work from the interactive docs.

2. Add descriptions to the OpenAPI spec for every field in the Startup schema. Explain what each field represents and any business rules.

3. Use an OpenAPI code generator (like `openapi-generator-cli`) to generate a TypeScript client SDK from your spec. See how it creates typed functions for each endpoint.

4. Add a versioning strategy to your API. Prefix all routes with `/api/v1/` and update the OpenAPI spec to reflect this. Discuss why API versioning matters.

5. Write a simple script that validates your OpenAPI spec is syntactically correct using the `@apidevtools/swagger-parser` npm package.

## What Comes Next

You have a fully functional, tested, and documented REST API. In Course 04 (Full-Stack Integration), you will connect the React frontend from Course 02 to this backend. Real data, real HTTP requests, real error handling. Everything comes together.
