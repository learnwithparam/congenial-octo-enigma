# Listing Cards

With our mock data layer in place, it is time to build the real listing experience. In this lesson you will refactor the StartupCard to work with live data from the API, create a reusable StartupList component, build a hero section for the homepage, and set up a responsive grid that looks polished on mobile, tablet, and desktop screens.

## What You'll Learn

- How to refactor components to work with data from the mock API layer
- How to build a reusable list component that renders a grid of cards
- How to create a hero section with a call-to-action
- How to build responsive grid layouts with Tailwind (1, 2, and 3 columns)
- How to add category badges, upvote counts, and founder info to cards
- How to create a featured section that highlights top startups

## Concepts

### Component Composition

React applications are built by composing components -- small, focused pieces of UI that combine to form larger views. In this lesson we will layer components like this:

```
HomePage
  HeroSection
  StartupList (featured)
    StartupCard
    StartupCard
    StartupCard

StartupsPage
  StartupList (all)
    StartupCard
    StartupCard
    ... (12 cards)
```

Each component has a single responsibility. `StartupCard` renders one card. `StartupList` renders a grid of cards. `HeroSection` renders the banner. The page components assemble these building blocks.

### Responsive Design with Tailwind

Tailwind uses mobile-first responsive design. You write styles for the smallest screen, then add breakpoint prefixes for larger screens:

- No prefix: applies at all screen widths (mobile first)
- `sm:` applies at 640px and above (tablet)
- `md:` applies at 768px and above
- `lg:` applies at 1024px and above (desktop)
- `xl:` applies at 1280px and above

For a card grid, the typical pattern is:

```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
```

This gives you 1 column on mobile, 2 on tablet, and 3 on desktop. The grid handles spacing and alignment automatically.

### Empty States

Good UI handles edge cases gracefully. What happens when a list has no items? An empty state component tells the user what to expect and often includes a call to action. We will add empty state handling to our lists.

## Step by Step

### Step 1: Refactor the StartupCard

Our StartupCard from Lesson 02 works well, but let us finalize it with all the information we want to display. Update the component:

```tsx
// src/components/StartupCard.tsx

import Link from "next/link";
import { Startup } from "@/types";
import { Badge } from "@/components/Badge";

type StartupCardProps = {
  startup: Startup;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function StartupCard({ startup }: StartupCardProps) {
  return (
    <Link
      href={`/startups/${startup.slug}`}
      className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-primary-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
            {startup.name}
          </h3>
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">
            {startup.tagline}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-center group-hover:border-primary-200 group-hover:bg-primary-50 transition-colors">
          <svg
            className="h-3.5 w-3.5 text-gray-400 group-hover:text-primary-500 transition-colors"
            fill="none"
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
          <span className="text-xs font-bold text-gray-600 group-hover:text-primary-600 transition-colors">
            {startup.upvotes}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Badge>{startup.category}</Badge>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{startup.founder}</span>
          <span>{formatDate(startup.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
```

Key changes from the previous version:

1. The entire card is now wrapped in a `Link` component. Clicking anywhere on the card navigates to the startup's detail page at `/startups/{slug}`. We will build that page in the next lesson.

2. The card uses `flex flex-col` to create a vertical layout with the main content at the top and the metadata row at the bottom. This ensures a consistent card height when cards are in a grid.

3. The upvote display section now has `group-hover:` styles on every element, so the entire card feels interactive on hover.

4. We use `text-base` instead of `text-lg` for the name to keep cards compact in a grid layout.

5. The `formatDate` function now shows only month and day (no year) to save space on cards.

### Step 2: Build the StartupList Component

Create a reusable list component that handles the grid layout and empty state:

```tsx
// src/components/StartupList.tsx

import { Startup } from "@/types";
import { StartupCard } from "@/components/StartupCard";

type StartupListProps = {
  startups: Startup[];
  emptyMessage?: string;
};

export function StartupList({
  startups,
  emptyMessage = "No startups found",
}: StartupListProps) {
  if (startups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="mt-4 text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {startups.map((startup) => (
        <StartupCard key={startup.id} startup={startup} />
      ))}
    </div>
  );
}
```

The StartupList component handles two cases:

1. When there are startups to show, it renders them in a responsive grid: 1 column on mobile, 2 on tablet (640px+), 3 on desktop (1024px+).

2. When the array is empty, it shows a friendly empty state with an icon and a customizable message. The dashed border and centered layout make it clear this is a placeholder, not a bug.

The `emptyMessage` prop has a default value so callers do not need to specify it every time.

### Step 3: Build the Hero Section

Create a hero section component for the homepage:

```tsx
// src/components/HeroSection.tsx

import Link from "next/link";

export function HeroSection() {
  return (
    <section className="bg-white border-b border-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Discover the Next
            <span className="block text-primary-500">Big Thing</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            LaunchPad is where founders showcase their startups and the community
            decides what rises to the top. Browse, upvote, and find your next
            favorite product.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/startups"
              className="rounded-lg bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
            >
              Browse Startups
            </Link>
            <Link
              href="/submit"
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Submit Yours
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
```

The hero section has several design choices worth noting:

- The heading uses a two-line layout. "Discover the Next" is in dark gray, and "Big Thing" drops to the next line in our primary green color. The `block` class forces the span to a new line.

- The heading scales across breakpoints: `text-4xl` on mobile, `text-5xl` on tablet, `text-6xl` on desktop. This ensures the text feels proportional to the screen.

- Two call-to-action buttons sit side by side. The primary button ("Browse Startups") uses a solid green background. The secondary button ("Submit Yours") uses a white background with a gray border. This visual hierarchy guides the user toward the primary action.

- Generous vertical padding (`py-20 sm:py-28`) gives the hero breathing room and makes it feel like a landing page banner.

- The section has a white background and a subtle bottom border (`border-b border-gray-100`) to separate it from the gray content area below.

### Step 4: Build the Complete Homepage

Now assemble all the pieces into the homepage:

```tsx
// src/app/page.tsx

import Link from "next/link";
import { getFeaturedStartups, getStartups } from "@/lib/api";
import { HeroSection } from "@/components/HeroSection";
import { StartupList } from "@/components/StartupList";

export default function HomePage() {
  const featured = getFeaturedStartups(3);
  const recent = getStartups().slice(0, 6);

  return (
    <div>
      <HeroSection />

      <div className="bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Featured Section */}
          <section>
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Trending Now
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  The most upvoted startups this month
                </p>
              </div>
              <Link
                href="/startups"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="mt-6">
              <StartupList startups={featured} />
            </div>
          </section>

          {/* Recent Section */}
          <section className="mt-16">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Recently Added
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  The newest startups on LaunchPad
                </p>
              </div>
              <Link
                href="/startups"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="mt-6">
              <StartupList startups={recent} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
```

The homepage now has three distinct sections:

1. The hero section with the heading and call-to-action buttons
2. A "Trending Now" section showing the top 3 startups by upvotes
3. A "Recently Added" section showing the 6 newest startups

Each section has a header with a title, subtitle, and a "View all" link that goes to the full startups listing. This gives users quick access to the most interesting content while providing a path to see everything.

The `recent` variable takes the first 6 items from `getStartups()` (which already sorts by date, newest first). We use `.slice(0, 6)` rather than creating a separate API function because slicing a sorted array is straightforward and the intent is clear.

### Step 5: Update the Startups Listing Page

Now update the full startups listing to use the StartupList component:

```tsx
// src/app/startups/page.tsx

import type { Metadata } from "next";
import { getStartups } from "@/lib/api";
import { StartupList } from "@/components/StartupList";

export const metadata: Metadata = {
  title: "All Startups | LaunchPad",
  description: "Browse all startups on LaunchPad",
};

export default function StartupsPage() {
  const startups = getStartups();

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            All Startups
          </h1>
          <p className="mt-2 text-gray-600">
            Discover the latest startups and vote for your favorites
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {startups.length} startups listed
          </p>
        </div>

        <StartupList startups={startups} />
      </div>
    </div>
  );
}
```

This page is remarkably simple now. The data fetching is one line, the rendering is one component. All the grid logic, card rendering, and empty state handling live inside `StartupList` and `StartupCard`.

### Step 6: Add Stats to the Categories Page

Update the categories page to show startup counts and use data from the API:

```tsx
// src/app/categories/page.tsx

import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getStartupsByCategory } from "@/lib/api";
import { Badge } from "@/components/Badge";

export const metadata: Metadata = {
  title: "Categories | LaunchPad",
  description: "Browse startups by category",
};

export default function CategoriesPage() {
  const categories = getCategories();

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Categories
          </h1>
          <p className="mt-2 text-gray-600">
            Browse startups by category
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const categoryStartups = getStartupsByCategory(category.name);
            const topStartup = categoryStartups[0];

            return (
              <div
                key={category.slug}
                className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:shadow-md hover:border-primary-300"
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                    {category.name}
                  </h2>
                  <Badge variant="gray">
                    {category.count}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {category.description}
                </p>
                {topStartup && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-400">Top startup</p>
                    <Link
                      href={`/startups/${topStartup.slug}`}
                      className="mt-1 block text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
                    >
                      {topStartup.name}
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

Each category card now shows:
- The category name and description
- A count badge showing how many startups belong to the category
- The top startup in that category (the most recent one), linked to its detail page

The `getStartupsByCategory` call runs on the server for each category. Since this is mock data, performance is not a concern. With a real database, you would optimize this query.

### Step 7: Verify the Responsive Layout

Open your browser and test the layout at different widths. You can use the browser's responsive design mode (usually accessible via the developer tools):

At 375px (mobile):
- Cards stack in a single column
- The hero text is smaller but still readable
- Navigation links are hidden (just the logo and submit button show)

At 768px (tablet):
- Cards display in a 2-column grid
- The hero text grows to `text-5xl`
- Navigation links appear

At 1280px (desktop):
- Cards display in a 3-column grid
- The hero text reaches `text-6xl`
- The layout has comfortable margins on both sides

The responsive behavior comes entirely from the Tailwind breakpoint prefixes we applied. No media queries, no CSS files, no JavaScript -- just utility classes.

### Step 8: Final Component Tree

Here is the complete component tree for the homepage after this lesson:

```
RootLayout (server)
  Navbar (server)
    NavLink (client) x3
  HomePage (server)
    HeroSection (server)
    StartupList (server)
      StartupCard (server) x3    -- featured
    StartupList (server)
      StartupCard (server) x6    -- recent
  Footer (server)
```

Out of all these components, only the three NavLink instances are client components. Everything else -- the hero, the cards, the grid, the data fetching -- is server-rendered HTML. This means the page loads fast and ships minimal JavaScript.

## Try It Yourself

1. Change the featured count from 3 to 6 and see how the grid adjusts. Then change it to 1 and observe the single card filling the grid.

2. Add a "Categories" section to the homepage between the featured and recent sections. Show category cards in a horizontal row using `flex overflow-x-auto gap-4` to create a scrollable row.

3. In the StartupList component, add a `columns` prop that lets the caller choose between 2-column and 3-column grids. The default should be 3. Hint: conditionally apply `lg:grid-cols-2` or `lg:grid-cols-3` based on the prop.

4. Create a `StartupCardCompact` variant that shows only the name, upvote count, and category. Use it for a sidebar or a "quick picks" section.

5. Test the empty state by temporarily making `getStartups()` return an empty array. Verify that the empty state message appears correctly on both the homepage and the startups page.

## Key Takeaways

- Component composition means building pages from small, focused components. Each component has one job and does it well.

- The StartupList component encapsulates the grid layout and empty state, so every page that shows a list of startups gets consistent behavior.

- Responsive grids in Tailwind use mobile-first breakpoints: `grid-cols-1` (default), `sm:grid-cols-2`, `lg:grid-cols-3`. No custom CSS or media queries needed.

- A hero section with strong typography and clear calls to action sets the tone for the entire application.

- Server components handle all the data fetching and rendering. Only interactive elements (like NavLink) need to be client components.

- Wrapping the entire StartupCard in a Link component makes the whole card clickable, which is both more accessible and more user-friendly than a small "Read more" link.

- Empty states are not an afterthought. Handle them in your list components from the start to ensure every page state looks intentional.

## Next Steps

Our listing pages look polished and pull data from the mock API. But when users click on a startup card, nothing happens yet because we have not created the detail page. In the next lesson, we will build dynamic routes with the `[slug]` pattern, create the startup detail page, add an interactive upvote button (our first real client component), and generate static params for build-time rendering.
