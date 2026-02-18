# 06 — Error Handling and User Experience

Errors are inevitable. Servers go down, networks drop, users submit invalid data, and APIs return unexpected responses. The difference between a frustrating application and a pleasant one often comes down to how it handles these failures. In this lesson, we will dig deep into the error handling patterns already built into our LaunchPad frontend, understand the three categories of errors, and learn how to turn raw API failures into helpful user-facing messages.

## What You Will Learn

- How axios error interceptors classify and handle different error types
- The three categories of HTTP errors: network errors, client errors (4xx), and server errors (5xx)
- How to extract useful error messages from API responses
- How the create-startup-form.tsx component handles validation and submission errors
- How to build React error boundaries for catching render-time crashes
- Patterns for displaying errors in a way that helps users recover

## Key Concepts

### The Three Categories of Errors

When an HTTP request fails, the failure falls into one of three categories. Understanding which category you are dealing with determines how you should respond.

Network errors happen when the request never reaches the server. The user might be offline, the server might be down, or a DNS lookup might have failed. There is no HTTP status code because there was no HTTP response.

Client errors (4xx) mean the server received the request but is refusing it because something is wrong with what the client sent. A 400 means bad input. A 401 means the user is not authenticated. A 403 means the user is authenticated but not authorized. A 404 means the resource does not exist. A 422 means the input failed validation.

Server errors (5xx) mean the request was valid but the server encountered a problem. A 500 is a generic internal error. A 502 means a gateway or proxy got a bad response from an upstream server. A 503 means the service is temporarily unavailable.

Each category calls for a different user-facing message and a different recovery strategy.

### Error Interceptors as a Safety Net

Our api-client.ts already has a response interceptor that provides a first line of defense. Think of it as a global error handler that every API call passes through before the error reaches your component code.

## Step by Step

### Step 1: Anatomy of the Response Interceptor

Open `src/lib/api-client.ts` and examine the response interceptor:

```ts
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
```

The interceptor checks three conditions that map directly to our three error categories:

`error.response` exists when the server sent back a response. This covers all 4xx and 5xx errors. The response object contains the status code and the response body, which often includes an error message from the server.

`error.request` exists but `error.response` does not when the request was sent but no response came back. This is a network error. The server is unreachable, the connection timed out, or something similar.

Neither `error.response` nor `error.request` exists when the error happened before the request was even sent. This could be a configuration error in your axios setup, or something went wrong while building the request.

Notice the last line: `return Promise.reject(error)`. This is critical. The interceptor logs the error for debugging but then re-throws it so the calling code can handle it too. If you forgot this line, all errors would be silently swallowed.

### Step 2: Understanding the AxiosError Object

When axios encounters an error, it creates an AxiosError object with several useful properties:

```ts
import axios from 'axios';

try {
  await apiClient.get('/startups/99999');
} catch (error) {
  if (axios.isAxiosError(error)) {
    // error.response - the server's response (if any)
    //   .status    - HTTP status code (404, 500, etc.)
    //   .data      - parsed response body
    //   .headers   - response headers

    // error.request - the XMLHttpRequest or http.ClientRequest
    // error.message - human-readable error message
    // error.code    - axios error code like 'ECONNABORTED' for timeouts
    // error.config  - the original request configuration
  }
}
```

The `axios.isAxiosError()` type guard is essential for TypeScript. It narrows the error type so you can safely access axios-specific properties. Without it, the error is typed as `unknown` and you cannot access `.response` or `.request`.

### Step 3: Classifying Errors for the User

Let us build a helper function that takes a raw error and returns a user-friendly message:

```ts
// src/lib/error-utils.ts

import axios from 'axios';

interface ClassifiedError {
  message: string;
  type: 'network' | 'validation' | 'auth' | 'not-found' | 'server' | 'unknown';
  fieldErrors?: Record<string, string>;
}

export function classifyError(error: unknown): ClassifiedError {
  if (!axios.isAxiosError(error)) {
    return {
      message: 'An unexpected error occurred.',
      type: 'unknown',
    };
  }

  // Network error - no response received
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return {
        message: 'The request timed out. Please try again.',
        type: 'network',
      };
    }
    return {
      message: 'Network error. Please check your connection.',
      type: 'network',
    };
  }

  const status = error.response.status;
  const data = error.response.data as Record<string, unknown>;

  // Validation errors (400)
  if (status === 400) {
    return {
      message: (data.error as string) || 'Please check your input.',
      type: 'validation',
      fieldErrors: data.errors as Record<string, string> | undefined,
    };
  }

  // Authentication errors (401)
  if (status === 401) {
    return {
      message: 'You must be logged in to perform this action.',
      type: 'auth',
    };
  }

  // Forbidden (403)
  if (status === 403) {
    return {
      message: 'You do not have permission to perform this action.',
      type: 'auth',
    };
  }

  // Not found (404)
  if (status === 404) {
    return {
      message: 'The requested resource was not found.',
      type: 'not-found',
    };
  }

  // Server errors (5xx)
  if (status >= 500) {
    return {
      message: 'Something went wrong on our end. Please try again later.',
      type: 'server',
    };
  }

  // Fallback for other status codes
  return {
    message: (data.error as string) || 'Something went wrong.',
    type: 'unknown',
  };
}
```

This function centralizes error classification. Instead of every component writing its own if/else chain for status codes, they call `classifyError` and get a structured result with a user-friendly message and a type they can use for conditional rendering.

### Step 4: Error Handling in the Create Startup Form

The `create-startup-form.tsx` component in our project demonstrates a thorough error handling pattern. Let us walk through its catch block:

```ts
// From src/components/create-startup-form.tsx

try {
  const startup = await createStartup({
    name: formData.name,
    tagline: formData.tagline,
    description: formData.description,
    url: formData.url,
    category_id: formData.category_id,
    logo_url: formData.logo_url || undefined,
  });

  await revalidateStartups();
  router.push('/startups/' + startup.id);
} catch (error) {
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    const data = error.response.data as Record<string, unknown>;

    if (status === 400 && data.errors) {
      const apiErrors = data.errors as Record<string, string>;
      setErrors(apiErrors);
    } else if (status === 401) {
      setSubmitError('You must be logged in to create a startup.');
    } else {
      setSubmitError(
        (data.error as string) || 'Something went wrong. Please try again.'
      );
    }
  } else {
    setSubmitError('Network error. Please check your connection.');
  }
}
```

There are several layers of error handling happening here:

First, it checks if the error is an axios error with a response. If not, it is a network error and shows a connection message.

Second, for a 400 status with an `errors` field, it sets field-level errors. This is the validation case. The backend returns something like `{ errors: { name: "Name is required", url: "Invalid URL format" } }` and the form shows each message next to the corresponding field.

Third, for a 401 status, it shows an authentication-specific message telling the user to log in.

Fourth, for any other server error, it tries to use the error message from the server and falls back to a generic message.

This layered approach gives users the most helpful information possible depending on what went wrong.

### Step 5: Displaying Field-Level Errors

The form tracks errors in a `Record<string, string>` state object and renders them next to each field:

```tsx
const [errors, setErrors] = useState<Record<string, string>>({});

// In the JSX for each field:
<input
  name="name"
  className={
    'w-full px-4 py-2 border rounded-lg ' +
    (errors.name ? 'border-red-500' : 'border-gray-300')
  }
/>
{errors.name && (
  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
)}
```

Two things make this work well for users. First, the input border turns red, providing an immediate visual indicator of which fields have problems. Second, the error message appears directly below the field so the user does not have to hunt for what went wrong.

The form also clears individual field errors as the user types:

```ts
function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
  const { name, value } = e.target;
  setFormData((prev) => ({ ...prev, [name]: value }));
  // Clear the error for this field when user starts typing
  if (errors[name]) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }
}
```

This feedback loop is important. Once the user starts correcting a field, the error message disappears immediately rather than lingering until the next form submission.

### Step 6: Displaying Form-Level Errors

In addition to field-level errors, the form has a `submitError` state for errors that are not tied to any specific field:

```tsx
const [submitError, setSubmitError] = useState<string | null>(null);

// At the top of the form:
{submitError && (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
    {submitError}
  </div>
)}
```

This covers network errors, 401 errors, and generic server errors. It renders as a prominent banner at the top of the form so the user sees it immediately. The form clears this error at the start of each submission attempt with `setSubmitError(null)`.

### Step 7: React Error Boundaries

Axios interceptors and try/catch blocks handle errors from API calls. But what happens when a component itself crashes during rendering? A null reference, a missing property, or a failed JSON parse during render will crash the entire React tree unless you catch it.

React error boundaries catch rendering errors and display a fallback UI:

```tsx
// src/components/error-boundary.tsx
'use client';

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // In production, send this to an error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">
            We encountered an unexpected error. Please refresh the page.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Error boundaries must be class components because the `getDerivedStateFromError` and `componentDidCatch` lifecycle methods are only available on classes. This is one of the rare cases where class components are still necessary in modern React.

Wrap sections of your app with error boundaries to prevent a single component crash from taking down the whole page:

```tsx
// In a layout or page
<ErrorBoundary>
  <StartupList />
</ErrorBoundary>
```

If `StartupList` throws during rendering, the error boundary catches it and shows the fallback UI while the rest of the page continues working.

### Step 8: Next.js Built-In Error Handling

Next.js App Router has its own error handling mechanism through special `error.tsx` files. Create one in any route segment to catch errors in that segment:

```tsx
// src/app/startups/error.tsx
'use client';

interface Props {
  error: Error;
  reset: () => void;
}

export default function StartupError({ error, reset }: Props) {
  return (
    <div className="max-w-2xl mx-auto mt-16 p-8 text-center">
      <h2 className="text-xl font-semibold mb-2">Failed to load startups</h2>
      <p className="text-gray-600 mb-4">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Try Again
      </button>
    </div>
  );
}
```

The `error.tsx` file must be a client component. Next.js automatically wraps the route segment in a React error boundary and passes the error and a reset function. The reset function attempts to re-render the segment, which is useful for transient errors.

### Step 9: Loading States and Error Prevention

Good error handling also means preventing confusing states. The create-startup-form.tsx disables the submit button while a request is in flight:

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

<button
  type="submit"
  disabled={isSubmitting}
  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isSubmitting ? 'Launching...' : 'Launch Startup'}
</button>
```

This prevents double submissions and gives the user feedback that their action is being processed. The `disabled:opacity-50` and `disabled:cursor-not-allowed` Tailwind classes make the disabled state visually obvious.

### Step 10: Enhancing the Interceptor for Better UX

Let us enhance the response interceptor to add toast-style notifications for errors that are not handled by individual components:

```ts
// Enhanced response interceptor

type ErrorCallback = (message: string) => void;

let onGlobalError: ErrorCallback | null = null;

export function setGlobalErrorHandler(callback: ErrorCallback) {
  onGlobalError = callback;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;

      // Only show global toast for server errors
      // Client errors (4xx) are handled by individual components
      if (status >= 500 && onGlobalError) {
        onGlobalError('Something went wrong on our end. Please try again.');
      }
    } else if (error.request && onGlobalError) {
      onGlobalError('Network error. Please check your connection.');
    }

    return Promise.reject(error);
  }
);
```

The key design decision here is that 4xx errors are NOT shown globally. Validation errors (400), auth errors (401), and not-found errors (404) should be handled by the component that made the request, because only that component knows the right context for the message. Server errors (500+) and network errors, on the other hand, are system-level problems that benefit from a global notification.

### Step 11: Retry Logic for Transient Errors

Network errors and 503 responses are often temporary. Adding retry logic for these specific cases can improve reliability:

```ts
// src/lib/retry.ts

import axios from 'axios';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === retries;

      if (isLastAttempt) {
        throw error;
      }

      // Only retry on network errors or 503
      const shouldRetry =
        axios.isAxiosError(error) &&
        (!error.response || error.response.status === 503);

      if (!shouldRetry) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      await sleep(RETRY_DELAY * Math.pow(2, attempt - 1));
    }
  }

  // TypeScript needs this even though it is unreachable
  throw new Error('Retry failed');
}
```

Usage:

```ts
const startups = await withRetry(() => getStartups({ page: 1 }));
```

The function retries only for errors that might be transient (no response at all, or a 503). It does not retry 400 or 404 errors because those will fail the same way every time. Exponential backoff prevents hammering a struggling server.

## Exercise

1. Create the `src/lib/error-utils.ts` file with the `classifyError` function from Step 3. Test it by passing different error shapes and verifying the returned messages.
2. Add a `not-found.tsx` file to `src/app/startups/[id]/` that shows a helpful message when a startup ID does not exist.
3. Create an `error.tsx` file for the `/startups` route that catches server-side rendering errors.
4. Modify the create-startup-form to use the `classifyError` helper instead of its inline error handling. Compare the readability.
5. Build the `withRetry` utility from Step 11 and wrap one of your API calls with it. Simulate a failure by temporarily pointing the API URL to a bad port.
6. Create an `ErrorBoundary` component and wrap it around a component. Test it by having the child component throw an error during render.

## Summary

Error handling is not an afterthought. It is a core part of user experience. Our LaunchPad frontend uses a layered approach: the axios response interceptor provides global error logging and can trigger system-wide notifications, individual components handle errors specific to their context (field validation, auth prompts), React error boundaries catch rendering crashes, and Next.js error.tsx files provide route-level fallbacks.

The pattern in create-startup-form.tsx is worth studying closely. It distinguishes between field-level validation errors (shown inline next to each input), authentication errors (shown as a form-level banner), and network errors (shown with a connection-specific message). This layered approach gives users the most relevant information about what went wrong and how to fix it.
