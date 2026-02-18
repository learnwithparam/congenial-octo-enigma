# API Contracts

Every modern web application is a conversation between a frontend and a backend. API contracts are the rules of that conversation — they define exactly what the frontend can ask for, what format the request should be in, and what the backend promises to send back. Without clear API contracts, teams waste hours debugging miscommunication between client and server code. In this lesson, you will design the complete API surface for LaunchPad, our startup directory application.

## What You'll Learn

- What API contracts are and why defining them early saves significant development time
- RESTful conventions for naming resources, choosing HTTP methods, and returning status codes
- How to design request and response schemas for every endpoint in LaunchPad
- Pagination strategies and when to use offset-based vs cursor-based pagination
- How to think about error responses consistently across your entire API

## Concepts

### What Is an API Contract?

An API contract is a formal agreement between the frontend and backend about how they communicate. Think of it like a restaurant menu — the menu tells you exactly what dishes are available, what ingredients they contain, and how much they cost. You do not need to know how the kitchen prepares the food. You just need to know what you can order and what you will receive.

In software terms, an API contract specifies:

- The URL path for each endpoint (e.g., `/api/startups`)
- The HTTP method (GET, POST, PUT, DELETE)
- What data the client must send (request body, query parameters, headers)
- What data the server will return (response body, status code)
- What errors might occur and how they are communicated

### Why Define Contracts Before Writing Code?

When you define API contracts before implementation, several good things happen:

1. The frontend and backend teams can work in parallel. The frontend developer can build the UI using mock data that matches the contract, while the backend developer builds the actual endpoints.

2. You catch design issues early. If an endpoint is missing data the frontend needs, you discover that during planning rather than during a stressful demo.

3. Testing becomes straightforward. You can write integration tests that verify your API matches the contract.

4. Onboarding is faster. New developers can read the API contracts to understand the entire application's data flow without reading source code.

### RESTful Conventions

REST (Representational State Transfer) is an architectural style for designing APIs. It gives us a shared vocabulary so that any developer who sees your API can immediately understand its structure.

Here are the core conventions:

Resource Naming: Use plural nouns for collections. The URL `/api/startups` returns a list of startups. The URL `/api/startups/42` returns a single startup with ID 42. Avoid verbs in URLs — the HTTP method already tells us the action.

HTTP Methods and Their Meanings:

| Method | Purpose | Example | Idempotent? |
|--------|---------|---------|-------------|
| GET | Read a resource | GET /api/startups | Yes |
| POST | Create a resource | POST /api/startups | No |
| PUT | Update a resource (full) | PUT /api/startups/42 | Yes |
| PATCH | Update a resource (partial) | PATCH /api/startups/42 | Yes |
| DELETE | Remove a resource | DELETE /api/startups/42 | Yes |

Idempotent means that making the same request multiple times produces the same result. GET, PUT, and DELETE are idempotent — deleting the same resource twice does not create a different outcome than deleting it once. POST is not idempotent — posting the same data twice creates two resources.

Nested Resources: When one resource belongs to another, nest the URL. For example, upvotes belong to a startup, so the endpoint is `POST /api/startups/:id/upvote`. Comments on a startup would be `GET /api/startups/:id/comments`.

### HTTP Status Codes

Status codes tell the client what happened with their request. You do not need to memorize all of them, but you should know the essential ones:

Success codes (2xx):
- 200 OK — The request succeeded. Used for GET, PUT, PATCH, and DELETE responses.
- 201 Created — A new resource was created. Used for successful POST requests. Include the created resource in the response body.
- 204 No Content — The request succeeded but there is nothing to return. Sometimes used for DELETE.

Client error codes (4xx):
- 400 Bad Request — The request body is malformed or missing required fields. Your response should explain what went wrong.
- 401 Unauthorized — The client is not authenticated. They need to log in.
- 403 Forbidden — The client is authenticated but does not have permission for this action.
- 404 Not Found — The requested resource does not exist.
- 409 Conflict — The request conflicts with existing data (e.g., trying to register with an email that is already taken).
- 422 Unprocessable Entity — The request is well-formed but contains validation errors (e.g., a startup name that exceeds the character limit).

Server error codes (5xx):
- 500 Internal Server Error — Something went wrong on the server. The client did nothing wrong.

A good rule of thumb: if the client made a mistake, return a 4xx code. If the server made a mistake, return a 5xx code.

## Step by Step

### Step 1: Design a Consistent Response Envelope

Before defining individual endpoints, establish a consistent response format. Every API response from LaunchPad will follow one of these shapes:

Success response for a single resource:

```json
{
  "data": {
    "id": "abc123",
    "name": "LaunchPad",
    "...": "..."
  }
}
```

Success response for a list of resources:

```json
{
  "data": [
    { "id": "abc123", "name": "Startup One" },
    { "id": "def456", "name": "Startup Two" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

Error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Startup name is required",
    "details": [
      {
        "field": "name",
        "message": "Name must be between 3 and 100 characters"
      }
    ]
  }
}
```

This consistency means the frontend can write a single API helper function that knows exactly how to extract data or handle errors from any endpoint.

### Step 2: Startups — List and Search

This is the most complex endpoint because it supports pagination, search, and filtering.

Endpoint: `GET /api/startups`

Query Parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number for pagination |
| limit | number | 20 | Items per page (max 100) |
| search | string | — | Search by startup name or tagline |
| category | string | — | Filter by category slug |
| sort | string | "newest" | Sort order: "newest", "popular", "trending" |
| status | string | "published" | Filter by status (admin only) |

Example Request:

```
GET /api/startups?page=1&limit=20&search=AI&category=developer-tools&sort=popular
```

Example Response (200 OK):

```json
{
  "data": [
    {
      "id": "s_abc123",
      "name": "CodeBuddy",
      "tagline": "AI pair programming for solo developers",
      "description": "CodeBuddy uses advanced language models to provide real-time code suggestions...",
      "url": "https://codebuddy.dev",
      "logoUrl": "https://cdn.launchpad.dev/logos/codebuddy.png",
      "category": {
        "id": "c_devtools",
        "name": "Developer Tools",
        "slug": "developer-tools"
      },
      "upvoteCount": 342,
      "commentCount": 28,
      "hasUpvoted": false,
      "submittedBy": {
        "id": "u_xyz789",
        "name": "Jane Smith",
        "avatarUrl": "https://cdn.launchpad.dev/avatars/jane.png"
      },
      "launchDate": "2025-12-15T00:00:00Z",
      "createdAt": "2025-12-15T08:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3
  }
}
```

Notice several design decisions here:

The `hasUpvoted` field tells the frontend whether the current user has already upvoted this startup. This avoids a separate API call for each startup card to check upvote status.

The `submittedBy` object includes only the fields needed for a startup card display — not the user's entire profile. This is called a "summary" or "embedded" representation.

The `category` is embedded as an object rather than just a category ID. This saves the frontend from making additional requests to resolve category names.

### Step 3: Startups — Single Resource

Endpoint: `GET /api/startups/:id`

Example Request:

```
GET /api/startups/s_abc123
```

Example Response (200 OK):

```json
{
  "data": {
    "id": "s_abc123",
    "name": "CodeBuddy",
    "tagline": "AI pair programming for solo developers",
    "description": "CodeBuddy uses advanced language models to provide real-time code suggestions, debug your errors, and explain complex codebases. Built for indie hackers and solo developers who want a senior engineer on call 24/7.",
    "url": "https://codebuddy.dev",
    "logoUrl": "https://cdn.launchpad.dev/logos/codebuddy.png",
    "screenshotUrls": [
      "https://cdn.launchpad.dev/screenshots/codebuddy-1.png",
      "https://cdn.launchpad.dev/screenshots/codebuddy-2.png"
    ],
    "category": {
      "id": "c_devtools",
      "name": "Developer Tools",
      "slug": "developer-tools"
    },
    "tags": ["ai", "coding", "productivity"],
    "upvoteCount": 342,
    "commentCount": 28,
    "hasUpvoted": false,
    "submittedBy": {
      "id": "u_xyz789",
      "name": "Jane Smith",
      "avatarUrl": "https://cdn.launchpad.dev/avatars/jane.png",
      "bio": "Full-stack developer and indie hacker"
    },
    "launchDate": "2025-12-15T00:00:00Z",
    "status": "published",
    "createdAt": "2025-12-15T08:30:00Z",
    "updatedAt": "2025-12-20T14:00:00Z"
  }
}
```

The detail endpoint returns more fields than the list endpoint — `screenshotUrls`, `tags`, `status`, `updatedAt`, and a richer `submittedBy` object with a bio. This pattern keeps list responses lightweight while giving detail pages all the data they need.

Error Response (404 Not Found):

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Startup with id 's_nonexistent' was not found"
  }
}
```

### Step 4: Startups — Create

Endpoint: `POST /api/startups`

Authentication: Required (Bearer token in Authorization header)

Request Body:

```json
{
  "name": "CodeBuddy",
  "tagline": "AI pair programming for solo developers",
  "description": "CodeBuddy uses advanced language models...",
  "url": "https://codebuddy.dev",
  "logoUrl": "https://cdn.launchpad.dev/logos/codebuddy.png",
  "screenshotUrls": [
    "https://cdn.launchpad.dev/screenshots/codebuddy-1.png"
  ],
  "categoryId": "c_devtools",
  "tags": ["ai", "coding", "productivity"],
  "launchDate": "2025-12-15T00:00:00Z"
}
```

Validation Rules:

| Field | Required | Rules |
|-------|----------|-------|
| name | Yes | 3-100 characters, must be unique |
| tagline | Yes | 10-200 characters |
| description | Yes | 50-5000 characters |
| url | Yes | Must be a valid URL |
| logoUrl | No | Must be a valid URL if provided |
| screenshotUrls | No | Array of valid URLs, max 5 |
| categoryId | Yes | Must reference an existing category |
| tags | No | Array of strings, max 5 tags, each 2-30 characters |
| launchDate | No | ISO 8601 date, must be today or in the future |

Success Response (201 Created):

```json
{
  "data": {
    "id": "s_new456",
    "name": "CodeBuddy",
    "tagline": "AI pair programming for solo developers",
    "description": "CodeBuddy uses advanced language models...",
    "url": "https://codebuddy.dev",
    "logoUrl": "https://cdn.launchpad.dev/logos/codebuddy.png",
    "screenshotUrls": [
      "https://cdn.launchpad.dev/screenshots/codebuddy-1.png"
    ],
    "category": {
      "id": "c_devtools",
      "name": "Developer Tools",
      "slug": "developer-tools"
    },
    "tags": ["ai", "coding", "productivity"],
    "upvoteCount": 0,
    "commentCount": 0,
    "submittedBy": {
      "id": "u_xyz789",
      "name": "Jane Smith",
      "avatarUrl": "https://cdn.launchpad.dev/avatars/jane.png"
    },
    "launchDate": "2025-12-15T00:00:00Z",
    "status": "published",
    "createdAt": "2025-12-15T08:30:00Z",
    "updatedAt": "2025-12-15T08:30:00Z"
  }
}
```

Validation Error Response (422 Unprocessable Entity):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "name",
        "message": "Name must be between 3 and 100 characters"
      },
      {
        "field": "categoryId",
        "message": "Category 'c_invalid' does not exist"
      }
    ]
  }
}
```

Authentication Error Response (401 Unauthorized):

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "You must be logged in to submit a startup"
  }
}
```

### Step 5: Startups — Update

Endpoint: `PUT /api/startups/:id`

Authentication: Required (must be the startup's submitter or an admin)

The request body has the same shape as the POST body. With PUT, the client sends the complete updated resource. Every field listed in the create endpoint should be included, even if it has not changed.

Example Request:

```
PUT /api/startups/s_abc123
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

```json
{
  "name": "CodeBuddy Pro",
  "tagline": "AI pair programming for developers of all levels",
  "description": "Updated description...",
  "url": "https://codebuddy.dev",
  "logoUrl": "https://cdn.launchpad.dev/logos/codebuddy-v2.png",
  "screenshotUrls": [
    "https://cdn.launchpad.dev/screenshots/codebuddy-1.png",
    "https://cdn.launchpad.dev/screenshots/codebuddy-2.png"
  ],
  "categoryId": "c_devtools",
  "tags": ["ai", "coding", "productivity", "devtools"],
  "launchDate": "2025-12-15T00:00:00Z"
}
```

Success Response (200 OK): Returns the full updated startup object (same shape as the detail endpoint).

Authorization Error Response (403 Forbidden):

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to edit this startup"
  }
}
```

### Step 6: Startups — Delete

Endpoint: `DELETE /api/startups/:id`

Authentication: Required (must be the startup's submitter or an admin)

Example Request:

```
DELETE /api/startups/s_abc123
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Success Response (200 OK):

```json
{
  "data": {
    "message": "Startup 's_abc123' has been deleted"
  }
}
```

This is a soft delete in our system — we set a `deletedAt` timestamp rather than removing the row from the database. This allows recovery and maintains referential integrity with upvotes and comments.

### Step 7: Upvoting

Endpoint: `POST /api/startups/:id/upvote`

Authentication: Required

This endpoint toggles the upvote — if the user has not upvoted, it creates an upvote. If the user has already upvoted, it removes the upvote. This simplifies the frontend because it only needs one button and one endpoint.

Example Request:

```
POST /api/startups/s_abc123/upvote
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Success Response (200 OK) — Upvote added:

```json
{
  "data": {
    "startupId": "s_abc123",
    "upvoted": true,
    "upvoteCount": 343
  }
}
```

Success Response (200 OK) — Upvote removed:

```json
{
  "data": {
    "startupId": "s_abc123",
    "upvoted": false,
    "upvoteCount": 342
  }
}
```

Returning the new `upvoteCount` in the response lets the frontend update the count immediately without making another GET request.

### Step 8: Categories

Endpoint: `GET /api/categories`

This endpoint requires no authentication and returns all categories. Since categories change infrequently, this response is a good candidate for caching.

Example Response (200 OK):

```json
{
  "data": [
    {
      "id": "c_devtools",
      "name": "Developer Tools",
      "slug": "developer-tools",
      "description": "Tools and platforms for software developers",
      "startupCount": 47
    },
    {
      "id": "c_ai",
      "name": "Artificial Intelligence",
      "slug": "artificial-intelligence",
      "description": "AI-powered products and services",
      "startupCount": 83
    },
    {
      "id": "c_saas",
      "name": "SaaS",
      "slug": "saas",
      "description": "Software as a Service products",
      "startupCount": 125
    },
    {
      "id": "c_fintech",
      "name": "Fintech",
      "slug": "fintech",
      "description": "Financial technology products",
      "startupCount": 31
    },
    {
      "id": "c_productivity",
      "name": "Productivity",
      "slug": "productivity",
      "description": "Tools to help you work smarter",
      "startupCount": 56
    },
    {
      "id": "c_design",
      "name": "Design",
      "slug": "design",
      "description": "Design tools and resources",
      "startupCount": 38
    }
  ]
}
```

The `startupCount` field lets the frontend display how many startups each category contains, which is useful for filter UIs and category browsing pages.

### Step 9: Authentication

Authentication endpoints follow a slightly different pattern because they deal with sessions rather than resources.

Register Endpoint: `POST /api/auth/register`

Request Body:

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "securePassword123!"
}
```

Validation Rules:

| Field | Required | Rules |
|-------|----------|-------|
| name | Yes | 2-100 characters |
| email | Yes | Valid email format, must be unique |
| password | Yes | Minimum 8 characters, at least one letter and one number |

Success Response (201 Created):

```json
{
  "data": {
    "user": {
      "id": "u_new123",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "avatarUrl": null,
      "createdAt": "2025-12-15T08:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

Conflict Error Response (409 Conflict):

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "An account with this email already exists"
  }
}
```

Login Endpoint: `POST /api/auth/login`

Request Body:

```json
{
  "email": "jane@example.com",
  "password": "securePassword123!"
}
```

Success Response (200 OK):

```json
{
  "data": {
    "user": {
      "id": "u_xyz789",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "avatarUrl": "https://cdn.launchpad.dev/avatars/jane.png",
      "createdAt": "2025-12-01T10:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

Authentication Error Response (401 Unauthorized):

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

Notice that the error message does not specify whether the email or the password was wrong. This is a security practice — telling the user "no account with this email exists" would reveal which emails are registered in your system.

### Step 10: User Profile

Endpoint: `GET /api/users/:id`

This is a public endpoint — anyone can view a user's profile. However, certain fields (like email) are only included when the authenticated user is viewing their own profile.

Example Response (200 OK) — Viewing another user's profile:

```json
{
  "data": {
    "id": "u_xyz789",
    "name": "Jane Smith",
    "avatarUrl": "https://cdn.launchpad.dev/avatars/jane.png",
    "bio": "Full-stack developer and indie hacker",
    "startupCount": 5,
    "upvoteCount": 127,
    "joinedAt": "2025-12-01T10:00:00Z"
  }
}
```

Example Response (200 OK) — Viewing your own profile:

```json
{
  "data": {
    "id": "u_xyz789",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "avatarUrl": "https://cdn.launchpad.dev/avatars/jane.png",
    "bio": "Full-stack developer and indie hacker",
    "startupCount": 5,
    "upvoteCount": 127,
    "joinedAt": "2025-12-01T10:00:00Z"
  }
}
```

The only difference is the `email` field. This pattern where the response shape changes based on the requester's identity is common in APIs that serve both public and private data.

### Step 11: Pagination Deep Dive

LaunchPad uses offset-based pagination for the startups list. Let us compare the two main pagination strategies:

Offset-based Pagination:

```
GET /api/startups?page=3&limit=20
```

The server calculates `OFFSET = (page - 1) * limit` and runs a query like `SELECT * FROM startups LIMIT 20 OFFSET 40`. This is simple to implement and lets users jump to any page directly.

Advantages: Easy to understand, users can jump to page 5 without visiting pages 1-4, simple to display "Page 3 of 8" in the UI.

Disadvantages: If new items are added between page requests, the user might see duplicate items or miss items. Performance degrades on very large datasets because the database still has to scan through all skipped rows.

Cursor-based Pagination:

```
GET /api/startups?cursor=s_abc123&limit=20
```

The server returns items after the cursor (a reference to the last item the client received). The response includes a `nextCursor` value.

```json
{
  "data": [...],
  "pagination": {
    "nextCursor": "s_def456",
    "hasMore": true
  }
}
```

Advantages: Consistent results even when data changes, performs well on large datasets because the database can use an index to find the starting point.

Disadvantages: Users cannot jump to an arbitrary page, harder to display total page count, more complex to implement.

For LaunchPad, offset-based pagination is the right choice. Our dataset is not large enough for performance to be a concern, and the ability to jump to specific pages improves the user experience.

### Step 12: Complete API Reference Table

Here is the full API at a glance:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/startups | No | List startups with search, filter, pagination |
| GET | /api/startups/:id | No | Get startup details |
| POST | /api/startups | Yes | Create a new startup |
| PUT | /api/startups/:id | Yes (owner) | Update a startup |
| DELETE | /api/startups/:id | Yes (owner) | Delete a startup |
| POST | /api/startups/:id/upvote | Yes | Toggle upvote on a startup |
| GET | /api/categories | No | List all categories |
| POST | /api/auth/register | No | Create a new account |
| POST | /api/auth/login | No | Log in and receive a token |
| GET | /api/users/:id | No | Get user profile |

This table is worth printing out and pinning above your monitor during development. It is the map of your entire backend.

## Try It Yourself

Now it is your turn. Design the API endpoints for a comments feature. Users should be able to:

- View all comments on a startup (with pagination)
- Post a new comment on a startup
- Edit their own comment
- Delete their own comment
- Reply to another comment (creating a thread)

For each endpoint, define:

1. The HTTP method and URL path
2. Whether authentication is required
3. The request body (if applicable)
4. The success response with realistic example data
5. At least one error response

Here is a starting point to get you thinking:

```
GET  /api/startups/:id/comments          — List comments
POST /api/startups/:id/comments          — Create a comment
PUT  /api/startups/:id/comments/:cid     — Update a comment
DELETE /api/startups/:id/comments/:cid   — Delete a comment
```

Consider these questions as you design:

- How do you handle threaded replies? Do you add a `parentId` field to the request body?
- What does the response look like for nested comments? Do you return a flat list with `parentId` references, or a nested tree structure?
- What validation rules apply to comment content?
- Should the GET endpoint support sorting (newest first vs oldest first)?

## Key Takeaways

- API contracts define the exact request and response shapes for every endpoint, serving as the agreement between frontend and backend teams.
- RESTful conventions use plural nouns for resources, HTTP methods for actions, and status codes to communicate outcomes.
- A consistent response envelope (wrapping data in a `data` field and errors in an `error` field) simplifies frontend code.
- Design your list endpoints to include summary representations of related resources to minimize the number of API calls the frontend needs.
- Return enough data in mutation responses (POST, PUT, DELETE) that the frontend can update its state without making a follow-up GET request.
- Choose your pagination strategy based on your data size and UI needs — offset-based is simpler, cursor-based scales better.
- Authentication endpoints should avoid leaking information about which accounts exist in your system.

## Next Steps

With our API contracts defined, we know exactly what data flows between the frontend and backend. In the next lesson, we will design the React component tree for LaunchPad — mapping out which components exist, which ones own state, and how data flows through props from parent to child. The API contracts will directly influence our component design because every component that displays data needs to match the response shapes we just defined.
