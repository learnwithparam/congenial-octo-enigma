# Build Your First Component

In this lesson you will build the first real UI component for LaunchPad: a StartupCard. Along the way you will learn how React components work, how TypeScript interfaces describe the shape of your data, and how Tailwind utility classes turn a plain div into a polished card with shadows, rounded corners, and hover effects.

## What You'll Learn

- What a React component is and how JSX works
- How to define TypeScript types and interfaces for props
- How to create a reusable StartupCard component
- How to style components with Tailwind CSS utility classes
- The difference between server components and client components
- How to render a list of cards on the homepage with hardcoded data

## Concepts

### React Components

A React component is a function that returns JSX -- a syntax that looks like HTML but lives inside JavaScript (or TypeScript). Each component is a self-contained piece of UI. You build an application by composing small components into larger ones.

Here is the simplest possible component:

```tsx
function Greeting() {
  return <h1>Hello, world</h1>;
}
```

The function name starts with an uppercase letter (this is required -- React uses the casing to distinguish components from regular HTML elements). The return value is JSX that describes what should appear on screen.

### JSX is not HTML

JSX looks like HTML but has a few differences:

- Use `className` instead of `class` (because `class` is a reserved word in JavaScript)
- Use `htmlFor` instead of `for` on label elements
- Self-closing tags must include the slash: `<img />`, `<br />`, `<input />`
- JavaScript expressions go inside curly braces: `<p>{name}</p>`
- Style objects use camelCase: `style={{ backgroundColor: "red" }}`

In practice, you will rarely use inline styles because Tailwind handles all of our styling through classes.

### Props and TypeScript Interfaces

Components accept inputs called "props" (short for properties). Props let you customize a component from the outside. For example, a StartupCard should receive the startup name, tagline, and other details as props.

In TypeScript, we describe the shape of props using a type or interface:

```tsx
type StartupCardProps = {
  name: string;
  tagline: string;
  category: string;
  upvotes: number;
};
```

The component then receives props as its first argument:

```tsx
function StartupCard({ name, tagline, category, upvotes }: StartupCardProps) {
  return (
    <div>
      <h2>{name}</h2>
      <p>{tagline}</p>
      <span>{category}</span>
      <span>{upvotes} upvotes</span>
    </div>
  );
}
```

This gives you autocomplete in your editor and compile-time errors if you pass the wrong type.

### Server Components vs Client Components

In Next.js 15 with the App Router, every component is a server component by default. Server components:

- Run only on the server
- Can directly access databases, file systems, and environment variables
- Send rendered HTML to the browser, not JavaScript
- Cannot use React hooks (useState, useEffect, etc.)
- Cannot use browser APIs (window, document, etc.)
- Cannot handle user interactions (onClick, onChange, etc.)

Client components opt in by adding `"use client"` at the top of the file. Client components:

- Run on both server (for initial render) and client (for interactivity)
- Can use hooks and browser APIs
- Can handle events like clicks and form submissions
- Add to the JavaScript bundle sent to the browser

The rule of thumb: keep components as server components unless they need interactivity. Our StartupCard will be a server component for now since it only displays data. Later, when we add an upvote button that responds to clicks, we will make that specific button a client component.

## Step by Step

### Step 1: Define the Startup Type

Before building the component, we need to define what a "startup" looks like in our type system. Create a types file:

```tsx
// src/types/index.ts

export type Startup = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  url: string;
  upvotes: number;
  createdAt: string;
  founder: string;
};

export type Category = {
  name: string;
  slug: string;
  description: string;
  count: number;
};
```

This `Startup` type is the single source of truth for startup data throughout our application. Every function, component, and API response that deals with startups will reference this type. If we ever add a field (say, `logo` or `funding`), we update it here and TypeScript will tell us everywhere that needs to handle the new field.

The `Category` type is simpler. It has a name, a URL-friendly slug, a short description, and a count of how many startups belong to it.

### Step 2: Create the StartupCard Component

Create a new file for the component:

```tsx
// src/components/StartupCard.tsx

import { Startup } from "@/types";

type StartupCardProps = {
  startup: Startup;
};

export function StartupCard({ startup }: StartupCardProps) {
  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
            {startup.name}
          </h3>
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
            {startup.tagline}
          </p>
        </div>
        <div className="ml-4 flex flex-col items-center rounded-lg border border-gray-200 px-3 py-2 text-center">
          <svg
            className="h-4 w-4 text-gray-400"
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
          <span className="text-sm font-semibold text-gray-700">
            {startup.upvotes}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
          {startup.category}
        </span>
        <span className="text-xs text-gray-400">
          by {startup.founder}
        </span>
      </div>
    </div>
  );
}
```

Let us break down every Tailwind class used on the outer `div`:

- `group` -- Enables group hover states so child elements can respond when the card is hovered
- `rounded-xl` -- Applies large border radius for rounded corners
- `border border-gray-200` -- A subtle light gray border
- `bg-white` -- White background
- `p-6` -- Padding of 1.5rem on all sides
- `shadow-sm` -- A small box shadow for depth
- `transition-all` -- Smooth transitions for all animatable properties
- `hover:shadow-md` -- On hover, the shadow grows slightly
- `hover:border-primary-300` -- On hover, the border shifts to our primary color

The heading uses `group-hover:text-primary-600` which means it changes color whenever the parent `group` element is hovered. This creates a cohesive hover effect across the entire card.

The `line-clamp-2` class on the tagline truncates long text to two lines with an ellipsis. This keeps cards at a consistent height regardless of tagline length.

The upvote section uses a small chevron-up SVG icon above the number. We keep this as a simple display for now; interactivity comes in a later lesson.

The category badge uses `bg-primary-50` for a very light green background with `text-primary-700` for darker green text, creating a pleasant badge appearance.

### Step 3: Create Hardcoded Sample Data

We need some data to test our component. For now, we will use hardcoded data directly in the page. In Lesson 04 we will move this to a proper mock data layer.

Update the homepage:

```tsx
// src/app/page.tsx

import { StartupCard } from "@/components/StartupCard";
import { Startup } from "@/types";

const sampleStartups: Startup[] = [
  {
    id: "1",
    name: "CodeCraft AI",
    slug: "codecraft-ai",
    tagline: "AI-powered code review that catches bugs before they ship",
    description: "CodeCraft AI uses machine learning to analyze pull requests and suggest improvements.",
    category: "Developer Tools",
    url: "https://codecraft.ai",
    upvotes: 142,
    createdAt: "2025-01-15",
    founder: "Sarah Chen",
  },
  {
    id: "2",
    name: "FinTrack",
    slug: "fintrack",
    tagline: "Personal finance dashboard that actually makes sense",
    description: "FinTrack connects to your accounts and provides clear, actionable insights.",
    category: "Fintech",
    url: "https://fintrack.io",
    upvotes: 89,
    createdAt: "2025-02-01",
    founder: "Marcus Johnson",
  },
  {
    id: "3",
    name: "LearnLoop",
    slug: "learnloop",
    tagline: "Spaced repetition meets AI tutoring for any subject",
    description: "LearnLoop adapts to your learning pace and optimizes review schedules.",
    category: "Education",
    url: "https://learnloop.com",
    upvotes: 215,
    createdAt: "2025-01-20",
    founder: "Priya Patel",
  },
  {
    id: "4",
    name: "ShipFast",
    slug: "shipfast",
    tagline: "Deploy full-stack apps in minutes, not days",
    description: "ShipFast provides production-ready templates with auth, payments, and more.",
    category: "SaaS",
    url: "https://shipfast.dev",
    upvotes: 176,
    createdAt: "2025-02-10",
    founder: "Alex Rivera",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            LaunchPad
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Discover and upvote the best new startups
          </p>
        </div>

        <div className="mt-12 grid gap-4">
          {sampleStartups.map((startup) => (
            <StartupCard key={startup.id} startup={startup} />
          ))}
        </div>
      </div>
    </main>
  );
}
```

Save both files and check your browser. You should see four startup cards displayed in a vertical list, each with a name, tagline, upvote count, category badge, and founder name.

### Step 4: Understand the Rendering Flow

Notice that our StartupCard component and the HomePage component do not have `"use client"` at the top. This means they are server components. Here is what happens when you visit the page:

1. The browser requests `/`
2. Next.js runs `HomePage` on the server
3. `HomePage` renders four `StartupCard` components
4. The resulting HTML is sent to the browser
5. No component JavaScript is sent -- these components do not need to run in the browser

If you open your browser's developer tools and look at the Network tab, you will see that the initial HTML response contains all four cards already rendered. There is no loading spinner, no flash of empty content. The page arrives fully formed.

This is the power of server components. For a read-only listing like this, there is no reason to send component code to the browser at all.

### Step 5: Add More Visual Polish

Let us enhance the StartupCard with a date display and improved layout. Update the component:

```tsx
// src/components/StartupCard.tsx

import { Startup } from "@/types";

type StartupCardProps = {
  startup: Startup;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function StartupCard({ startup }: StartupCardProps) {
  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-300">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors truncate">
              {startup.name}
            </h3>
            <span className="shrink-0 inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
              {startup.category}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
            {startup.tagline}
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
            <span>by {startup.founder}</span>
            <span>{formatDate(startup.createdAt)}</span>
          </div>
        </div>

        <div className="ml-4 flex shrink-0 flex-col items-center rounded-lg border border-gray-200 px-3 py-2 text-center hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer">
          <svg
            className="h-4 w-4 text-gray-400"
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
          <span className="text-sm font-semibold text-gray-700">
            {startup.upvotes}
          </span>
        </div>
      </div>
    </div>
  );
}
```

Changes in this version:

- The category badge moved up next to the name, saving vertical space
- A `formatDate` helper converts ISO date strings to a readable format like "Jan 15, 2025"
- The founder name and date appear together in a metadata row
- The upvote button area has its own hover state (`hover:border-primary-300 hover:bg-primary-50`) as a visual hint that it will be clickable
- `min-w-0` on the flex child prevents the name from overflowing, and `truncate` adds an ellipsis for very long names
- `shrink-0` on the badge and upvote section prevents them from being compressed by flexbox

### Step 6: Extract a Reusable Badge Component

The category badge pattern will appear in multiple places across the app. Let us extract it:

```tsx
// src/components/Badge.tsx

type BadgeProps = {
  children: React.ReactNode;
  variant?: "primary" | "gray";
};

export function Badge({ children, variant = "primary" }: BadgeProps) {
  const styles = {
    primary: "bg-primary-50 text-primary-700",
    gray: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
```

Now update StartupCard to use it:

```tsx
// At the top of src/components/StartupCard.tsx, add:
import { Badge } from "@/components/Badge";

// Then replace the category <span> with:
<Badge>{startup.category}</Badge>
```

This is a core pattern in React development: when you notice duplicated UI, extract it into a reusable component. The `Badge` component accepts a `variant` prop so we can use different color schemes in different contexts.

### Step 7: Render a Grid of Cards

Our current layout stacks cards vertically. Let us switch to a responsive grid. Update the homepage:

```tsx
// src/app/page.tsx
// Only the grid section changes -- the rest stays the same

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            LaunchPad
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Discover and upvote the best new startups
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {sampleStartups.map((startup) => (
            <StartupCard key={startup.id} startup={startup} />
          ))}
        </div>
      </div>
    </main>
  );
}
```

The grid changes:
- `grid gap-4` creates a grid with 1rem gaps
- `sm:grid-cols-2` switches to two columns on screens 640px and wider
- We increased `max-w` from `4xl` to `6xl` to give the two-column layout room
- Added responsive padding with `sm:px-6 lg:px-8`
- The heading scales up on larger screens with `sm:text-5xl`

## Try It Yourself

1. Add two more startups to the `sampleStartups` array. Give them different categories and upvote counts. Verify they appear in the grid.

2. Create a new variant for the Badge component. Add a "warning" variant that uses amber/yellow colors (`bg-amber-50 text-amber-700`). Use it somewhere to test.

3. Try adding `"use client"` to the top of `StartupCard.tsx`. The page will still work, but now the component JavaScript is sent to the browser. Check the Network tab in developer tools and compare the JavaScript bundle size. Then remove `"use client"` -- we want it to stay as a server component.

4. Try passing an incorrect prop type to StartupCard. For example, pass `upvotes` as a string instead of a number. Notice how TypeScript flags the error before you even save the file.

5. Experiment with different Tailwind classes on the card. Try `rounded-2xl` instead of `rounded-xl`, or `shadow-lg` instead of `shadow-sm`. See how small changes in utility classes can significantly change the visual feel.

## Key Takeaways

- React components are functions that return JSX. They are the building blocks of your UI.

- TypeScript types and interfaces describe the shape of your data. Define them early and share them across your application for consistency and safety.

- Props let you pass data into components. Destructuring props in the function signature keeps the code clean.

- Tailwind utility classes handle all styling. Classes like `rounded-xl`, `shadow-sm`, `hover:shadow-md`, and `transition-all` create polished UI without writing custom CSS.

- Server components are the default in Next.js 15. They render on the server and send zero JavaScript to the browser, which is ideal for display-only components.

- Extracting reusable components like Badge reduces duplication and makes your codebase easier to maintain.

- The `group` and `group-hover:` pattern in Tailwind lets child elements react to the hover state of a parent element.

## Next Steps

We have a working StartupCard and a grid of cards on the homepage. But every page in an app needs consistent navigation and layout. In the next lesson, we will build a Navbar and Footer, learn how Next.js layouts persist across page navigations, and create placeholder pages for the rest of our routes.
