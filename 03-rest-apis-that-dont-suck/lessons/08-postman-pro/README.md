# Testing APIs with Postman

You have built an API with CRUD operations, validation, pagination, and error handling. But how do you know it actually works? You have probably been testing with curl as you go, but ad-hoc testing is not a strategy. In this lesson you will learn how to systematically test your API using both curl and Postman, building a reusable collection that documents every endpoint and catches regressions.

## What You Will Learn

- Why manual API testing matters alongside automated tests
- Testing every endpoint with curl from the command line
- Setting up Postman with collections and environments
- Building a complete test collection for the LaunchPad API
- Testing both happy paths and error paths
- Using environment variables for flexible testing
- API testing best practices

## Concepts

### Why Manual Testing?

You might wonder why we are covering manual testing when Lesson 09 covers automated tests. The answer is that they serve different purposes:

Manual testing is for exploration and debugging. When you are building a new endpoint, you want to hit it quickly and see what comes back. You want to tweak the request and try edge cases interactively. Automated tests cannot do this -- they run predefined scenarios.

Automated testing is for regression prevention. Once you know an endpoint works, you write a test so it keeps working. Automated tests run in CI/CD pipelines and catch bugs before they reach production.

You need both. Manual testing helps you build. Automated testing helps you maintain.

### curl: The Universal API Client

curl is a command-line tool that sends HTTP requests. It is installed on virtually every Unix-based system and is the lingua franca of API documentation. When someone shows you how to use their API, they almost always show curl examples.

The basic syntax is:

```
curl [options] URL
```

Common options you will use:

- `-X METHOD`: Specify the HTTP method (GET, POST, PUT, DELETE)
- `-H "Header: Value"`: Add a request header
- `-d 'data'`: Send request body data
- `-v`: Verbose mode -- shows request and response headers
- `-s`: Silent mode -- suppresses the progress bar

### Postman: The GUI API Client

Postman is a desktop application (and web app) for testing APIs. It provides a graphical interface for building requests, organizing them into collections, and sharing them with your team.

Key Postman concepts:

- Request: A single API call with method, URL, headers, and body
- Collection: A folder of related requests
- Environment: A set of variables (like base_url) that can be swapped between dev, staging, and production
- Tests: JavaScript snippets that run after each request to verify the response

## Step by Step

### Step 1: Test with curl -- The Complete Guide

Let us test every endpoint in our API. Make sure your server is running:

```bash
npm run dev
```

#### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-02-17T10:30:00.000Z"
}
```

This is your smoke test. If this fails, the server is not running.

#### List All Startups (with defaults)

```bash
curl http://localhost:3000/api/startups
```

Expected response:

```json
{
  "data": [
    {
      "id": 1,
      "name": "TechFlow AI",
      "tagline": "AI-powered workflow automation",
      "description": "...",
      "url": "https://techflow.ai",
      "category_id": 1,
      "upvotes": 0,
      "created_at": "2026-02-17 10:00:00",
      "updated_at": "2026-02-17 10:00:00",
      "category_name": "AI/ML"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 8,
    "totalPages": 1
  }
}
```

#### List with Pagination

```bash
curl "http://localhost:3000/api/startups?page=1&limit=3"
```

Check that:
- The `data` array has at most 3 items
- The `pagination.limit` is 3
- The `pagination.totalPages` is correct (ceil of total / 3)

Request page 2:

```bash
curl "http://localhost:3000/api/startups?page=2&limit=3"
```

Verify you get different results than page 1.

#### List with Sorting

```bash
curl "http://localhost:3000/api/startups?sort=name&order=asc"
```

Verify the results are sorted alphabetically by name.

```bash
curl "http://localhost:3000/api/startups?sort=name&order=desc"
```

Verify the order is reversed.

#### List with Category Filter

```bash
curl "http://localhost:3000/api/startups?category=1"
```

Verify all returned startups have `category_id` of 1.

#### List with Search

```bash
curl "http://localhost:3000/api/startups?search=ai"
```

Verify all returned startups have "ai" somewhere in their name or tagline.

#### List with Combined Filters

```bash
curl "http://localhost:3000/api/startups?page=1&limit=5&sort=name&order=asc&category=1&search=ai"
```

#### Get Single Startup

```bash
curl http://localhost:3000/api/startups/1
```

Expected response:

```json
{
  "data": {
    "id": 1,
    "name": "TechFlow AI",
    "tagline": "AI-powered workflow automation",
    "description": "...",
    "url": "https://techflow.ai",
    "category_id": 1,
    "category_name": "AI/ML"
  }
}
```

#### Get Non-Existent Startup (404)

```bash
curl http://localhost:3000/api/startups/99999
```

Expected response (status 404):

```json
{
  "error": "Startup with id '99999' not found"
}
```

To see the status code, add the `-w` flag:

```bash
curl -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/api/startups/99999
```

#### Create a Startup (POST)

```bash
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CloudDeploy",
    "tagline": "Deploy anywhere in seconds with zero configuration",
    "description": "CloudDeploy is a deployment platform that automatically detects your framework, builds your application, and deploys it to the cloud. No Dockerfiles, no YAML, no configuration files.",
    "url": "https://clouddeploy.dev",
    "category_id": 2
  }'
```

Expected response (status 201):

```json
{
  "data": {
    "id": 9,
    "name": "CloudDeploy",
    "tagline": "Deploy anywhere in seconds with zero configuration",
    "description": "...",
    "url": "https://clouddeploy.dev",
    "category_id": 2,
    "created_at": "2026-02-17 10:35:00",
    "updated_at": "2026-02-17 10:35:00"
  }
}
```

Note the id in the response. You will need it for the next requests.

#### Create with Invalid Data (400)

Empty body:

```bash
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response (status 400):

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "name", "message": "Name is required" },
    { "field": "tagline", "message": "Tagline is required" },
    { "field": "description", "message": "Description is required" },
    { "field": "url", "message": "URL is required" },
    { "field": "category_id", "message": "Category is required" }
  ]
}
```

Invalid values:

```bash
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "X",
    "tagline": "too short",
    "description": "way too short",
    "url": "not-a-url",
    "category_id": -5
  }'
```

#### Update a Startup (PUT)

Partial update -- only change the tagline:

```bash
curl -X PUT http://localhost:3000/api/startups/1 \
  -H "Content-Type: application/json" \
  -d '{
    "tagline": "The best AI-powered workflow automation platform"
  }'
```

Expected response (status 200): The full startup object with the updated tagline.

#### Update Non-Existent Startup (404)

```bash
curl -X PUT http://localhost:3000/api/startups/99999 \
  -H "Content-Type: application/json" \
  -d '{"name": "Ghost"}'
```

#### Delete a Startup (DELETE)

```bash
curl -X DELETE http://localhost:3000/api/startups/9
```

Expected response: Status 204 with no body. Verify by trying to GET the deleted startup:

```bash
curl http://localhost:3000/api/startups/9
```

Should return 404.

#### Invalid Query Parameters

```bash
curl "http://localhost:3000/api/startups?page=abc"
curl "http://localhost:3000/api/startups?limit=500"
curl "http://localhost:3000/api/startups?sort=password"
curl "http://localhost:3000/api/startups?order=random"
```

Each of these should return a 400 with a helpful error message.

### Step 2: Set Up Postman

If you do not have Postman installed, download it from https://www.postman.com/downloads/ or use the web version. You can also use an alternative like Insomnia or Thunder Client (VS Code extension).

#### Create an Environment

Environments let you switch between different servers (local dev, staging, production) without editing every request.

1. Click the "Environments" tab in the sidebar
2. Click "Create Environment"
3. Name it "LaunchPad - Local"
4. Add these variables:

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| base_url | http://localhost:3000 | http://localhost:3000 |
| startup_id | 1 | 1 |

5. Save the environment
6. Select it from the environment dropdown in the top-right corner

Later, you can create a "LaunchPad - Production" environment with a different base_url and your requests will work without changes.

#### Create a Collection

1. Click "Collections" in the sidebar
2. Click "Create Collection"
3. Name it "LaunchPad API"
4. Optionally add a description: "Complete test collection for the LaunchPad startup platform API"

### Step 3: Add Requests to the Collection

Now add each request to the collection. For each one, I will show you what to configure in Postman.

#### Health Check

- Method: GET
- URL: `{{base_url}}/health`
- Name: "Health Check"

In the "Tests" tab, add:

```js
pm.test("Status is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Status field is ok", function () {
    const json = pm.response.json();
    pm.expect(json.status).to.eql("ok");
});
```

#### List Startups

- Method: GET
- URL: `{{base_url}}/api/startups`
- Name: "List Startups"

In the "Params" tab, add these query parameters (you can enable/disable them as needed):

| Key | Value | Enabled |
|-----|-------|---------|
| page | 1 | yes |
| limit | 10 | yes |
| sort | created_at | no |
| order | desc | no |
| category | 1 | no |
| search | ai | no |

Tests:

```js
pm.test("Status is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has data array", function () {
    const json = pm.response.json();
    pm.expect(json.data).to.be.an("array");
});

pm.test("Response has pagination", function () {
    const json = pm.response.json();
    pm.expect(json.pagination).to.have.property("page");
    pm.expect(json.pagination).to.have.property("limit");
    pm.expect(json.pagination).to.have.property("total");
    pm.expect(json.pagination).to.have.property("totalPages");
});
```

#### Get Single Startup

- Method: GET
- URL: `{{base_url}}/api/startups/{{startup_id}}`
- Name: "Get Startup"

Tests:

```js
pm.test("Status is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has startup data", function () {
    const json = pm.response.json();
    pm.expect(json.data).to.have.property("id");
    pm.expect(json.data).to.have.property("name");
    pm.expect(json.data).to.have.property("tagline");
});
```

#### Create Startup

- Method: POST
- URL: `{{base_url}}/api/startups`
- Name: "Create Startup"
- Body tab: Select "raw" and "JSON", then enter:

```json
{
  "name": "CloudDeploy",
  "tagline": "Deploy anywhere in seconds with zero configuration needed",
  "description": "CloudDeploy is a deployment platform that automatically detects your framework, builds your application, and deploys it to the cloud. No Dockerfiles, no YAML, no configuration files needed at all.",
  "url": "https://clouddeploy.dev",
  "category_id": 2
}
```

Tests:

```js
pm.test("Status is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Returns created startup", function () {
    const json = pm.response.json();
    pm.expect(json.data.name).to.eql("CloudDeploy");
});

// Save the created startup's id for later requests
pm.test("Save startup id", function () {
    const json = pm.response.json();
    pm.environment.set("created_startup_id", json.data.id);
});
```

That last test is a Postman trick. It saves the newly created startup's id into an environment variable. You can then use `{{created_startup_id}}` in subsequent requests to update or delete that exact startup.

#### Create Startup - Validation Error

- Method: POST
- URL: `{{base_url}}/api/startups`
- Name: "Create Startup - Invalid"
- Body: `{}`

Tests:

```js
pm.test("Status is 400", function () {
    pm.response.to.have.status(400);
});

pm.test("Has validation details", function () {
    const json = pm.response.json();
    pm.expect(json.error).to.eql("Validation failed");
    pm.expect(json.details).to.be.an("array");
    pm.expect(json.details.length).to.be.greaterThan(0);
});
```

#### Update Startup

- Method: PUT
- URL: `{{base_url}}/api/startups/{{created_startup_id}}`
- Name: "Update Startup"
- Body:

```json
{
  "tagline": "Updated tagline that is long enough to pass validation rules"
}
```

Tests:

```js
pm.test("Status is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Tagline was updated", function () {
    const json = pm.response.json();
    pm.expect(json.data.tagline).to.include("Updated tagline");
});
```

#### Delete Startup

- Method: DELETE
- URL: `{{base_url}}/api/startups/{{created_startup_id}}`
- Name: "Delete Startup"

Tests:

```js
pm.test("Status is 204", function () {
    pm.response.to.have.status(204);
});
```

#### Get Deleted Startup (Verify 404)

- Method: GET
- URL: `{{base_url}}/api/startups/{{created_startup_id}}`
- Name: "Get Deleted Startup (404)"

Tests:

```js
pm.test("Status is 404", function () {
    pm.response.to.have.status(404);
});

pm.test("Error message is correct", function () {
    const json = pm.response.json();
    pm.expect(json.error).to.include("not found");
});
```

### Step 4: Organize the Collection

Postman lets you create folders inside collections. Organize your requests like this:

```
LaunchPad API/
  Health/
    Health Check
  Startups/
    List Startups
    Get Startup
    Create Startup
    Create Startup - Invalid
    Update Startup
    Delete Startup
    Get Deleted Startup (404)
```

### Step 5: Run the Collection

Postman has a Collection Runner that executes all requests in sequence.

1. Click the three dots next to your collection name
2. Select "Run collection"
3. Make sure all requests are checked
4. Click "Run LaunchPad API"

The runner executes each request and shows you which tests passed and failed. This is essentially a manual integration test suite. The requests run in order, so the Create request runs before Update and Delete, which is important because Update and Delete use the id saved by Create.

### Step 6: Testing Pagination Strategies

Here is a systematic approach to testing pagination. In Postman or curl, run through these scenarios:

Scenario 1 -- Default pagination:
```bash
curl "http://localhost:3000/api/startups"
```
Verify: page is 1, limit is 10.

Scenario 2 -- Custom page size:
```bash
curl "http://localhost:3000/api/startups?limit=2"
```
Verify: only 2 items in data array.

Scenario 3 -- Page beyond results:
```bash
curl "http://localhost:3000/api/startups?page=999"
```
Verify: data is an empty array, pagination still has correct total.

Scenario 4 -- Boundary values:
```bash
curl "http://localhost:3000/api/startups?limit=1"
curl "http://localhost:3000/api/startups?limit=100"
```
Verify: limit 1 returns exactly 1 item. Limit 100 returns all items (if fewer than 100 exist).

Scenario 5 -- Invalid values:
```bash
curl "http://localhost:3000/api/startups?page=0"
curl "http://localhost:3000/api/startups?limit=0"
curl "http://localhost:3000/api/startups?limit=101"
```
Verify: all return 400 with validation errors.

### Step 7: Using httpie as an Alternative

If you prefer a more readable command-line tool, httpie is an excellent alternative to curl:

```bash
# Install httpie
pip install httpie

# GET request (no flags needed for GET)
http localhost:3000/api/startups

# POST with JSON body
http POST localhost:3000/api/startups \
  name="CloudDeploy" \
  tagline="Deploy anywhere in seconds with zero configuration" \
  description="CloudDeploy is a deployment platform that handles everything automatically. No config files needed." \
  url="https://clouddeploy.dev" \
  category_id:=2

# Note the := syntax for numbers (without quotes)
# DELETE
http DELETE localhost:3000/api/startups/5
```

httpie automatically sets Content-Type to application/json, colorizes output, and formats JSON. It is worth trying if you find curl verbose.

## API Testing Best Practices

Here are principles to follow when testing APIs, whether manually or with automated tests:

### 1. Test the Contract, Not the Implementation

Verify that the response matches the documented shape. Check that field names, types, and status codes are correct. Do not test internal database state from the API level.

### 2. Test Both Happy and Sad Paths

For every endpoint, test:
- The normal success case
- Missing required fields
- Invalid field values (wrong types, out of range)
- Resources that do not exist
- Edge cases (empty strings, very long strings, special characters)

### 3. Test State Transitions

Some operations depend on order. Test the full lifecycle:
- Create a resource
- Read it back
- Update it
- Read it again to verify the update
- Delete it
- Try to read it (should be 404)

### 4. Check Response Headers

Beyond the body, verify:
- `Content-Type` is `application/json`
- Status codes are correct (200, 201, 204, 400, 404, 500)
- CORS headers are present if expected

### 5. Test with Different Content Types

What happens if you send a POST without the Content-Type header? What about `text/plain`? Your API should handle these gracefully.

```bash
curl -X POST http://localhost:3000/api/startups \
  -d 'this is not json'
```

### 6. Save and Share Collections

Export your Postman collection as JSON and commit it to your repository. Team members can import it and have a working test suite immediately. Put it in a `docs/` or `postman/` directory.

## File Summary

This lesson did not create or modify any code files. Instead, you built:

- A systematic curl testing workflow for every endpoint
- A Postman collection with requests, tests, and environment variables
- Knowledge of testing patterns for pagination, validation, and error handling

## Key Takeaways

- Manual testing is for exploration and debugging. Automated testing is for regression prevention. You need both.
- curl is universal and belongs in every API developer's toolkit. Learn the common flags.
- Postman collections are living documentation. They show exactly how to call each endpoint.
- Environment variables in Postman let you switch between dev, staging, and production without editing requests.
- Postman tests can save response values to variables, enabling chained request workflows.
- Always test error paths, not just happy paths. Your API's error responses are part of its contract.
- Test pagination systematically: defaults, custom sizes, boundary values, and beyond-the-end pages.

## Exercises

1. Add a "Categories" folder to your Postman collection with requests to list, create, get, update, and delete categories.

2. Write a Postman test that verifies pagination math: `totalPages` should equal `Math.ceil(total / limit)`.

3. Create a second Postman environment called "LaunchPad - Docker" with `base_url` set to `http://localhost:8080`. Practice switching environments.

4. Export your Postman collection to JSON and save it in a `postman/` directory in your project. This makes the collection part of your codebase.

## Next Lesson

Manual testing gives you confidence during development. But you cannot run Postman in a CI/CD pipeline. In Lesson 09, you will write automated integration tests with Vitest and Supertest that run in milliseconds and catch regressions automatically.
