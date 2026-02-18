# REST Principles

Before writing more code, we need to understand the rules of the game. REST is not a framework or a library -- it is a set of architectural conventions that make APIs predictable and easy to use. In this lesson, you will learn how to design APIs that developers actually enjoy working with.

## What You'll Learn

- What REST architecture is and why it matters
- How resources, URIs, and HTTP methods work together
- The meaning of every important HTTP status code
- How to map CRUD operations to HTTP methods
- The complete endpoint design for the LaunchPad API
- What idempotency and safety mean for HTTP methods

## What Is REST?

REST stands for Representational State Transfer. It was described by Roy Fielding in his 2000 doctoral dissertation as an architectural style for building networked applications. The key idea is simple: treat everything as a resource that can be accessed and manipulated through a uniform interface.

In practice, REST means:

1. Every piece of data is a resource with a unique URL
2. You use standard HTTP methods to interact with resources
3. The server is stateless -- each request contains all the information needed to process it
4. Responses include everything the client needs, in a standard format like JSON

When an API follows these conventions, any developer can guess how it works without reading documentation. If you know the API has a "startups" resource, you already know that `GET /api/startups` returns a list and `POST /api/startups` creates a new one.

## Concepts

### Resources and URIs

A resource is any piece of data your API manages. In the LaunchPad API, our resources are:

- Startups (the core resource -- startup companies listed on the platform)
- Categories (industry categories like SaaS, Fintech, HealthTech)
- Users (people who submit and manage startups)

Each resource has a URI (Uniform Resource Identifier) that uniquely identifies it. URIs follow a predictable pattern:

```
/api/startups          → the collection of all startups
/api/startups/1        → a specific startup with ID 1
/api/startups/1/logo   → a sub-resource (the logo of startup 1)
/api/categories        → the collection of all categories
/api/users             → the collection of all users
/api/users/42          → a specific user with ID 42
```

URI naming conventions:

- Use nouns, not verbs: `/api/startups` not `/api/getStartups`
- Use plural nouns: `/api/startups` not `/api/startup`
- Use lowercase with hyphens: `/api/funding-rounds` not `/api/fundingRounds`
- Nest resources to show relationships: `/api/users/42/startups` for startups belonging to user 42
- Keep URIs short and intuitive -- if you need more than three levels of nesting, reconsider your design

### HTTP Methods (Verbs)

HTTP defines several methods (also called verbs) that indicate what action you want to perform on a resource. The four primary ones map directly to CRUD operations:

| HTTP Method | CRUD Operation | Description |
|-------------|---------------|-------------|
| GET | Read | Retrieve a resource or list of resources |
| POST | Create | Create a new resource |
| PUT | Update | Replace an existing resource entirely |
| DELETE | Delete | Remove a resource |

There are additional methods worth knowing:

| HTTP Method | Description |
|-------------|-------------|
| PATCH | Partially update a resource (change specific fields only) |
| HEAD | Same as GET but returns only headers, no body |
| OPTIONS | Returns the HTTP methods that a resource supports |

The distinction between PUT and PATCH matters. PUT replaces the entire resource -- you send all fields, even ones that did not change. PATCH sends only the fields you want to update. In practice, many APIs use PUT for both full and partial updates, which is technically incorrect but very common.

For the LaunchPad API, we will use PUT for updates and expect the client to send all required fields.

### HTTP Status Codes

Status codes tell the client what happened with their request. They are grouped into ranges:

- 1xx: Informational (rarely used directly)
- 2xx: Success
- 3xx: Redirection
- 4xx: Client error (the client did something wrong)
- 5xx: Server error (something broke on the server)

Here are the status codes you will use most often when building APIs:

Success codes:

| Code | Name | When to Use |
|------|------|------------|
| 200 | OK | General success. GET requests, successful updates. |
| 201 | Created | A new resource was created. Use for successful POST requests. |
| 204 | No Content | Success, but no body to return. Use for successful DELETE requests. |

Client error codes:

| Code | Name | When to Use |
|------|------|------------|
| 400 | Bad Request | The request body is malformed or missing required fields. |
| 401 | Unauthorized | The client is not authenticated (no valid credentials). |
| 403 | Forbidden | The client is authenticated but lacks permission. |
| 404 | Not Found | The requested resource does not exist. |
| 409 | Conflict | The request conflicts with existing data (duplicate email, etc). |
| 422 | Unprocessable Entity | The request body is valid JSON but fails validation rules. |

Server error codes:

| Code | Name | When to Use |
|------|------|------------|
| 500 | Internal Server Error | Something unexpected went wrong on the server. |

A common mistake is returning 200 for everything and putting error information in the response body. This makes life harder for clients because they cannot use status codes to quickly determine if a request succeeded. Always use the appropriate status code.

### Request and Response Formats

Modern REST APIs almost exclusively use JSON for both requests and responses. The client indicates what format it is sending with the `Content-Type` header and what format it expects back with the `Accept` header:

```
POST /api/startups HTTP/1.1
Content-Type: application/json
Accept: application/json

{
  "name": "LaunchPad",
  "category": "SaaS",
  "description": "A platform for launching startups"
}
```

The server response includes the status code, headers, and a JSON body:

```
HTTP/1.1 201 Created
Content-Type: application/json

{
  "data": {
    "id": 1,
    "name": "LaunchPad",
    "category": "SaaS",
    "description": "A platform for launching startups",
    "createdAt": "2026-02-17T10:00:00.000Z"
  }
}
```

Notice the response wraps the resource in a `data` property. This is called a response envelope. It gives you room to add metadata alongside the data:

```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "perPage": 20
  }
}
```

We will use this envelope pattern throughout the LaunchPad API. Every successful response will have a `data` property. Error responses will have an `error` property instead:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Startup with ID 999 not found"
  }
}
```

This consistency makes it easy for frontend developers to handle responses -- they always know where to find the data or the error.

### Idempotency and Safety

Two important properties of HTTP methods are safety and idempotency:

A method is safe if it does not modify any data. GET and HEAD are safe -- calling them a hundred times will not change anything on the server.

A method is idempotent if calling it multiple times produces the same result as calling it once. GET, PUT, and DELETE are idempotent:

- GET /api/startups/1 returns the same startup every time (safe and idempotent)
- PUT /api/startups/1 with the same body will result in the same state every time (idempotent but not safe)
- DELETE /api/startups/1 deletes the startup the first time, and subsequent calls just return 404 -- the end state is the same (idempotent but not safe)

POST is neither safe nor idempotent. Calling `POST /api/startups` three times with the same body creates three separate startups, each with its own ID.

Why does this matter? Network failures. If a client sends a PUT request and the connection drops before receiving the response, it can safely retry the request because PUT is idempotent. The result will be the same whether the server processed the first request or not. With POST, the client needs to be more careful to avoid creating duplicates.

## The LaunchPad API Resource Map

Let us design every endpoint the LaunchPad API will support. We will implement these over the next several lessons.

### Startups Resource

Startups are the core resource. Each startup has a name, slug, description, category, founder, website, and funding information.

| Method | Endpoint | Description | Status Code |
|--------|----------|-------------|-------------|
| GET | /api/startups | List all startups | 200 |
| GET | /api/startups/:id | Get a single startup | 200 / 404 |
| POST | /api/startups | Create a new startup | 201 / 400 |
| PUT | /api/startups/:id | Update a startup | 200 / 404 / 400 |
| DELETE | /api/startups/:id | Delete a startup | 204 / 404 |

The `:id` in the URL is a route parameter. Express will extract the value and make it available as `req.params.id`. For example, a request to `/api/startups/7` will have `req.params.id` equal to `"7"`.

Here is what the startup data looks like:

```json
{
  "id": 1,
  "name": "CodeBrew",
  "slug": "codebrew",
  "description": "AI-powered code review platform",
  "category": "Developer Tools",
  "founder": "Alex Chen",
  "website": "https://codebrew.dev",
  "fundingStage": "Series A",
  "fundingAmount": 5000000,
  "employeeCount": 25,
  "founded": 2024,
  "createdAt": "2026-01-15T08:00:00.000Z",
  "updatedAt": "2026-02-10T12:30:00.000Z"
}
```

### Categories Resource

Categories are simpler. They are a lookup table used to tag startups.

| Method | Endpoint | Description | Status Code |
|--------|----------|-------------|-------------|
| GET | /api/categories | List all categories | 200 |
| GET | /api/categories/:id | Get a single category | 200 / 404 |

We make categories read-only through the API. In a real application, you might have an admin panel that manages categories separately.

Category data:

```json
{
  "id": 1,
  "name": "SaaS",
  "slug": "saas",
  "description": "Software as a Service products"
}
```

### Users Resource

Users represent the people who submit startups to the platform.

| Method | Endpoint | Description | Status Code |
|--------|----------|-------------|-------------|
| GET | /api/users | List all users | 200 |
| GET | /api/users/:id | Get a single user | 200 / 404 |
| POST | /api/users | Create a new user | 201 / 400 / 409 |

Note the 409 (Conflict) status code for user creation. If someone tries to create a user with an email that already exists, we return 409 instead of 400. This tells the client specifically that the data conflicts with existing data, not that the request was malformed.

User data:

```json
{
  "id": 1,
  "name": "Alex Chen",
  "email": "alex@codebrew.dev",
  "role": "founder",
  "createdAt": "2026-01-10T09:00:00.000Z"
}
```

### Utility Endpoints

| Method | Endpoint | Description | Status Code |
|--------|----------|-------------|-------------|
| GET | /health | Server health check | 200 |

We already built this one in Lesson 01.

## Request Examples

Let us look at what actual requests and responses will look like for each operation.

### List All Startups

Request:
```
GET /api/startups HTTP/1.1
Host: localhost:3000
Accept: application/json
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "name": "CodeBrew",
      "slug": "codebrew",
      "description": "AI-powered code review platform",
      "category": "Developer Tools",
      "founder": "Alex Chen",
      "website": "https://codebrew.dev",
      "fundingStage": "Series A",
      "fundingAmount": 5000000,
      "employeeCount": 25,
      "founded": 2024,
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-01-15T08:00:00.000Z"
    }
  ]
}
```

### Get a Single Startup

Request:
```
GET /api/startups/1 HTTP/1.1
```

Response (200):
```json
{
  "data": {
    "id": 1,
    "name": "CodeBrew",
    "slug": "codebrew",
    "description": "AI-powered code review platform",
    "category": "Developer Tools",
    "founder": "Alex Chen",
    "website": "https://codebrew.dev",
    "fundingStage": "Series A",
    "fundingAmount": 5000000,
    "employeeCount": 25,
    "founded": 2024,
    "createdAt": "2026-01-15T08:00:00.000Z",
    "updatedAt": "2026-01-15T08:00:00.000Z"
  }
}
```

Response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Startup with ID 999 not found"
  }
}
```

### Create a Startup

Request:
```
POST /api/startups HTTP/1.1
Content-Type: application/json

{
  "name": "DataVault",
  "description": "Secure cloud data management",
  "category": "Cloud Infrastructure",
  "founder": "Sarah Kim",
  "website": "https://datavault.io",
  "fundingStage": "Seed",
  "fundingAmount": 1500000,
  "employeeCount": 8,
  "founded": 2025
}
```

Response (201):
```json
{
  "data": {
    "id": 2,
    "name": "DataVault",
    "slug": "datavault",
    "description": "Secure cloud data management",
    "category": "Cloud Infrastructure",
    "founder": "Sarah Kim",
    "website": "https://datavault.io",
    "fundingStage": "Seed",
    "fundingAmount": 1500000,
    "employeeCount": 8,
    "founded": 2025,
    "createdAt": "2026-02-17T14:00:00.000Z",
    "updatedAt": "2026-02-17T14:00:00.000Z"
  }
}
```

Notice that the client does not send the `id`, `slug`, `createdAt`, or `updatedAt` fields. The server generates those automatically. The slug is derived from the name (lowercased, spaces replaced with hyphens).

### Update a Startup

Request:
```
PUT /api/startups/2 HTTP/1.1
Content-Type: application/json

{
  "name": "DataVault",
  "description": "Enterprise-grade secure cloud data management",
  "category": "Cloud Infrastructure",
  "founder": "Sarah Kim",
  "website": "https://datavault.io",
  "fundingStage": "Series A",
  "fundingAmount": 8000000,
  "employeeCount": 35,
  "founded": 2025
}
```

Response (200):
```json
{
  "data": {
    "id": 2,
    "name": "DataVault",
    "slug": "datavault",
    "description": "Enterprise-grade secure cloud data management",
    "category": "Cloud Infrastructure",
    "founder": "Sarah Kim",
    "website": "https://datavault.io",
    "fundingStage": "Series A",
    "fundingAmount": 8000000,
    "employeeCount": 35,
    "founded": 2025,
    "createdAt": "2026-02-17T14:00:00.000Z",
    "updatedAt": "2026-02-17T15:30:00.000Z"
  }
}
```

The `updatedAt` timestamp changed but `createdAt` stayed the same. The server updates the timestamp automatically on every modification.

### Delete a Startup

Request:
```
DELETE /api/startups/2 HTTP/1.1
```

Response (204): No body. The 204 status code means "success, nothing to return."

If the startup does not exist:

Response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Startup with ID 999 not found"
  }
}
```

## Common API Design Mistakes

Here are patterns to avoid:

1. Using verbs in URLs: `/api/getStartups` or `/api/deleteStartup/1` -- the HTTP method already communicates the action.

2. Returning 200 for errors: Always use the appropriate status code. A 400 tells the client to fix their request. A 500 tells them to try again later.

3. Inconsistent naming: If you use plural for one resource (`/api/startups`), use plural for all of them. Do not mix `/api/startups` and `/api/category`.

4. Deeply nested URLs: `/api/users/1/startups/5/comments/12/replies/3` is hard to use. Flatten it to `/api/replies/3` when the resource has its own identity.

5. Not using response envelopes: Returning a bare array `[...]` makes it impossible to add pagination metadata later without breaking existing clients. Always wrap in `{ "data": [...] }`.

6. Ignoring content types: Always set `Content-Type: application/json` on responses. Some clients depend on this header to parse the response correctly.

## Try It Yourself

1. Design a set of REST endpoints for a "comments" resource that belongs to startups. Consider: what URL pattern would you use? What methods? What status codes? Write out the full endpoint table following the format used in this lesson.

2. For each of the following scenarios, determine the correct HTTP method and status code:
   - A client requests a list of categories and there are none (the list is empty)
   - A client tries to create a startup but forgets to include the name field
   - A client sends a DELETE request for a startup that was already deleted
   - A client sends a PUT request with valid data for an existing startup

3. Look at a public API you use regularly (GitHub, Stripe, Twitter). Check whether their endpoint design follows the REST conventions described in this lesson. Note any deviations you find.

## Key Takeaways

- REST is an architectural style that uses resources, URIs, and HTTP methods to create predictable APIs
- Resources are nouns (startups, users, categories) and HTTP methods are verbs (GET, POST, PUT, DELETE)
- CRUD maps to HTTP: Create = POST, Read = GET, Update = PUT, Delete = DELETE
- Use specific HTTP status codes: 200 for success, 201 for created, 204 for no content, 400 for bad requests, 404 for not found
- Response envelopes ({ data: ... }) give you room to add metadata like pagination without breaking clients
- GET is safe and idempotent, POST is neither, PUT and DELETE are idempotent but not safe
- Good URI design uses plural nouns, lowercase with hyphens, and avoids unnecessary nesting

## Next Steps

Now that we have a clear plan for every endpoint, it is time to build them. In the next lesson, we will implement the full CRUD for startups using in-memory storage -- an array in our server code. This gets us working endpoints fast so we can test the API design before adding a real database.
