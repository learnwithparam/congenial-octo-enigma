# Fetching Data in React Server Components

React Server Components are the most significant shift in how we build React applications in years. They let you fetch data directly inside your components, on the server, without sending the fetching logic to the browser. In this lesson, we will understand how Server Components work, convert our LaunchPad pages to use server-side data fetching properly, and add streaming with Suspense for a polished loading experience.

## What You Will Learn

- The difference between React Server Components and Client Components
- How async Server Components fetch data without useEffect or useState
- Why Next.js extends the fetch API with caching and revalidation
- How to structure components as server or client based on their needs
- How Suspense and streaming create instant-feeling page loads
- How to combine Server Components with the API layer we built in Lesson 02

## Concepts

### Server Components vs Client Components

Every component in a Next.js 15 App Router application is a Server Component by default. This means it runs on the server during the request and sends rendered HTML to the browser. The component code never reaches the client bundle.

A Client Component is any component that starts with the `"use client"` directive. It runs on the server for the initial render (server-side rendering) and then hydrates in the browser, where it can use hooks like useState, useEffect, and event handlers.

Here is the mental model: Server Components are for reading and displaying data. Client Components are for interactivity. Most of your application should be Server Components, with Client Components sprinkled in where you need user interaction.

### Why Server Components for Data Fetching

When you fetch data in a Server Component, several powerful things happen:

First, the data fetching runs on the server, which is typically much closer to your database or API server. A request from your Next.js server to your API on the same machine or same data center is nearly instant, compared to a browser making a cross-network request.

Second, the fetch logic, the API client library, and any data transformation code never get sent to the browser. This reduces your JavaScript bundle size.

Third, sensitive information like API keys or internal URLs stay on the server. The browser never sees them.

Fourth, Next.js can cache the results of server-side fetches, so repeated requests for the same data are instant.

### Next.js Extended Fetch

Next.js 15 extends the native fetch API with additional options for caching and revalidation. When you use fetch inside a Server Component, Next.js intercepts the call and adds caching behavior.

This is important: these extensions only work with the native fetch API, not with axios. That is why we will use fetch directly for server-side data fetching and keep axios for client-side interactions. This is not wasteful duplication; it is using the right tool for each context.

## Step by Step

### Step 1: Create Server-Side Fetch Functions

Since Next.js caching extensions only work with native fetch, let us create server-specific data fetching functions. Create `src/lib/api-server.ts`:

```ts
// src/lib/api-server.ts
// Server-side fetch functions with Next.js caching

const API_BASE_URL = 'http://localhost:3001/api';

import type {
  Startup,
  Category,
  PaginatedResponse,
} from '@/types';

async function fetchFromApi<T>(
  endpoint: string,
  options?: RequestInit & { next?: { revalidate?: number; tags?: string[] } }
): Promise<T> {
  const url = API_BASE_URL + endpoint;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(
      'API request failed: ' + response.status + ' ' + response.statusText
    );
  }

  return response.json();
}

export async function getStartupsServer(params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}): Promise<PaginatedResponse<Startup>> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  const endpoint = '/startups' + (query ? '?' + query : '');

  return fetchFromApi<PaginatedResponse<Startup>>(endpoint, {
    next: {
      revalidate: 60, // Revalidate every 60 seconds
      tags: ['startups'],
    },
  });
}

export async function getStartupServer(id: number): Promise<Startup> {
  return fetchFromApi<Startup>('/startups/' + id, {
    next: {
      revalidate: 60,
      tags: ['startup-' + id],
    },
  });
}

export async function getCategoriesServer(): Promise<Category[]> {
  return fetchFromApi<Category[]>('/categories', {
    next: {
      revalidate: 3600, // Categories change rarely, cache for 1 hour
      tags: ['categories'],
    },
  });
}
```

The `next.revalidate` option tells Next.js how long to cache the response. After 60 seconds, the next request will fetch fresh data. The `next.tags` option lets us manually invalidate specific pieces of cached data (we will use this in Lesson 04 when creating or updating startups).

Notice that categories have a longer revalidation time (3600 seconds = 1 hour) because they change rarely, while startups revalidate every 60 seconds to pick up new launches.

### Step 2: Understand the Two API Files

You now have two API files with a clear separation of concerns:

`src/lib/api.ts` uses axios. It is for Client Components, form submissions, and mutations. Axios gives us interceptors, automatic error handling, and a pleasant developer experience for interactive operations.

`src/lib/api-server.ts` uses native fetch. It is for Server Components and server-side data fetching. Native fetch integrates with Next.js caching, revalidation, and streaming.

This is not redundancy. Each file serves a different runtime context with different requirements.

### Step 3: Convert the Home Page to a Server Component

Our home page from Lesson 02 was already an async function, which makes it a Server Component. Let us refine it to use our server-specific fetch functions:

```ts
// src/app/page.tsx

import { getStartupsServer } from '@/lib/api-server';
import { StartupCard } from '@/components/startup-card';
import Link from 'next/link';

export default async function HomePage() {
  const result = await getStartupsServer({ limit: 12 });

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <section className="text-center py-16">
        <h1 className="text-4xl font-bold">
          Discover the Next Big Thing
        </h1>
        <p className="text-xl text-gray-600 mt-4">
          LaunchPad showcases the most innovative startups
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Latest Launches</h2>
          <Link
            href="/startups"
            className="text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {result.data.map((startup) => (
            <StartupCard key={startup.id} startup={startup} />
          ))}
        </div>
      </section>
    </main>
  );
}
```

There is no loading state code, no useEffect, no useState. The component awaits the data and renders it. Next.js handles everything else. The HTML is generated on the server with the data already embedded, so the browser receives a fully rendered page.

### Step 4: Understand Async Components

In traditional React, components are synchronous functions. They return JSX immediately. If they need data, they use useEffect to fetch it after the first render, creating a loading/loaded cycle.

Server Components can be async functions. They can use await directly in the component body. The server waits for the data before rendering the component. This eliminates the entire category of "loading state" bugs where components render with undefined data.

```ts
// This is valid in a Server Component
export default async function Page() {
  const data = await fetchSomeData();  // Server waits for this
  return <div>{data.title}</div>;       // Renders with real data
}
```

```ts
// This is NOT valid in a Client Component
'use client';
export default async function Page() {  // ERROR: Client components cannot be async
  const data = await fetchSomeData();
  return <div>{data.title}</div>;
}
```

If you try to make a Client Component async, React will throw an error. Async is exclusively a Server Component feature.

### Step 5: Add Suspense for Streaming

While Server Components eliminate loading states within the component, the user still has to wait for data before seeing anything. Suspense solves this by letting you show a fallback UI while parts of the page load.

First, extract the data-fetching part into a separate async component:

```ts
// src/components/startup-grid.tsx

import { getStartupsServer } from '@/lib/api-server';
import { StartupCard } from '@/components/startup-card';

interface Props {
  category?: string;
  search?: string;
  page?: number;
}

export async function StartupGrid({ category, search, page = 1 }: Props) {
  const result = await getStartupsServer({
    page,
    limit: 12,
    category,
    search,
  });

  if (result.data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No startups found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {result.data.map((startup) => (
        <StartupCard key={startup.id} startup={startup} />
      ))}
    </div>
  );
}
```

Now wrap it with Suspense in the page:

```ts
// src/app/startups/page.tsx

import { Suspense } from 'react';
import { StartupGrid } from '@/components/startup-grid';
import { StartupGridSkeleton } from '@/components/startup-grid-skeleton';
import { CategoryFilter } from '@/components/category-filter';
import { getCategoriesServer } from '@/lib/api-server';

interface Props {
  searchParams: Promise<{
    category?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function StartupsPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const categories = await getCategoriesServer();

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">All Startups</h1>

      <CategoryFilter
        categories={categories}
        activeCategory={resolvedParams.category}
      />

      <div className="mt-8">
        <Suspense fallback={<StartupGridSkeleton />}>
          <StartupGrid
            category={resolvedParams.category}
            search={resolvedParams.search}
            page={page}
          />
        </Suspense>
      </div>
    </main>
  );
}
```

Create the skeleton component:

```ts
// src/components/startup-grid-skeleton.tsx

export function StartupGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="p-6 rounded-lg border border-gray-200"
        >
          <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-gray-100 rounded animate-pulse mt-3" />
          <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse mt-2" />
        </div>
      ))}
    </div>
  );
}
```

Here is how streaming works with Suspense:

1. The browser receives the page shell immediately (the heading and category filter)
2. The StartupGrid is still loading, so Suspense shows the skeleton fallback
3. When the API call in StartupGrid resolves, React streams the real content to the browser
4. The skeleton is replaced with the actual startup cards, with no full page reload

The user sees meaningful content almost instantly because the static parts of the page arrive first. The dynamic parts stream in as they become available. This is dramatically better than showing a blank screen until all data loads.

### Step 6: Parallel Data Fetching with Multiple Suspense Boundaries

You can have multiple Suspense boundaries that load independently. Consider a page that shows both featured startups and recent startups:

```ts
// src/app/page.tsx (enhanced version)

import { Suspense } from 'react';
import { FeaturedStartups } from '@/components/featured-startups';
import { RecentStartups } from '@/components/recent-startups';
import { StartupGridSkeleton } from '@/components/startup-grid-skeleton';

export default function HomePage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <section className="text-center py-16">
        <h1 className="text-4xl font-bold">
          Discover the Next Big Thing
        </h1>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Featured</h2>
        <Suspense fallback={<StartupGridSkeleton />}>
          <FeaturedStartups />
        </Suspense>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Recently Launched</h2>
        <Suspense fallback={<StartupGridSkeleton />}>
          <RecentStartups />
        </Suspense>
      </section>
    </main>
  );
}
```

Notice that the page component itself is no longer async. It does not fetch any data. Each section that needs data is a separate async Server Component wrapped in its own Suspense boundary. Both FeaturedStartups and RecentStartups fetch data in parallel, and whichever finishes first streams its content to the browser first.

This pattern is the key to building fast pages. Instead of one big waterfall (fetch A, then fetch B, then render), each piece of data loads independently and renders as soon as it arrives.

### Step 7: The Waterfall Problem and How to Avoid It

Consider this anti-pattern:

```ts
// BAD: Sequential data fetching (waterfall)
export default async function StartupPage({ params }: Props) {
  const { id } = await params;
  const startup = await getStartupServer(parseInt(id, 10));
  const categories = await getCategoriesServer(); // Waits for startup to finish!
  const relatedStartups = await getStartupsServer({
    category: String(startup.category_id),
    limit: 3,
  }); // Waits for categories to finish!

  return <div>...</div>;
}
```

Each await blocks until the previous one completes. If each request takes 200ms, the total is 600ms. Fix this with Promise.all for independent requests:

```ts
// GOOD: Parallel data fetching
export default async function StartupPage({ params }: Props) {
  const { id } = await params;
  const numericId = parseInt(id, 10);

  // These two don't depend on each other, fetch in parallel
  const [startup, categories] = await Promise.all([
    getStartupServer(numericId),
    getCategoriesServer(),
  ]);

  // This depends on startup data, so it must be sequential
  const relatedStartups = await getStartupsServer({
    category: String(startup.category_id),
    limit: 3,
  });

  return <div>...</div>;
}
```

Now the first two requests run in parallel (total: 200ms instead of 400ms). The third request still depends on the first, so it runs sequentially. Total: 400ms instead of 600ms.

For even better performance, move the related startups into a separate Suspense boundary so the main content renders immediately while related startups load independently.

### Step 8: When to Use Client Components

Not everything can be a Server Component. You need Client Components when:

- The component uses browser-only APIs (window, localStorage, etc.)
- The component uses React hooks (useState, useEffect, useRef, etc.)
- The component has event handlers (onClick, onChange, onSubmit, etc.)
- The component uses browser-specific libraries

In LaunchPad, here are components that should be Client Components:

```ts
// src/components/upvote-button.tsx
'use client';

import { useState } from 'react';
import { upvoteStartup } from '@/lib/api';

interface Props {
  startupId: number;
  initialUpvotes: number;
}

export function UpvoteButton({ startupId, initialUpvotes }: Props) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [isVoting, setIsVoting] = useState(false);

  async function handleUpvote() {
    setIsVoting(true);
    try {
      const result = await upvoteStartup(startupId);
      setUpvotes(result.upvotes);
    } catch (error) {
      console.error('Failed to upvote');
    } finally {
      setIsVoting(false);
    }
  }

  return (
    <button
      onClick={handleUpvote}
      disabled={isVoting}
      className="flex items-center gap-2 px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
    >
      <span>{upvotes}</span>
    </button>
  );
}
```

Notice that this Client Component uses the axios-based `api.ts` (not `api-server.ts`). Client Components make requests from the browser, so they use the axios client. The Server Component parent passes down the `initialUpvotes` prop so the button has data immediately without a client-side fetch.

### Step 9: The Server/Client Component Boundary

A Server Component can import and render Client Components. But a Client Component cannot import a Server Component. This creates a one-way boundary.

```
Server Component (page.tsx)
  ├── Server Component (startup-grid.tsx)
  │     └── Server Component (startup-card.tsx)
  │           └── Client Component (upvote-button.tsx)  ← boundary
  └── Client Component (search-input.tsx)  ← boundary
```

Everything above the boundary runs on the server. Everything at and below the boundary runs on both server (for initial HTML) and client (for interactivity).

The key insight: keep the boundary as far down the tree as possible. The more components that remain server-only, the less JavaScript you ship to the browser.

### Step 10: Combining Server and Client Components in the Detail Page

Here is a real-world example showing the server/client boundary in the startup detail page:

```ts
// src/app/startups/[id]/page.tsx (Server Component)

import { Suspense } from 'react';
import { getStartupServer, getCategoriesServer } from '@/lib/api-server';
import { UpvoteButton } from '@/components/upvote-button';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StartupPage({ params }: Props) {
  const { id } = await params;
  const numericId = parseInt(id, 10);

  if (isNaN(numericId)) {
    notFound();
  }

  let startup;
  try {
    startup = await getStartupServer(numericId);
  } catch {
    notFound();
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{startup.name}</h1>
          <p className="text-lg text-gray-600 mt-2">{startup.tagline}</p>
        </div>
        {/* Client Component for interactivity */}
        <UpvoteButton
          startupId={startup.id}
          initialUpvotes={startup.upvotes}
        />
      </div>

      <div className="mt-8 prose max-w-none">
        <p>{startup.description}</p>
      </div>

      <div className="mt-6">
        <a
          href={startup.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Visit Website
        </a>
      </div>
    </main>
  );
}
```

The page itself is a Server Component. It fetches data, renders static content, and includes one Client Component (UpvoteButton) for the interactive upvote feature. The startup data is passed as props from server to client.

## Exercise

1. Create `src/lib/api-server.ts` with the server-side fetch functions that use Next.js caching
2. Update your home page and startups listing page to use the server fetch functions
3. Create a `StartupGrid` async Server Component and wrap it with Suspense
4. Create a `StartupGridSkeleton` component for the loading fallback
5. Identify all Client Components in your application and make sure they use the `"use client"` directive
6. Find any sequential await calls in your pages and convert independent ones to use Promise.all
7. Add a second Suspense boundary to the home page for a different data section

## Key Takeaways

- Server Components are the default in Next.js 15 App Router and run only on the server
- Server Components can be async functions that await data directly in the component body
- Next.js extends native fetch with caching (revalidate) and cache tags - these only work with fetch, not axios
- Use native fetch in Server Components and axios in Client Components, this is intentional, not duplication
- Suspense boundaries let static parts of a page render immediately while dynamic parts stream in
- Use Promise.all for independent data fetches to avoid waterfall requests
- Keep the server/client boundary as far down the component tree as possible to minimize client JavaScript

## Summary

In this lesson, we explored React Server Components and how they fundamentally change data fetching in Next.js applications. We created server-specific fetch functions that leverage Next.js caching, wrapped data-fetching components in Suspense boundaries for streaming, and learned to optimize data loading with parallel fetches. We also established a clear boundary between Server Components (for data reading) and Client Components (for interactivity).

The result is an application that loads faster, ships less JavaScript, and provides a smooth streaming experience for users.

## What is Next

In the next lesson, we will tackle the other half of the data flow: mutations. You will learn how to build forms that submit data to the API, handle form state in Client Components, and use Next.js revalidation to refresh cached data after a mutation.
