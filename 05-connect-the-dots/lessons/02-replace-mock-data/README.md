# Replace Mock Data with Real API Calls

In Course 02, we built every page of LaunchPad using hardcoded arrays of startup objects. That was the right approach for prototyping the UI, but now we have a real REST API running on port 3001. In this lesson, we will create a typed API layer and systematically replace every piece of mock data with live API calls.

By the end of this lesson, your LaunchPad frontend will display real data from the SQLite database that Course 03 set up.

## What You Will Learn

- How to create a typed API layer with TypeScript interfaces
- How to build reusable API functions using the axios client from Lesson 01
- How to replace mock data imports with API calls in your pages
- How to handle loading states while data is being fetched
- How to structure your API layer for maintainability

## Concepts

### The API Layer Pattern

Instead of scattering axios calls throughout your components, a well-structured application centralizes all API communication in a dedicated layer. This layer lives in a single file (or folder for larger apps) and exports typed functions that components can call.

The benefits are significant. When an API endpoint changes, you update one file instead of hunting through dozens of components. TypeScript types ensure your components always know the shape of the data they receive. And testing becomes easier because you can mock the API layer instead of mocking HTTP calls.

### TypeScript and API Responses

When data comes from an external API, TypeScript cannot verify the shape at runtime. You define interfaces that describe what you expect the API to return, and TypeScript trusts you. This is a trade-off: you get type safety in your components, but you are responsible for keeping your types in sync with the API.

In a production application, you might use a schema validation library like zod to validate API responses at runtime. For this course, we will rely on TypeScript interfaces and trust that our API (which we built ourselves in Course 03) returns the right shape.

## Step by Step

### Step 1: Define TypeScript Types

First, let us define the types that match what our Course 03 API returns. Create `src/types/index.ts`:

```ts
// src/types/index.ts

export interface Startup {
  id: number;
  name: string;
  tagline: string;
  description: string;
  url: string;
  category_id: number;
  logo_url: string | null;
  upvotes: number;
  launch_date: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
}

// For creating new startups
export interface CreateStartupInput {
  name: string;
  tagline: string;
  description: string;
  url: string;
  category_id: number;
  logo_url?: string;
}

// For updating startups
export interface UpdateStartupInput {
  name?: string;
  tagline?: string;
  description?: string;
  url?: string;
  category_id?: number;
  logo_url?: string;
}

// Paginated response wrapper
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

These types mirror the database schema from Course 03. Notice that `launch_date`, `created_at`, and `updated_at` are strings, not Date objects. JSON does not have a Date type, so dates come over the wire as ISO 8601 strings.

### Step 2: Build the API Functions

Now create the API layer that uses our axios client from Lesson 01. Create `src/lib/api.ts`:

```ts
// src/lib/api.ts

import apiClient from './api-client';
import type {
  Startup,
  Category,
  CreateStartupInput,
  UpdateStartupInput,
  PaginatedResponse,
} from '@/types';

// ============================================
// Startup endpoints
// ============================================

export async function getStartups(params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}): Promise<PaginatedResponse<Startup>> {
  const response = await apiClient.get('/startups', { params });
  return response.data;
}

export async function getStartup(id: number): Promise<Startup> {
  const response = await apiClient.get('/startups/' + id);
  return response.data;
}

export async function createStartup(
  data: CreateStartupInput
): Promise<Startup> {
  const response = await apiClient.post('/startups', data);
  return response.data;
}

export async function updateStartup(
  id: number,
  data: UpdateStartupInput
): Promise<Startup> {
  const response = await apiClient.put('/startups/' + id, data);
  return response.data;
}

export async function deleteStartup(id: number): Promise<void> {
  await apiClient.delete('/startups/' + id);
}

export async function upvoteStartup(
  id: number
): Promise<{ upvotes: number }> {
  const response = await apiClient.post('/startups/' + id + '/upvote');
  return response.data;
}

// ============================================
// Category endpoints
// ============================================

export async function getCategories(): Promise<Category[]> {
  const response = await apiClient.get('/categories');
  return response.data;
}

export async function getCategory(id: number): Promise<Category> {
  const response = await apiClient.get('/categories/' + id);
  return response.data;
}
```

Each function is small, typed, and focused on a single endpoint. The return types tell every component exactly what data shape to expect. The `params` object on `getStartups` maps to URL query parameters. Axios automatically serializes `{ page: 2, category: "ai" }` into `?page=2&category=ai`.

### Step 3: Remove Mock Data

In Course 02, you likely had mock data files like `src/data/startups.ts` and `src/data/categories.ts`. Let us look at what a typical mock file contains:

```ts
// src/data/startups.ts (Course 02 version - TO BE REMOVED)

export const startups = [
  {
    id: 1,
    name: 'AI Writer Pro',
    tagline: 'Write better content with AI',
    description: 'An AI-powered writing assistant...',
    url: 'https://aiwriterpro.example.com',
    category_id: 1,
    logo_url: null,
    upvotes: 42,
    launch_date: '2024-01-15',
  },
  // ... more mock startups
];
```

You have two options for removing mock data. Option one: delete the mock data files entirely. This forces you to find and fix every import immediately. Option two: keep the files temporarily but mark them as deprecated with a comment at the top, then remove them after all pages are updated. We will go with option one since we will update all pages in this lesson.

Delete your mock data files:

```bash
rm src/data/startups.ts
rm src/data/categories.ts
```

After deleting these files, TypeScript will show errors in every file that imported them. That is exactly what we want. The compiler is telling us every location that needs to be updated.

### Step 4: Update the Home Page

The home page likely displays a list of featured startups. Here is how it might have looked with mock data:

```ts
// src/app/page.tsx (BEFORE - with mock data)

import { startups } from '@/data/startups';
import { StartupCard } from '@/components/startup-card';

export default function HomePage() {
  return (
    <main>
      <h1>Discover the Next Big Thing</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {startups.map((startup) => (
          <StartupCard key={startup.id} startup={startup} />
        ))}
      </div>
    </main>
  );
}
```

Now let us update it to fetch real data. For now, we will fetch data directly in the component. In Lesson 03, we will refine this approach using Server Components properly.

```ts
// src/app/page.tsx (AFTER - with real API calls)

import { getStartups } from '@/lib/api';
import { StartupCard } from '@/components/startup-card';

export default async function HomePage() {
  const result = await getStartups({ limit: 12 });

  return (
    <main>
      <h1>Discover the Next Big Thing</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {result.data.map((startup) => (
          <StartupCard key={startup.id} startup={startup} />
        ))}
      </div>
    </main>
  );
}
```

The key changes: we import from `@/lib/api` instead of `@/data/startups`, the component is now async (more on this in Lesson 03), and we access `result.data` because our API returns a paginated wrapper.

### Step 5: Update the Startup Detail Page

The detail page fetches a single startup by ID from the URL params:

```ts
// src/app/startups/[id]/page.tsx

import { getStartup } from '@/lib/api';
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

  try {
    const startup = await getStartup(numericId);

    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold">{startup.name}</h1>
        <p className="text-lg text-gray-600 mt-2">{startup.tagline}</p>
        <div className="mt-6 prose">
          <p>{startup.description}</p>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Upvotes: {startup.upvotes}
          </span>
          <a
            href={startup.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Visit Website
          </a>
        </div>
      </main>
    );
  } catch (error) {
    notFound();
  }
}
```

Note the `params` type. In Next.js 15, dynamic route params are now a Promise that you must await. The `try/catch` wrapping the API call ensures that if the startup does not exist (404 from the API), we show the Next.js not-found page instead of an error.

### Step 6: Update the Categories Page

The categories page and any category filtering also need updating:

```ts
// src/app/categories/page.tsx

import { getCategories } from '@/lib/api';
import Link from 'next/link';

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Browse Categories</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={'/startups?category=' + category.slug}
            className="block p-6 rounded-lg border border-gray-200 hover:border-blue-500 transition-colors"
          >
            <h2 className="text-xl font-semibold">{category.name}</h2>
            {category.description && (
              <p className="text-gray-600 mt-2">{category.description}</p>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
```

### Step 7: Update the Startups Listing Page with Filtering

If your startups listing page supports category filtering or search, update it to pass those parameters through:

```ts
// src/app/startups/page.tsx

import { getStartups, getCategories } from '@/lib/api';
import { StartupCard } from '@/components/startup-card';
import { CategoryFilter } from '@/components/category-filter';

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

  const [startupsResult, categories] = await Promise.all([
    getStartups({
      page,
      limit: 12,
      category: resolvedParams.category,
      search: resolvedParams.search,
    }),
    getCategories(),
  ]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">All Startups</h1>

      <CategoryFilter
        categories={categories}
        activeCategory={resolvedParams.category}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {startupsResult.data.map((startup) => (
          <StartupCard key={startup.id} startup={startup} />
        ))}
      </div>

      {startupsResult.totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: startupsResult.totalPages }, (_, i) => (
            <a
              key={i + 1}
              href={
                '/startups?page=' + (i + 1) +
                (resolvedParams.category
                  ? '&category=' + resolvedParams.category
                  : '')
              }
              className={
                'px-4 py-2 rounded ' +
                (page === i + 1
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200')
              }
            >
              {i + 1}
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
```

Notice the use of `Promise.all` to fetch startups and categories in parallel. Since neither call depends on the other, running them concurrently cuts the total loading time nearly in half. Also note that `searchParams` is a Promise in Next.js 15, just like `params`.

### Step 8: Update the StartupCard Component

Your `StartupCard` component needs to use the `Startup` type from our new types file:

```ts
// src/components/startup-card.tsx

import Link from 'next/link';
import type { Startup } from '@/types';

interface StartupCardProps {
  startup: Startup;
}

export function StartupCard({ startup }: StartupCardProps) {
  return (
    <Link
      href={'/startups/' + startup.id}
      className="block p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{startup.name}</h3>
          <p className="text-gray-600 mt-1">{startup.tagline}</p>
        </div>
        <span className="flex items-center gap-1 text-sm text-gray-500">
          {startup.upvotes}
        </span>
      </div>
    </Link>
  );
}
```

By importing the `Startup` type from `@/types`, this component is now in sync with the API response shape. If the API adds a field, you add it to the type once and every component benefits.

### Step 9: Handle Loading States

When fetching data from an API, there is a delay before the data arrives. In Server Components (which we are using above), Next.js handles this with streaming, and we will explore that in detail in Lesson 03. But if you have any Client Components that fetch data, you need explicit loading states.

Here is a pattern for a client-side data fetch with loading state:

```ts
// src/components/startup-list-client.tsx
'use client';

import { useEffect, useState } from 'react';
import { getStartups } from '@/lib/api';
import { StartupCard } from '@/components/startup-card';
import type { Startup } from '@/types';

export function StartupListClient() {
  const [startups, setStartups] = useState<Startup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStartups() {
      try {
        setLoading(true);
        const result = await getStartups({ limit: 12 });
        setStartups(result.data);
      } catch (err) {
        setError('Failed to load startups. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadStartups();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-lg bg-gray-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {startups.map((startup) => (
        <StartupCard key={startup.id} startup={startup} />
      ))}
    </div>
  );
}
```

The loading state uses skeleton placeholders (pulsing gray rectangles) that match the layout of the actual cards. This is better than a simple spinner because it gives users a preview of the page structure and feels faster. We will dive deeper into loading states and error boundaries in Lesson 06.

### Step 10: Verify the Integration

Before moving on, verify that everything works:

1. Start the Course 03 API server: `cd course-03-api && npm start` (should run on port 3001)
2. Start the LaunchPad frontend: `npm run dev` (runs on port 3000)
3. Visit http://localhost:3000 and confirm startups load from the API
4. Click into a startup detail page and verify the data is correct
5. Visit the categories page and test category filtering
6. Open the browser dev tools Network tab and confirm you see requests going to localhost:3001
7. Check the browser console for the API logging we set up in Lesson 01

If you see CORS errors, make sure your Course 03 API has CORS enabled. You should have installed and configured the `cors` package in Course 03.

## Exercise

1. Create the `src/types/index.ts` file with all the TypeScript interfaces
2. Create the `src/lib/api.ts` file with all the API functions
3. Remove your mock data files from Course 02
4. Update your home page, startups listing page, startup detail page, and categories page to use the API functions
5. Verify that filtering and pagination work correctly through the API
6. Add a `getStartupsByCategory` convenience function to `api.ts` that wraps `getStartups` with a category parameter
7. Add proper TypeScript types to any components that were using the mock data types

## Key Takeaways

- A centralized API layer keeps HTTP logic out of your components and makes maintenance easier
- TypeScript interfaces should mirror your API response shapes exactly
- Deleting mock data files lets the TypeScript compiler find every location that needs updating
- Use `Promise.all` when you need to fetch multiple independent pieces of data in parallel
- In Next.js 15, both `params` and `searchParams` are Promises that must be awaited
- Loading states with skeleton placeholders provide a better user experience than spinners
- Keep your types in sync with your API, and your components will always know what data to expect

## Summary

In this lesson, we replaced all of LaunchPad's mock data with real API calls. We created a typed API layer in `src/lib/api.ts` that provides clean, typed functions for every endpoint. We updated every page to use these functions and handle the data flow correctly. Our frontend now talks to a real backend.

The foundation is in place: types define the contract, the API client handles the plumbing, and the API functions provide a clean interface for our components.

## What is Next

In the next lesson, we will explore React Server Components and how they change the way we think about data fetching. You will learn the difference between server and client components, how to use async components, and how Next.js streaming with Suspense creates a smooth loading experience.
