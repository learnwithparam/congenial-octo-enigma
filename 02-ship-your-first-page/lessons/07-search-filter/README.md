# Search and Filter

Every good directory app needs search and filtering. Right now, our LaunchPad startups page shows every startup in a flat list. That is fine when you have 6 entries, but imagine 600. Users need to quickly find what they are looking for. In this lesson you will build a search bar, a category filter bar, and wire them together using URL search params so the filtered state is shareable and bookmarkable.

## What You Will Learn

- How to build controlled input components in React
- Using Next.js `useSearchParams` and `useRouter` to manage URL state
- Implementing debounced search to avoid excessive re-renders
- Creating a category filter bar with pill-style buttons
- Adding a `searchStartups` helper to the mock API layer
- Displaying results count and a friendly "no results" state

## Concepts

### URL Search Params as State

Many developers reach for `useState` for everything. But search and filter state is a great candidate for URL search params. When you put the query and category into the URL like `/startups?q=ai&category=developer-tools`, users can share that exact filtered view with someone else. They can also use the browser back button to return to their previous search.

Next.js gives us two hooks for working with the URL:
- `useSearchParams()` reads the current query string parameters
- `useRouter()` lets us push new URLs (and therefore new param values)

### Debouncing

If you fire a search on every single keystroke, you create unnecessary work. Debouncing means waiting until the user stops typing for a short period (say 300ms) before actually running the search. This gives a smoother experience and, once you connect to a real API later, reduces network requests.

### Controlled Inputs

A controlled input is one where React owns the value. You pass a `value` prop and an `onChange` handler. This gives you full control to validate, transform, or debounce the input before taking action.

## Step by Step

### Step 1: Add the Search Function to the Mock API

Open `src/lib/api.ts`. You already have `getStartups`, `getStartupBySlug`, `getCategories`, and `getStartupsByCategory`. Add a new function that filters by both a text query and a category.

```ts
// src/lib/api.ts — add this function at the bottom of the file

export async function searchStartups(
  query: string = '',
  category: string = ''
): Promise<Startup[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  let results = startups;

  if (category) {
    results = results.filter((s) => s.category === category);
  }

  if (query) {
    const lowerQuery = query.toLowerCase();
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.tagline.toLowerCase().includes(lowerQuery) ||
        s.description.toLowerCase().includes(lowerQuery)
    );
  }

  return results;
}
```

This function accepts an optional query string and an optional category slug. It filters the in-memory startups array and returns matching results. The `await` with `setTimeout` simulates a network call so we can test loading states later.

### Step 2: Create the SearchBar Component

Create a new file at `src/components/SearchBar.tsx`. This is a client component because it uses browser APIs and React hooks.

```tsx
// src/components/SearchBar.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';

interface SearchBarProps {
  defaultValue: string;
  onSearch: (query: string) => void;
}

export default function SearchBar({ defaultValue, onSearch }: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);

  // Debounce: wait 300ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search startups..."
        className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
```

Let us walk through what is happening:

1. The component receives a `defaultValue` (from the URL param) and an `onSearch` callback.
2. Local state (`value`) tracks the input. This makes it a controlled input.
3. A `useEffect` sets a 300ms timer each time `value` changes. If `value` changes again before the timer fires, the cleanup function clears the old timer. This is the debounce.
4. A search icon sits on the left using absolute positioning.
5. A clear button appears on the right when there is text in the input.

### Step 3: Create the FilterBar Component

Create `src/components/FilterBar.tsx`. This renders a row of pill buttons, one for each category plus an "All" option.

```tsx
// src/components/FilterBar.tsx
'use client';

import { Category } from '@/types';

interface FilterBarProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function FilterBar({
  categories,
  activeCategory,
  onCategoryChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onCategoryChange('')}
        className={
          activeCategory === ''
            ? 'rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white'
            : 'rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200'
        }
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => onCategoryChange(cat.slug)}
          className={
            activeCategory === cat.slug
              ? 'rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white'
              : 'rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200'
          }
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
```

The active pill gets the indigo background; inactive pills get a subtle gray. When clicked, `onCategoryChange` fires with either an empty string (for "All") or the category slug.

### Step 4: Build the Search and Filter Wrapper

Now we need a component that combines the search bar and filter bar and manages the URL state. Create `src/components/StartupSearch.tsx`.

```tsx
// src/components/StartupSearch.tsx
'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import SearchBar from '@/components/SearchBar';
import FilterBar from '@/components/FilterBar';
import StartupList from '@/components/StartupList';
import { searchStartups } from '@/lib/api';
import { Category, Startup } from '@/types';

interface StartupSearchProps {
  categories: Category[];
  initialStartups: Startup[];
}

export default function StartupSearch({
  categories,
  initialStartups,
}: StartupSearchProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentQuery = searchParams.get('q') || '';
  const currentCategory = searchParams.get('category') || '';

  const [startups, setStartups] = useState<Startup[]>(initialStartups);
  const [isSearching, setIsSearching] = useState(false);
  const [resultsCount, setResultsCount] = useState(initialStartups.length);

  // Update the URL params without a full page reload
  const updateParams = useCallback(
    (query: string, category: string) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (category) params.set('category', category);

      const paramString = params.toString();
      const newUrl = paramString ? pathname + '?' + paramString : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router]
  );

  // Fetch filtered results whenever URL params change
  useEffect(() => {
    let cancelled = false;

    async function fetchResults() {
      setIsSearching(true);
      const results = await searchStartups(currentQuery, currentCategory);
      if (!cancelled) {
        setStartups(results);
        setResultsCount(results.length);
        setIsSearching(false);
      }
    }

    // Only fetch if there are actual filter params
    if (currentQuery || currentCategory) {
      fetchResults();
    } else {
      setStartups(initialStartups);
      setResultsCount(initialStartups.length);
    }

    return () => {
      cancelled = true;
    };
  }, [currentQuery, currentCategory, initialStartups]);

  const handleSearch = useCallback(
    (query: string) => {
      updateParams(query, currentCategory);
    },
    [currentCategory, updateParams]
  );

  const handleCategoryChange = useCallback(
    (category: string) => {
      updateParams(currentQuery, category);
    },
    [currentQuery, updateParams]
  );

  return (
    <div className="space-y-6">
      <SearchBar defaultValue={currentQuery} onSearch={handleSearch} />
      <FilterBar
        categories={categories}
        activeCategory={currentCategory}
        onCategoryChange={handleCategoryChange}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {resultsCount} {resultsCount === 1 ? 'startup' : 'startups'} found
        </p>
        {isSearching && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
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
            Searching...
          </div>
        )}
      </div>

      {startups.length > 0 ? (
        <StartupList startups={startups} />
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No startups found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or filter to find what you are looking for.
          </p>
        </div>
      )}
    </div>
  );
}
```

There is a lot going on here, so let us break it down:

1. We read `q` and `category` from the URL search params. These are our source of truth.
2. `updateParams` constructs a new URL and pushes it with `router.push`. The `{ scroll: false }` option prevents the page from jumping to the top.
3. A `useEffect` watches the URL params and calls `searchStartups` whenever they change. The `cancelled` flag prevents state updates if the component unmounts or a newer request starts.
4. We show a results count ("6 startups found") and a spinner while searching.
5. When no results match, we show a friendly empty state with a dashed border and a suggestion to adjust filters.

### Step 5: Update the Startups Listing Page

Now update `src/app/startups/page.tsx` to use the new `StartupSearch` component. The page itself remains a server component that fetches the initial data and passes it down.

```tsx
// src/app/startups/page.tsx
import { Suspense } from 'react';
import { getStartups, getCategories } from '@/lib/api';
import StartupSearch from '@/components/StartupSearch';

export const metadata = {
  title: 'Browse Startups | LaunchPad',
  description: 'Discover and explore the latest startups on LaunchPad.',
};

export default async function StartupsPage() {
  const [startups, categories] = await Promise.all([
    getStartups(),
    getCategories(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">
        Browse Startups
      </h1>
      <Suspense fallback={<div>Loading...</div>}>
        <StartupSearch
          categories={categories}
          initialStartups={startups}
        />
      </Suspense>
    </div>
  );
}
```

Notice the `<Suspense>` boundary wrapping `StartupSearch`. This is required because `useSearchParams()` needs a Suspense boundary in Next.js 15. Without it, you will see a build-time warning or error.

The server component fetches all startups and categories on the server, then hands them to the client component. The client component handles the interactive filtering.

### Step 6: Test the Full Flow

Start your dev server and navigate to `/startups`.

```bash
npm run dev
```

Here is what you should see and test:

1. The search bar appears at the top. Type something like "ai" and wait 300ms. The URL updates to `/startups?q=ai` and the list filters down.
2. Click a category pill like "Developer Tools". The URL updates to `/startups?category=developer-tools`. Only startups in that category appear.
3. Combine both: type "ai" and also select a category. The URL shows both params.
4. Click "All" to clear the category filter. Clear the search text to remove the query filter.
5. Copy the URL with filters applied and open it in a new tab. The same filtered results should appear.
6. If nothing matches, the "No startups found" empty state should display.
7. Press the browser back button. You should return to your previous filter state.

### Step 7: Refine the Debounce with useCallback

You may have noticed we wrapped `handleSearch` and `handleCategoryChange` in `useCallback`. This is important because `SearchBar` receives `onSearch` as a prop and uses it inside a `useEffect` dependency array. If `onSearch` changed identity on every render, the effect would re-run unnecessarily, causing an infinite loop.

Here is the rule of thumb: when you pass a function as a prop to a child component that uses it in a `useEffect`, wrap that function in `useCallback`.

### Step 8: Optional Enhancement — Highlight Matching Text

For a nice touch, you can highlight the search query within the results. Create a small utility component:

```tsx
// src/components/HighlightText.tsx
interface HighlightTextProps {
  text: string;
  query: string;
}

export default function HighlightText({ text, query }: HighlightTextProps) {
  if (!query) return <>{text}</>;

  const regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 px-0.5 rounded">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
```

You can then use `<HighlightText text={startup.tagline} query={currentQuery} />` inside your `StartupCard` by passing the query down.

## Try It Yourself

1. Add a "Sort By" dropdown next to the search bar. Support sorting by name (A-Z), newest first, and most upvotes. Add a `sort` param to the URL and implement the sorting logic in the API function.

2. Add a "clear all filters" button that only appears when at least one filter is active. Clicking it should reset both the search query and the category.

3. Try removing the debounce (set the timer to 0ms) and notice how the experience feels different. Then try a longer debounce like 1000ms. Find a duration that feels right to you.

## Key Takeaways

- URL search params are a great place to store filter and search state because the URL becomes shareable and bookmarkable.
- Debouncing prevents excessive work by waiting for the user to pause before firing the search.
- Controlled inputs let React manage the value, giving you the ability to transform or delay updates.
- Always show users how many results they got and provide a clear empty state when nothing matches.
- Wrap the `useSearchParams` consumer in a `<Suspense>` boundary in Next.js 15.
- Use `useCallback` to stabilize function references that are passed as props and used in dependency arrays.

## Next Steps

Your startups listing is interactive now, but there is no way for users to add their own startups. In the next lesson, you will build a full submission form with client-side validation, learning about controlled components, error messages, and form handling patterns in React 19.
