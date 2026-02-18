# Loading and Error States

A production-quality app does not just handle the happy path. Networks are slow, APIs fail, and users type URLs that do not exist. How your app responds to these situations determines whether it feels amateur or professional. In this lesson you will build skeleton loading screens, error boundaries, a custom 404 page, and reusable components for all of these states.

## What You Will Learn

- How Next.js file-based conventions (loading.tsx, error.tsx, not-found.tsx) work
- Building skeleton screen components that mimic your real UI
- Creating error boundaries with recovery options
- Using React Suspense boundaries for granular loading control
- Building a custom 404 page
- Adding loading spinners to interactive elements like search

## Concepts

### The File Convention System

Next.js App Router uses special filenames to handle different states:

- `loading.tsx` renders instantly while the page's async data is being fetched. It works by wrapping your page in a React Suspense boundary automatically.
- `error.tsx` catches runtime errors in a route segment and renders a fallback. It must be a client component because it uses React's error boundary under the hood.
- `not-found.tsx` renders when the `notFound()` function is called or when no route matches.
- `layout.tsx` wraps the page and persists across navigations.

These files are scoped to their directory. A `loading.tsx` inside `src/app/startups/` only affects the startups route, not the entire app. You can also create global versions in `src/app/`.

### Skeleton Screens vs Spinners

A skeleton screen shows the shape of the content before it loads. It gives users a preview of what is coming and feels faster than a blank page with a spinner. Studies show that skeleton screens make perceived loading time feel shorter.

A spinner is appropriate for small, inline loading states (like a search filtering operation). For full page loads, skeletons are better.

### Error Boundaries

React error boundaries catch JavaScript errors in their child component tree and display a fallback UI. In Next.js, the `error.tsx` file creates an error boundary for its route segment. The error component receives:
- `error`: the Error object that was thrown
- `reset`: a function to retry rendering the segment

## Step by Step

### Step 1: Create a Reusable Skeleton Component

Start by building a flexible skeleton primitive that you can compose into different layouts.

```tsx
// src/components/Skeleton.tsx

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={'animate-pulse rounded bg-gray-200 ' + className}
      aria-hidden="true"
    />
  );
}
```

The `aria-hidden="true"` attribute hides the skeleton from screen readers. The actual content will replace it, so there is no need for assistive technology to announce placeholder shapes.

Now create a skeleton specifically for the startup card layout:

```tsx
// src/components/StartupCardSkeleton.tsx
import Skeleton from '@/components/Skeleton';

export default function StartupCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 p-6">
      {/* Image placeholder */}
      <Skeleton className="mb-4 h-40 w-full rounded-lg" />
      {/* Category badge */}
      <Skeleton className="mb-3 h-5 w-20 rounded-full" />
      {/* Title */}
      <Skeleton className="mb-2 h-6 w-3/4" />
      {/* Tagline */}
      <Skeleton className="mb-4 h-4 w-full" />
      <Skeleton className="mb-4 h-4 w-2/3" />
      {/* Footer with upvote button */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}
```

This skeleton mirrors the shape of your real `StartupCard` component. When the real data loads, the transition feels natural because the layout does not shift.

### Step 2: Create the Startups Loading Page

```tsx
// src/app/startups/loading.tsx
import StartupCardSkeleton from '@/components/StartupCardSkeleton';
import Skeleton from '@/components/Skeleton';

export default function StartupsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Page title skeleton */}
      <Skeleton className="mb-8 h-9 w-64" />

      {/* Search bar skeleton */}
      <Skeleton className="mb-6 h-10 w-full rounded-lg" />

      {/* Filter pills skeleton */}
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      {/* Results count skeleton */}
      <Skeleton className="mb-6 h-4 w-32" />

      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StartupCardSkeleton />
        <StartupCardSkeleton />
        <StartupCardSkeleton />
        <StartupCardSkeleton />
        <StartupCardSkeleton />
        <StartupCardSkeleton />
      </div>
    </div>
  );
}
```

This loading page appears instantly when a user navigates to `/startups`. It matches the real page layout: a title, search bar, filter pills, and a grid of card placeholders. Once the server component finishes fetching data, it seamlessly replaces this skeleton.

### Step 3: Create a Reusable Error Component

Build a reusable error display component before the route-level error boundary.

```tsx
// src/components/ErrorMessage.tsx

interface ErrorMessageProps {
  title?: string;
  message?: string;
  retry?: () => void;
}

export default function ErrorMessage({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  retry,
}: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-full bg-red-100 p-3">
        <svg
          className="h-8 w-8 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mb-6 max-w-md text-gray-600">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
```

### Step 4: Create the Startups Error Page

The error boundary must be a client component. It receives the error and a reset function.

```tsx
// src/app/startups/error.tsx
'use client';

import ErrorMessage from '@/components/ErrorMessage';

export default function StartupsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <ErrorMessage
        title="Failed to load startups"
        message={
          'We could not load the startups list. This might be a temporary issue. ' +
          'Please try again or come back later.'
        }
        retry={reset}
      />
      {process.env.NODE_ENV === 'development' && (
        <details className="mx-auto mt-4 max-w-md">
          <summary className="cursor-pointer text-sm text-gray-500">
            Error details (development only)
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-gray-100 p-4 text-xs text-red-800">
            {error.message}
            {'\n'}
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}
```

Notice the development-only error details. In production you do not want to expose stack traces to users, but during development they are invaluable for debugging.

The `reset` function attempts to re-render the route segment. If the error was caused by a temporary network issue, clicking "Try Again" may succeed on the second attempt.

The `digest` property on the error object is a hash that Next.js generates for server-side errors. It appears in server logs so you can correlate the user-facing error with the server-side cause.

### Step 5: Create a Custom 404 Page

When a user visits a URL that does not exist, they should see something helpful, not the default browser error.

```tsx
// src/app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-900">404</h1>
      <div className="mt-4 mb-2">
        <svg
          className="mx-auto h-16 w-16 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-2xl font-semibold text-gray-900">
        Page not found
      </h2>
      <p className="mb-8 max-w-md text-gray-600">
        The page you are looking for does not exist or has been moved.
        Let us get you back on track.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Go Home
        </Link>
        <Link
          href="/startups"
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Browse Startups
        </Link>
      </div>
    </div>
  );
}
```

This page gives users two clear paths forward: go home or browse startups. The `min-h-[60vh]` ensures the content is vertically centered even though the page is short.

### Step 6: Handle Not Found in Dynamic Routes

Update the startup detail page to properly trigger the 404 when a startup is not found.

```tsx
// src/app/startups/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { getStartupBySlug } from '@/lib/api';

interface StartupDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function StartupDetailPage({
  params,
}: StartupDetailPageProps) {
  const { slug } = await params;
  const startup = await getStartupBySlug(slug);

  if (!startup) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Your existing detail page content */}
      <h1 className="text-3xl font-bold text-gray-900">{startup.name}</h1>
      {/* ... rest of the page ... */}
    </div>
  );
}
```

The `notFound()` function from `next/navigation` triggers the nearest `not-found.tsx`. If you have a `not-found.tsx` inside `src/app/startups/[slug]/`, it will use that. Otherwise it falls back to the one in `src/app/`.

In Next.js 15, the `params` prop is a Promise. You must `await` it before accessing properties like `slug`.

### Step 7: Create a Detail Page Loading State

```tsx
// src/app/startups/[slug]/loading.tsx
import Skeleton from '@/components/Skeleton';

export default function StartupDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Skeleton className="mb-6 h-4 w-32" />

      {/* Image */}
      <Skeleton className="mb-6 h-64 w-full rounded-xl" />

      {/* Category badge */}
      <Skeleton className="mb-4 h-6 w-28 rounded-full" />

      {/* Title */}
      <Skeleton className="mb-2 h-10 w-2/3" />

      {/* Tagline */}
      <Skeleton className="mb-6 h-5 w-1/2" />

      {/* Description */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex gap-4">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}
```

### Step 8: Create a Reusable Spinner Component

In lesson 07, we added inline spinner code. Let us extract that into a reusable component.

```tsx
// src/components/Spinner.tsx

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <svg
      className={'animate-spin ' + sizeClasses[size] + ' ' + className}
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
```

Now you can use `<Spinner size="sm" />` anywhere in your app, like in the search results area or inside the form submit button.

### Step 9: Using Suspense for Granular Control

Sometimes the automatic `loading.tsx` is too broad. You might want part of a page to show immediately while another part loads. That is where explicit `Suspense` boundaries come in.

Here is an example where the page header renders immediately while the startup list loads:

```tsx
// src/app/startups/page.tsx — alternative with explicit Suspense
import { Suspense } from 'react';
import { getCategories } from '@/lib/api';
import StartupSearch from '@/components/StartupSearch';
import StartupCardSkeleton from '@/components/StartupCardSkeleton';

async function StartupResults() {
  const { getStartups } = await import('@/lib/api');
  const [startups, categories] = await Promise.all([
    getStartups(),
    getCategories(),
  ]);

  return <StartupSearch categories={categories} initialStartups={startups} />;
}

export default function StartupsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">
        Browse Startups
      </h1>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <StartupCardSkeleton />
            <StartupCardSkeleton />
            <StartupCardSkeleton />
          </div>
        }
      >
        <StartupResults />
      </Suspense>
    </div>
  );
}
```

The title "Browse Startups" appears instantly. The card grid shows skeletons until the data is ready. This gives a perception of speed because the user sees content immediately.

The difference between `loading.tsx` and explicit `<Suspense>`:
- `loading.tsx` wraps the entire page. Nothing from the page shows until data is ready.
- Explicit `<Suspense>` lets you choose exactly which parts should show a fallback, while the rest renders immediately.

Use `loading.tsx` when the entire page depends on data. Use explicit `<Suspense>` when you can meaningfully show part of the page while the rest loads.

### Step 10: Test Everything

Test each state systematically:

1. Navigate to `/startups`. You should briefly see the skeleton loading page (the simulated delay in the API helps you see it).
2. Navigate to `/startups/nonexistent-slug`. You should see the 404 page.
3. Navigate to `/does-not-exist`. You should also see the 404 page.
4. To test the error boundary, temporarily add `throw new Error('Test error')` at the top of the startups page component. You should see the error UI with the "Try Again" button and error details in development mode. Remove the throw after testing.
5. Navigate to a startup detail page. You should see the detail loading skeleton briefly.

## Try It Yourself

1. Create a loading state for the submit page (`src/app/submit/loading.tsx`) that shows skeleton fields matching the form layout.

2. Create a specific `not-found.tsx` inside `src/app/startups/[slug]/` with a message like "This startup does not exist" and a link back to the startups listing.

3. Create a `loading.tsx` for the categories page that shows skeleton category cards.

4. Create an `error.tsx` for the root layout (`src/app/error.tsx`) that catches errors anywhere in the app. Include a "Go Home" button alongside the "Try Again" button.

## Key Takeaways

- Use `loading.tsx` for route-level loading states. It works by wrapping your page in a Suspense boundary automatically.
- Use `error.tsx` for route-level error handling. It must be a client component and receives `error` and `reset` props.
- Skeleton screens feel faster than spinners for page-level loading. Match the skeleton layout to your real content layout.
- The `notFound()` function triggers the nearest `not-found.tsx`. Use it in dynamic routes when data is missing.
- In Next.js 15, the `params` prop is a Promise and must be awaited.
- Use explicit Suspense boundaries when you want part of a page to render immediately while another part loads.
- Always provide a recovery path in error states (retry button, navigation links).
- Show error details only in development mode.

## Next Steps

Your app handles all the edge cases now, but it might not look great on every screen size. In the next lesson, you will make LaunchPad fully responsive, from a mobile hamburger menu to adaptive grid layouts.
