# Detail Page

Every startup in LaunchPad deserves a page of its own. In this lesson you will learn how Next.js dynamic routes work, build a rich detail page for each startup, create your first truly interactive client component (an upvote button), and configure static generation so these pages are pre-rendered at build time for maximum performance.

## What You'll Learn

- How Next.js dynamic routes work with the `[slug]` folder convention
- How to build a detail page that fetches and displays a single startup
- How to handle missing pages with `notFound()`
- How to create a client component with local state (UpvoteButton)
- How to link listing cards to their detail pages
- How to use `generateStaticParams` for static site generation
- How to add breadcrumb navigation for better UX

## Concepts

### Dynamic Routes

In Next.js, routes are defined by the folder structure inside `app/`. A folder name wrapped in square brackets creates a dynamic segment:

```
app/startups/[slug]/page.tsx
```

This single file handles all URLs that match the pattern `/startups/*`:
- `/startups/codecraft-ai`
- `/startups/fintrack`
- `/startups/learnloop`
- Any other slug value

The dynamic segment value is passed to the page component as a param. If the URL is `/startups/codecraft-ai`, the `slug` param will be `"codecraft-ai"`.

Dynamic routes are the foundation of content-driven web applications. Blog posts, product pages, user profiles -- they all use this pattern.

### Static Generation with generateStaticParams

By default, dynamic route pages are rendered on demand (when a user visits them). But if you know all the possible values ahead of time, you can pre-render them at build time using `generateStaticParams`:

```tsx
export function generateStaticParams() {
  return [
    { slug: "codecraft-ai" },
    { slug: "fintrack" },
    { slug: "learnloop" },
  ];
}
```

Next.js calls this function at build time, generates a static HTML page for each returned value, and serves those pages instantly without any server processing. This is the fastest possible way to deliver a page.

For LaunchPad, we know all the startup slugs from our mock data, so we can statically generate every detail page.

### Client Components and Local State

Until now, all our components have been server components -- they render on the server and send static HTML to the browser. But an upvote button needs to respond to clicks, track whether the user has voted, and update a counter. This requires client-side JavaScript.

When you add `"use client"` to a component file, that component (and its children) become client components. They are still server-rendered for the initial page load, but the JavaScript is also sent to the browser for interactivity.

The key principle: make the smallest possible component a client component. The detail page itself stays as a server component. Only the UpvoteButton is a client component.

## Step by Step

### Step 1: Create the Dynamic Route Folder

Create the folder and page file for the startup detail route:

```
src/app/startups/[slug]/page.tsx
```

The square brackets in `[slug]` tell Next.js this is a dynamic segment. The name inside the brackets (`slug`) becomes the key used to access the param value.

### Step 2: Build the Detail Page

```tsx
// src/app/startups/[slug]/page.tsx

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStartupBySlug, getStartupSlugs, getStartupsByCategory } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { StartupCard } from "@/components/StartupCard";
import { UpvoteButton } from "@/components/UpvoteButton";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const startup = getStartupBySlug(slug);

  if (!startup) {
    return { title: "Startup Not Found | LaunchPad" };
  }

  return {
    title: `${startup.name} | LaunchPad`,
    description: startup.tagline,
  };
}

export function generateStaticParams() {
  const slugs = getStartupSlugs();
  return slugs.map((slug) => ({ slug }));
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function StartupDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const startup = getStartupBySlug(slug);

  if (!startup) {
    notFound();
  }

  const relatedStartups = getStartupsByCategory(startup.category)
    .filter((s) => s.id !== startup.id)
    .slice(0, 3);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-gray-500">
          <Link
            href="/"
            className="transition-colors hover:text-gray-900"
          >
            Home
          </Link>
          <span>/</span>
          <Link
            href="/startups"
            className="transition-colors hover:text-gray-900"
          >
            Startups
          </Link>
          <span>/</span>
          <span className="text-gray-900">{startup.name}</span>
        </nav>

        {/* Main Content */}
        <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {/* Header */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                  {startup.name}
                </h1>
                <Badge>{startup.category}</Badge>
              </div>
              <p className="mt-2 text-lg text-gray-600">
                {startup.tagline}
              </p>
            </div>
            <div className="shrink-0">
              <UpvoteButton initialCount={startup.upvotes} />
            </div>
          </div>

          {/* Divider */}
          <hr className="my-6 border-gray-100" />

          {/* Description */}
          <div className="prose prose-gray max-w-none">
            <h2 className="text-lg font-semibold text-gray-900">
              About {startup.name}
            </h2>
            <p className="mt-3 leading-7 text-gray-600">
              {startup.description}
            </p>
          </div>

          {/* Details Grid */}
          <div className="mt-8 grid gap-4 rounded-lg border border-gray-100 bg-gray-50 p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Founder
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {startup.founder}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Launched
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {formatFullDate(startup.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Website
              </p>
              <a
                href={startup.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                Visit website
              </a>
            </div>
          </div>
        </article>

        {/* Back Link */}
        <div className="mt-6">
          <Link
            href="/startups"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to all startups
          </Link>
        </div>

        {/* Related Startups */}
        {relatedStartups.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-gray-900">
              More in {startup.category}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Other startups you might like
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedStartups.map((related) => (
                <StartupCard key={related.id} startup={related} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
```

This is the most complex page we have built so far. Let us walk through each section.

The type definition for `PageProps` is important. In Next.js 15, params are delivered as a Promise that you need to await. This is a change from earlier versions where params were a plain object.

`generateMetadata` is an async function that Next.js calls to generate the page's `<title>` and `<meta>` tags. It receives the same params as the page component. We use the startup name and tagline for SEO-friendly metadata. If the startup is not found, we return a generic "not found" title.

`generateStaticParams` returns an array of all possible slug values. Next.js uses this at build time to pre-render a static HTML page for each startup. Our `getStartupSlugs()` function provides the list.

The page component itself follows a clear visual hierarchy:

1. Breadcrumb navigation at the top showing Home > Startups > Startup Name
2. The main content card with header, description, and details
3. A back link for quick navigation
4. Related startups from the same category

The `notFound()` function from `next/navigation` is called when no startup matches the slug. It triggers the nearest `not-found.tsx` file (or the default Next.js 404 page). This is the proper way to handle missing content -- do not render an error message manually.

The details grid uses `sm:grid-cols-3` to arrange founder, launch date, and website in three columns on tablet and above, collapsing to a single column on mobile.

The external website link uses a regular `<a>` tag (not Next.js `Link`) because it goes to an external domain. The `target="_blank"` and `rel="noopener noreferrer"` attributes ensure the link opens in a new tab securely.

### Step 3: Create the UpvoteButton Client Component

This is our first component with real interactivity. Create a new file:

```tsx
// src/components/UpvoteButton.tsx

"use client";

import { useState } from "react";

type UpvoteButtonProps = {
  initialCount: number;
};

export function UpvoteButton({ initialCount }: UpvoteButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [hasVoted, setHasVoted] = useState(false);

  function handleClick() {
    if (hasVoted) {
      setCount(count - 1);
      setHasVoted(false);
    } else {
      setCount(count + 1);
      setHasVoted(true);
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`flex flex-col items-center rounded-xl border-2 px-5 py-3 text-center transition-all ${
        hasVoted
          ? "border-primary-500 bg-primary-50 text-primary-600"
          : "border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:bg-primary-50"
      }`}
    >
      <svg
        className={`h-5 w-5 transition-colors ${
          hasVoted ? "text-primary-500" : "text-gray-400"
        }`}
        fill={hasVoted ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
      <span className="mt-1 text-lg font-bold">{count}</span>
      <span className="text-xs">
        {hasVoted ? "Voted" : "Upvote"}
      </span>
    </button>
  );
}
```

Let us examine every detail of this component:

The `"use client"` directive at the top of the file is required because we use `useState`, a React hook. Hooks only work in client components.

The component has two pieces of state:
- `count` -- The current upvote count, initialized from the server-rendered value
- `hasVoted` -- Whether the current user has voted, starting as `false`

The `handleClick` function toggles the vote. If the user has already voted, clicking removes the vote (decrements count). Otherwise, it adds a vote (increments count). This toggle behavior is common in social platforms.

The styling uses conditional classes. When `hasVoted` is true:
- The border changes to our primary color (`border-primary-500`)
- The background becomes a light primary tint (`bg-primary-50`)
- The text turns primary colored
- The chevron SVG is filled instead of outlined (`fill="currentColor"` vs `fill="none"`)
- The label changes from "Upvote" to "Voted"

When `hasVoted` is false, the button shows a neutral gray style with hover effects that hint at the primary color.

This is local state only. Refreshing the page resets the vote. In a later course module, we will persist votes to a database and associate them with user accounts. But the component interface will not change -- we will just add an API call inside `handleClick`.

### Step 4: Understand the Server/Client Boundary

Let us look at how server and client components interact on this page:

```
StartupDetailPage (server)
  Breadcrumb links (server -- static HTML)
  Startup name, tagline (server -- static HTML)
  Badge (server)
  UpvoteButton (client -- interactive)
  Description (server -- static HTML)
  Details grid (server -- static HTML)
  Back link (server -- static HTML)
  StartupCard (server) x3 -- related startups
```

Only the UpvoteButton is a client component. Everything else renders on the server and ships as HTML. The UpvoteButton receives its initial count as a prop from the server component. During the initial page load:

1. The server renders the entire page, including the UpvoteButton with its initial count
2. The HTML is sent to the browser -- the user sees the full page immediately
3. React "hydrates" the UpvoteButton, attaching the click handler
4. The button is now interactive

This hydration step is why the initial count comes from a prop (`initialCount`). The server renders the button with the correct number, and when React takes over on the client, it initializes `useState` with that same number.

### Step 5: Create a Not Found Page

When someone visits `/startups/nonexistent-slug`, our page calls `notFound()`. Let us create a custom 404 page for the startups section:

```tsx
// src/app/startups/[slug]/not-found.tsx

import Link from "next/link";

export default function StartupNotFound() {
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-6xl font-bold text-gray-200">404</p>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Startup not found
          </h1>
          <p className="mt-2 text-gray-600">
            The startup you are looking for does not exist or may have been removed.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/startups"
              className="rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
            >
              Browse all startups
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

This custom 404 page is scoped to the `[slug]` route. When `notFound()` is called from the detail page, Next.js renders this component instead of the default 404. The design matches our application style with helpful navigation links.

### Step 6: Verify the Link from Cards to Detail Pages

In Lesson 05, we updated the StartupCard to wrap the entire card in a `Link` component pointing to `/startups/{slug}`. Let us verify this works end-to-end:

1. Go to the homepage at `http://localhost:3000`
2. Click on any startup card in the "Trending Now" or "Recently Added" sections
3. You should land on the detail page with the full startup information
4. Click the "Back to all startups" link to return to the listing
5. Try the breadcrumb links -- "Home" and "Startups" should both work

If you click a card and get a 404, double-check that:
- The `slug` in `startups.json` matches the URL pattern
- The `[slug]` folder exists at `src/app/startups/[slug]/`
- The `page.tsx` file is inside that folder

### Step 7: Test the Upvote Button

On any detail page, interact with the upvote button:

1. The button shows the initial upvote count with a gray border and "Upvote" label
2. Click the button -- the count increases by 1, the button turns green, and the label changes to "Voted"
3. Click again -- the count decreases by 1, the button returns to gray, and the label changes back to "Upvote"
4. Refresh the page -- the count resets to the original value (local state does not persist)

This toggle behavior is intentional. Users should be able to undo an accidental vote.

### Step 8: Test Static Generation

Run the production build to see static generation in action:

```bash
npm run build
```

In the build output, look for the startups routes:

```
Route (app)                              Size     First Load JS
┌ ○ /                                    5.8 kB         93 kB
├ ○ /categories                          2.1 kB         89 kB
├ ○ /startups                            3.4 kB         91 kB
├ ● /startups/[slug]                     4.2 kB         92 kB
├   ├ /startups/codecraft-ai
├   ├ /startups/fintrack
├   ├ /startups/learnloop
├   └ [+9 more paths]
```

The `●` symbol next to `/startups/[slug]` indicates static site generation (SSG). Next.js called `generateStaticParams`, got back 12 slugs, and pre-rendered an HTML page for each one.

These pages load instantly in production because the server does not need to do any work -- it just serves a pre-built HTML file. The UpvoteButton hydrates on the client to add interactivity, but the rest of the page is static.

### Step 9: Add generateMetadata Details

Let us look more closely at how `generateMetadata` works. When a user shares a LaunchPad startup on social media, the shared link will display:

- Title: "CodeCraft AI | LaunchPad"
- Description: "AI-powered code review that catches bugs before they ship"

This metadata is also used by search engines for ranking and display. Each dynamic page gets its own metadata generated from the actual startup data, which is much better for SEO than a generic title.

You can extend `generateMetadata` to include Open Graph tags for richer social media previews:

```tsx
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const startup = getStartupBySlug(slug);

  if (!startup) {
    return { title: "Startup Not Found | LaunchPad" };
  }

  return {
    title: `${startup.name} | LaunchPad`,
    description: startup.tagline,
    openGraph: {
      title: startup.name,
      description: startup.tagline,
      type: "website",
    },
  };
}
```

The `openGraph` field generates `<meta property="og:title">` and `<meta property="og:description">` tags that platforms like Twitter, Facebook, and LinkedIn use for link previews.

## Try It Yourself

1. Add a "Share" button next to the upvote button that copies the current page URL to the clipboard. You will need a new client component. Hint: use `navigator.clipboard.writeText(window.location.href)` and show a "Copied!" confirmation.

2. Create a `not-found.tsx` at the app level (`src/app/not-found.tsx`) for a global 404 page. Visit a completely invalid URL like `/this-does-not-exist` and verify your custom page appears.

3. Add more information to the detail page. Create a "Tags" section below the description that displays the category and a few related keywords. Use the Badge component with different variants.

4. Try removing `generateStaticParams` from the detail page and running `npm run build` again. Compare the build output. Without it, the pages will not be statically generated -- they will render on demand instead.

5. Enhance the UpvoteButton with an animation. Add `transform active:scale-95` to the button classes to create a brief press effect when clicked. Try `transition-transform` for a smooth animation.

6. Build a simple breadcrumb component that can be reused. It should accept an array of `{ label: string; href?: string }` objects and render them with "/" separators. The last item should not be a link.

## Key Takeaways

- Dynamic routes use the `[param]` folder convention. A file at `app/startups/[slug]/page.tsx` handles all `/startups/*` URLs.

- In Next.js 15, params are a Promise that must be awaited before use.

- `notFound()` from `next/navigation` triggers the nearest `not-found.tsx` page. Use it when data is not found instead of rendering error messages manually.

- `generateStaticParams` tells Next.js which dynamic routes to pre-render at build time. This produces static HTML pages that load instantly.

- `generateMetadata` creates dynamic `<title>` and `<meta>` tags for each page, improving SEO and social media previews.

- Client components (`"use client"`) should be as small as possible. The UpvoteButton is a client component, but the rest of the detail page remains a server component.

- `useState` provides local component state that resets on page refresh. Persistent state requires a database or localStorage, which we will add in a later course module.

- Breadcrumb navigation improves UX by showing users where they are in the site hierarchy and providing quick links back to parent pages.

- Related content sections (like "More in this category") increase engagement by giving users paths to explore.

## Next Steps

Congratulations -- you have built a complete page flow from listing to detail. Users can browse startups on the homepage, view all startups in a grid, click through to detail pages, and interact with the upvote button.

In the next lesson, we will add search and filtering to the startups page so users can find exactly what they are looking for. You will learn about URL search params, form handling, and building filter UI components.
