# Fetch vs Axios: Choosing Your HTTP Client

In Course 02, we built the LaunchPad frontend using hardcoded mock data. In Course 03, we built a REST API that serves real startup data from a SQLite database. Now it is time to connect them. But before we start making HTTP requests, we need to choose our weapon: the browser-native fetch API or the popular axios library.

This lesson gives you a thorough understanding of both approaches, their trade-offs, and helps you build a reusable API client that the rest of this course will rely on.

## What You Will Learn

- How the native fetch API works and its quirks
- How to install and use axios for HTTP requests
- The differences in error handling between fetch and axios
- How axios interceptors work and why they matter
- When to use fetch vs axios in a real project
- How to build a reusable, configured axios instance for LaunchPad

## Concepts

### The Fetch API

The fetch API is built into every modern browser and into Node.js (since v18). It is a low-level API for making HTTP requests. You do not need to install anything to use it. Next.js 15 also extends fetch with caching and revalidation features that we will explore in later lessons.

A basic fetch call looks like this:

```ts
const response = await fetch('http://localhost:3001/api/startups');
const data = await response.json();
```

Simple enough. But there are several gotchas that trip up developers.

### Axios

Axios is a third-party HTTP client library that works in both browsers and Node.js. It wraps HTTP requests in a more developer-friendly API with features like automatic JSON parsing, request/response interceptors, and sensible error handling defaults.

A basic axios call looks like this:

```ts
import axios from 'axios';

const response = await axios.get('http://localhost:3001/api/startups');
const data = response.data;
```

The difference might seem cosmetic at first, but as we dig deeper, you will see meaningful distinctions.

## Step by Step

### Step 1: Understanding Fetch Basics

Let us start by examining how fetch works in detail. Create a scratch file to experiment. You will not keep this file, but it helps to see the behavior firsthand.

Create `src/lib/fetch-demo.ts`:

```ts
// Demonstration of fetch behavior - not for production use

async function fetchDemo() {
  // Basic GET request
  const response = await fetch('http://localhost:3001/api/startups');

  // The response object contains metadata
  console.log(response.status);     // 200
  console.log(response.ok);         // true (status 200-299)
  console.log(response.statusText); // "OK"

  // You must manually parse the body
  const data = await response.json();
  console.log(data);
}
```

The first thing to understand is that fetch returns a Response object. The body is a readable stream that you must explicitly parse. For JSON APIs, you call `response.json()`. For text, you call `response.text()`. This two-step process (make request, then parse body) is a common source of confusion.

### Step 2: The Fetch Error Handling Trap

Here is the single biggest gotcha with fetch. Run this thought experiment:

```ts
async function fetchWithError() {
  try {
    const response = await fetch('http://localhost:3001/api/startups/99999');
    const data = await response.json();
    console.log(data); // This line RUNS even on a 404!
  } catch (error) {
    console.log('This only runs on network errors');
  }
}
```

Fetch only throws an error when there is a network failure (the server is unreachable, DNS fails, CORS blocks the request, etc.). HTTP error status codes like 404 or 500 do NOT cause fetch to throw. The request technically succeeded because the server did respond, it just responded with an error status.

This means you must always check `response.ok` or `response.status` manually:

```ts
async function fetchWithProperErrorHandling() {
  const response = await fetch('http://localhost:3001/api/startups/99999');

  if (!response.ok) {
    // Now we handle the HTTP error
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      errorBody?.error || 'Request failed with status ' + response.status
    );
  }

  const data = await response.json();
  return data;
}
```

Forgetting this check is one of the most common bugs in frontend applications. Your app silently swallows server errors and tries to render undefined data.

### Step 3: Fetch POST Requests

Sending data with fetch requires manual configuration:

```ts
async function createStartup(startupData: NewStartup) {
  const response = await fetch('http://localhost:3001/api/startups', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(startupData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'Failed to create startup');
  }

  return response.json();
}
```

Notice that you must: set the method explicitly, set the Content-Type header, and stringify the body yourself. Every single POST, PUT, or PATCH request needs this boilerplate.

### Step 4: Installing Axios

Now let us see how axios handles the same scenarios. First, install it:

```bash
npm install axios
```

Axios is a small library (around 14KB gzipped) with zero dependencies. It has been downloaded billions of times and is one of the most battle-tested packages in the JavaScript ecosystem.

### Step 5: Axios GET Requests

```ts
import axios from 'axios';

async function getStartups() {
  const response = await axios.get('http://localhost:3001/api/startups');
  return response.data; // Already parsed as JSON
}
```

Axios automatically parses JSON responses. The response object has a `data` property containing the parsed body. No need to call `.json()` manually.

The response object also includes:

```ts
const response = await axios.get('http://localhost:3001/api/startups');

console.log(response.data);    // Parsed response body
console.log(response.status);  // 200
console.log(response.headers); // Response headers
console.log(response.config);  // The request config that was used
```

### Step 6: Axios Error Handling

Here is where axios truly shines compared to fetch:

```ts
async function getStartup(id: number) {
  try {
    const response = await axios.get(
      'http://localhost:3001/api/startups/' + id
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // HTTP errors (4xx, 5xx) land here!
      console.log(error.response?.status);  // 404
      console.log(error.response?.data);    // { error: "Not found" }
      console.log(error.message);           // "Request failed with status code 404"
    }
    throw error;
  }
}
```

Axios throws an error for any response with a status code outside the 2xx range. This means your catch block handles both network errors AND HTTP errors. No more forgetting to check `response.ok`.

The error object from axios is also much richer. It includes the full response (if the server did respond), the original request config, and a helpful error message.

### Step 7: Axios POST Requests

Sending data with axios is cleaner:

```ts
async function createStartup(startupData: NewStartup) {
  const response = await axios.post(
    'http://localhost:3001/api/startups',
    startupData  // No need to JSON.stringify!
  );
  return response.data;
}
```

Axios automatically serializes JavaScript objects to JSON and sets the `Content-Type: application/json` header. One line vs four lines of boilerplate.

### Step 8: Creating an Axios Instance

For a real application, you do not want to repeat the base URL on every request. Axios lets you create a configured instance:

```ts
// src/lib/api-client.ts

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
```

Now every request uses this configuration:

```ts
import apiClient from '@/lib/api-client';

// Instead of: axios.get('http://localhost:3001/api/startups')
const response = await apiClient.get('/startups');
```

This is the foundation of the API client we will use throughout the rest of this course.

### Step 9: Understanding Interceptors

Interceptors are functions that axios runs on every request or response. They are middleware for HTTP calls. This is a feature that fetch simply does not have (you would need to build a wrapper function).

Request interceptors run before the request is sent:

```ts
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token to every request
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }

    // Log the request in development
    if (process.env.NODE_ENV === 'development') {
      console.log(config.method?.toUpperCase() + ' ' + config.url);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
```

Response interceptors run after the response is received:

```ts
apiClient.interceptors.response.use(
  (response) => {
    // Any 2xx status lands here
    return response;
  },
  (error) => {
    // Any non-2xx status lands here
    if (error.response?.status === 401) {
      // Token expired - redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

We will use interceptors heavily in Lesson 05 when we implement authentication.

### Step 10: Building the LaunchPad API Client

Now let us build the actual API client for our LaunchPad application. Create the file `src/lib/api-client.ts`:

```ts
// src/lib/api-client.ts

import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

// We will move this to environment variables in Lesson 08
const API_BASE_URL = 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (process.env.NODE_ENV === 'development') {
      const method = config.method?.toUpperCase() || 'UNKNOWN';
      console.log('[API] ' + method + ' ' + config.url);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for consistent error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as Record<string, unknown>;

      console.error(
        '[API Error] ' + status + ': ' + (data?.error || error.message)
      );
    } else if (error.request) {
      // Request made but no response received
      console.error('[API Error] No response from server');
    } else {
      // Error setting up the request
      console.error('[API Error] ' + error.message);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

This client gives us: a single place to configure the base URL, automatic JSON handling, request logging in development, and structured error logging. Every API call in our application will go through this client.

### Step 11: Comparison Table

Let us summarize the key differences:

Automatic JSON parsing: fetch requires manual `.json()` call, axios does it automatically.

Error handling: fetch only throws on network failures, axios throws on any non-2xx status.

Request body: fetch requires `JSON.stringify()` and manual headers, axios serializes objects automatically.

Timeout: fetch has no built-in timeout (you need AbortController), axios has a simple `timeout` option.

Interceptors: fetch has nothing built-in, axios has request and response interceptors.

Browser support: fetch is native everywhere, axios needs to be installed.

Bundle size: fetch adds 0KB, axios adds about 14KB gzipped.

Request cancellation: fetch uses AbortController, axios uses AbortController (and previously had its own CancelToken).

Progress tracking: fetch has no built-in support, axios supports upload and download progress callbacks.

### Step 12: When to Use Which

Use fetch when: you are building a small application with few API calls, you want zero dependencies, you are working in a Next.js Server Component where Next.js extends fetch with caching (we will see this in Lesson 03), or you need the most lightweight option possible.

Use axios when: you are building a larger application with many API calls, you need interceptors for auth tokens or logging, you want consistent error handling without boilerplate, you need features like timeouts and progress tracking, or your team values developer experience and readability.

For LaunchPad, we will use a hybrid approach. We will use axios for client-side requests (form submissions, mutations, client components) and leverage Next.js enhanced fetch in Server Components (where Next.js adds caching and revalidation on top of fetch). This gives us the best of both worlds.

## Exercise

1. Create the `src/lib/api-client.ts` file as shown in Step 10
2. Write a simple test by creating a temporary page that fetches startups using the api client. Make sure your Course 03 API server is running on port 3001
3. Try making a request to a non-existent endpoint (like `/api/nonexistent`) and observe how the error interceptor logs the error
4. Add a request interceptor that tracks how long each request takes by recording `Date.now()` in the request config and calculating the duration in the response interceptor
5. Experiment with the timeout setting - set it to 1ms and observe the timeout error

## Key Takeaways

- The fetch API is built-in and lightweight but requires manual JSON parsing and manual error status checking
- Axios provides a more ergonomic API with automatic JSON handling, status-based error throwing, and interceptors
- The biggest fetch pitfall is that it does not throw on HTTP errors (404, 500, etc.) - only on network failures
- Axios interceptors let you add cross-cutting concerns like auth tokens, logging, and error handling in one place
- Creating a configured axios instance avoids repeating the base URL and common headers on every request
- In Next.js projects, using both fetch (in Server Components) and axios (in Client Components) is a valid and common pattern

## Summary

In this lesson, we explored the two main options for making HTTP requests in a JavaScript application. The native fetch API is always available and adds nothing to your bundle, but it comes with quirks around error handling and requires boilerplate for common operations. Axios trades a small bundle size increase for a significantly better developer experience with automatic JSON parsing, proper error throwing, interceptors, and built-in timeout support.

We built a reusable API client for LaunchPad using axios with request logging and structured error handling. This client will be the foundation for all our API communication in the coming lessons.

## What is Next

In the next lesson, we will put this API client to work. We will create typed API functions for every endpoint our LaunchPad frontend needs and replace all the hardcoded mock data with real API calls. The startups on your page will finally come from the database.
