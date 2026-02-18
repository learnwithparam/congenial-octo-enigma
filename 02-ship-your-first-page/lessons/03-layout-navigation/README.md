# Layout and Navigation

Every multi-page application needs consistent navigation. Users expect a header at the top, links to key sections, and a footer at the bottom -- all persisting as they move between pages. In this lesson you will build the navigation shell for LaunchPad using Next.js layouts, create a Navbar and Footer, and set up placeholder pages so the links actually go somewhere.

## What You'll Learn

- How Next.js layouts work and why they persist across navigations
- How to build a responsive Navbar component with logo and navigation links
- How to build a Footer component
- How to wire layouts into the root `layout.tsx`
- How to create placeholder pages for the Startups and Categories routes
- How to use the Next.js `Link` component for client-side navigation
- How to make a sticky header with Tailwind CSS

## Concepts

### What is a Layout?

In Next.js, a layout is a component that wraps one or more pages. The key behavior that makes layouts special: they do not re-mount when you navigate between pages that share the same layout. The layout stays in place while only the page content swaps out.

This gives you two important benefits:

1. Performance -- The navbar, footer, and any shared UI do not re-render on every navigation. React only updates the part of the tree that changed.

2. State preservation -- If your layout contains state (like a search bar with typed text, or an open mobile menu), that state survives navigation. The user does not lose their context.

The root layout at `src/app/layout.tsx` wraps every page in your application. You can also create nested layouts for specific route segments. For example, `src/app/startups/layout.tsx` would wrap only pages under `/startups/`.

### The Next.js Link Component

Next.js provides a `Link` component that enables client-side navigation. Instead of a full page reload (which is what a regular `<a>` tag does), `Link` intercepts the click, fetches only the new page data, and swaps the content client-side.

```tsx
import Link from "next/link";

<Link href="/startups">Startups</Link>
```

Key things to know about Link:

- It renders as a regular `<a>` tag in the HTML, so accessibility and SEO are preserved
- It prefetches linked pages in the background (for static routes), making navigation feel instant
- It supports the `className` prop for styling
- It supports an `href` prop that can be a string or a URL object

Always use `Link` instead of `<a>` for internal navigation. Use regular `<a>` tags only for external links.

### Sticky Headers

A sticky header stays fixed at the top of the viewport as the user scrolls. This keeps the navigation always accessible. In Tailwind, you achieve this with `sticky top-0` combined with a `z-` class to ensure the header stays above other content.

## Step by Step

### Step 1: Create the Navbar Component

Create a new file for the navbar:

```tsx
// src/components/Navbar.tsx

import Link from "next/link";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/startups", label: "Startups" },
  { href: "/categories", label: "Categories" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500">
            <span className="text-sm font-bold text-white">L</span>
          </div>
          <span className="text-xl font-bold text-gray-900">LaunchPad</span>
        </Link>

        <div className="hidden items-center gap-1 sm:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/submit"
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            Submit Startup
          </Link>
        </div>
      </nav>
    </header>
  );
}
```

Let us break down the important styling decisions:

The `header` element:
- `sticky top-0` -- Sticks to the top of the viewport on scroll
- `z-50` -- Ensures the header renders above other content
- `border-b border-gray-200` -- A subtle bottom border to visually separate the header from page content
- `bg-white/80` -- White background at 80% opacity. In Tailwind v4, the `/80` syntax sets opacity
- `backdrop-blur-md` -- Blurs the content behind the header, creating a frosted glass effect. Combined with the semi-transparent background, this gives the header a modern look

The `nav` element:
- `flex items-center justify-between` -- Horizontal layout with items centered vertically and spread to the edges
- `max-w-6xl mx-auto` -- Centers the nav with the same max-width we use on pages, keeping everything aligned

The logo section:
- A small green square with a white "L" serves as a simple logo
- The company name sits next to it

The navigation links:
- `hidden sm:flex` -- Hidden on mobile (we will add a mobile menu in a later lesson), visible on small screens and up
- Each link has padding, rounded corners, and a hover state that adds a gray background

The "Submit Startup" button:
- Uses our primary green color as a filled button to make it stand out from the text links
- This is the primary call-to-action in the navigation

### Step 2: Create the Footer Component

```tsx
// src/components/Footer.tsx

import Link from "next/link";

const footerLinks = [
  { href: "/startups", label: "Startups" },
  { href: "/categories", label: "Categories" },
  { href: "/submit", label: "Submit" },
];

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-500">
              <span className="text-xs font-bold text-white">L</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              LaunchPad
            </span>
          </div>

          <div className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-500 transition-colors hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="text-sm text-gray-400">
            &copy; 2025 LaunchPad. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
```

The footer is intentionally simple:
- A top border mirrors the header's bottom border
- On mobile, items stack vertically (`flex-col`); on tablet and up, they sit in a row (`sm:flex-row`)
- The logo is a smaller version of the one in the header
- Footer links use muted gray text that brightens on hover
- The copyright text is the most muted element

### Step 3: Update the Root Layout

Now we integrate the Navbar and Footer into the root layout so they appear on every page:

```tsx
// src/app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LaunchPad",
  description: "Discover and upvote the best new startups",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
```

The structure uses a flex column layout:
- `flex min-h-screen flex-col` -- The wrapper takes at least the full viewport height and arranges children vertically
- `flex-1` on the main element makes it grow to fill all available space, pushing the footer to the bottom even on short pages
- The Navbar sits at the top, the Footer at the bottom, and page content fills the middle

Since we moved the wrapping structure into the layout, we need to update the homepage to remove its own `min-h-screen`:

```tsx
// src/app/page.tsx
// Update the outer element -- remove min-h-screen since the layout handles it now

export default function HomePage() {
  return (
    <div className="bg-gray-50">
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
    </div>
  );
}
```

Reload the page. You should see the sticky navbar at the top, your startup cards in the middle, and the footer at the bottom.

### Step 4: Create the Startups Page

Create a placeholder page for the `/startups` route:

```tsx
// src/app/startups/page.tsx

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All Startups | LaunchPad",
  description: "Browse all startups on LaunchPad",
};

export default function StartupsPage() {
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
        </div>

        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">
            Startup listings will appear here once we connect the data layer.
          </p>
        </div>
      </div>
    </div>
  );
}
```

Notice the `metadata` export. Each page can export its own `metadata` object to override the title and description set in the root layout. This is important for SEO -- each page should have a unique, descriptive title.

The dashed border placeholder is a common pattern during development. It makes it clear that the content area is intentionally empty and waiting to be filled in.

### Step 5: Create the Categories Page

```tsx
// src/app/categories/page.tsx

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Categories | LaunchPad",
  description: "Browse startups by category",
};

const categories = [
  { name: "SaaS", slug: "saas", description: "Software as a Service products", count: 0 },
  { name: "AI/ML", slug: "ai-ml", description: "Artificial intelligence and machine learning", count: 0 },
  { name: "Developer Tools", slug: "developer-tools", description: "Tools that make developers more productive", count: 0 },
  { name: "Fintech", slug: "fintech", description: "Financial technology and services", count: 0 },
  { name: "Health", slug: "health", description: "Healthcare and wellness", count: 0 },
  { name: "Education", slug: "education", description: "Learning and education technology", count: 0 },
  { name: "E-commerce", slug: "e-commerce", description: "Online shopping and retail", count: 0 },
  { name: "Social", slug: "social", description: "Social networking and community", count: 0 },
];

export default function CategoriesPage() {
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
          {categories.map((category) => (
            <div
              key={category.slug}
              className="rounded-xl border border-gray-200 bg-white p-6 transition-all hover:shadow-md hover:border-primary-300"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                {category.name}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {category.description}
              </p>
              <p className="mt-3 text-xs text-gray-400">
                {category.count} startups
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

This page uses a three-column grid on large screens. Each category card shares the same hover effect as our startup cards to keep the visual language consistent across the app.

### Step 6: Test Navigation

With all pages in place, click the navigation links in your browser:

1. Click "Startups" -- the URL changes to `/startups` and you see the placeholder page, but the navbar and footer stay exactly where they are. No flash, no re-render of the shared layout.

2. Click "Categories" -- same smooth transition. The layout persists; only the page content changes.

3. Click the "LaunchPad" logo -- you go back to the homepage.

Open the Network tab in developer tools and watch what happens when you navigate. You will see that Next.js fetches only a small payload for the new page content, not the entire HTML document. This is client-side navigation powered by the `Link` component.

### Step 7: Add Active Link Styling

Currently all navigation links look the same regardless of which page you are on. Let us create a component that highlights the current link. Since detecting the current route requires the `usePathname` hook, this component needs to be a client component:

```tsx
// src/components/NavLink.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
};

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary-50 text-primary-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {children}
    </Link>
  );
}
```

This is our first client component. Notice the `"use client"` directive at the top. We need it because `usePathname` is a React hook that reads browser state.

The `isActive` logic has a special case for the home route (`/`). For the home link, we check for an exact match. For other links, we use `startsWith` so that `/startups/some-slug` still highlights the "Startups" nav link.

Now update the Navbar to use NavLink:

```tsx
// src/components/Navbar.tsx

import Link from "next/link";
import { NavLink } from "@/components/NavLink";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/startups", label: "Startups" },
  { href: "/categories", label: "Categories" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500">
            <span className="text-sm font-bold text-white">L</span>
          </div>
          <span className="text-xl font-bold text-gray-900">LaunchPad</span>
        </Link>

        <div className="hidden items-center gap-1 sm:flex">
          {navLinks.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/submit"
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            Submit Startup
          </Link>
        </div>
      </nav>
    </header>
  );
}
```

Notice that the Navbar itself remains a server component. Only the NavLink is a client component. This is an important pattern: push the client boundary as far down the tree as possible. The Navbar's static parts (logo, layout, submit button) do not need to be in the client bundle. Only the part that reads the pathname does.

### Step 8: Understand the Component Boundary

Here is a visual representation of the server/client split in our layout:

```
RootLayout (server)
  Navbar (server)
    Logo (server -- static HTML)
    NavLink (client -- needs usePathname)
    NavLink (client)
    NavLink (client)
    Submit Button (server -- static HTML)
  Page Content (server)
  Footer (server)
```

Out of all these components, only the three NavLink instances are client components. Everything else renders on the server and ships as plain HTML. This is the ideal setup -- minimal JavaScript sent to the browser.

## Try It Yourself

1. Add a "Submit" page at `src/app/submit/page.tsx` with a simple placeholder. Click the "Submit Startup" button in the navbar and verify the navigation works.

2. Try removing the `sticky` class from the header. Scroll down the page and notice that the navbar scrolls away. Add it back.

3. Change the backdrop blur. Try `backdrop-blur-sm` for less blur or `backdrop-blur-lg` for more. Try removing `bg-white/80` and using `bg-white` instead to see the difference the transparency makes.

4. In the Footer, add links to external sites (like Twitter or GitHub). Use regular `<a>` tags with `target="_blank"` and `rel="noopener noreferrer"` for external links instead of Next.js `Link`.

5. Create a nested layout at `src/app/startups/layout.tsx` that adds a sidebar or sub-navigation. Notice how it wraps only the startups pages while the root layout still wraps everything.

## Key Takeaways

- Layouts in Next.js persist across navigations. They do not re-mount when users move between pages, which improves performance and preserves state.

- The root layout at `src/app/layout.tsx` wraps every page. It is the right place for shared UI like the navbar and footer.

- The Next.js `Link` component enables client-side navigation without full page reloads. Always use it for internal links.

- Each page can export its own `metadata` object to set page-specific titles and descriptions for SEO.

- Push the `"use client"` boundary as far down the component tree as possible. Only the components that need hooks or browser APIs should be client components.

- A sticky header with `sticky top-0 z-50` keeps navigation accessible as users scroll.

- The `bg-white/80 backdrop-blur-md` pattern creates a frosted glass effect that is both attractive and functional.

- Using `flex min-h-screen flex-col` with `flex-1` on the main content area pushes the footer to the bottom of the page even when content is short.

## Next Steps

We have a solid layout shell with navigation. But our startup cards still use hardcoded data defined directly in the homepage file. In the next lesson, we will create a proper mock data layer with JSON files and helper functions. This will give us realistic data to work with and set the stage for eventually connecting to a real database.
