# Responsive Design

Your LaunchPad app works great on a desktop browser, but open it on a phone and things get awkward. Text overflows, the navigation is impossible to use, and cards are squished into a single column with no breathing room. In this lesson you will make every component responsive, build a mobile hamburger menu, and learn the Tailwind CSS responsive design system.

## What You Will Learn

- How Tailwind CSS responsive prefixes work (sm, md, lg, xl, 2xl)
- Building a mobile navigation with a hamburger menu and slide-out panel
- Making grid layouts adapt from 1 column on mobile to 3 columns on desktop
- Fixing typography, spacing, and touch targets for mobile
- Testing responsive layouts in the browser
- Adding proper viewport meta tags

## Concepts

### Mobile-First Design

Tailwind CSS uses a mobile-first approach. When you write `text-sm`, that applies to all screen sizes. When you write `md:text-lg`, that only applies at the `md` breakpoint and above. This means your base styles are for mobile, and you add larger-screen overrides as needed.

The default breakpoints in Tailwind CSS v4:
- `sm` — 640px and up (large phones, small tablets)
- `md` — 768px and up (tablets)
- `lg` — 1024px and up (small laptops)
- `xl` — 1280px and up (desktops)
- `2xl` — 1536px and up (large monitors)

### The Responsive Design Process

Rather than designing for desktop and then cramming everything onto mobile, the better approach is:
1. Design for the smallest screen first
2. Add complexity as the screen gets wider
3. Test at every breakpoint

Since we built desktop-first (common when learning), we will audit each component and add mobile styles.

### Touch Targets

On mobile, users tap with fingers, not click with mouse cursors. The recommended minimum touch target size is 44x44 pixels. Buttons, links, and interactive elements need to be large enough to tap comfortably.

## Step by Step

### Step 1: Verify the Viewport Meta Tag

Open `src/app/layout.tsx` and make sure the metadata includes the viewport configuration. Next.js sets this automatically when you use the metadata export, but let us verify:

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'LaunchPad - Discover Startups',
  description: 'Discover, upvote, and submit the latest startups.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-white text-gray-900 antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

Next.js 15 automatically adds the viewport meta tag with `width=device-width, initial-scale=1` when you use the metadata API. You do not need to add it manually in the `<head>`. The `antialiased` class on `body` smooths font rendering on all devices.

### Step 2: Build a Responsive Navbar with Mobile Menu

The Navbar needs the most work. On desktop it shows horizontal links. On mobile it needs a hamburger button that opens a slide-out menu.

```tsx
// src/components/Navbar.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/startups', label: 'Startups' },
  { href: '/categories', label: 'Categories' },
];

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-indigo-600">
            LaunchPad
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Submit Startup
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 md:hidden"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className="border-t border-gray-200 bg-white md:hidden">
          <div className="space-y-1 px-4 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/submit"
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-2 block rounded-lg bg-indigo-600 px-3 py-3 text-center text-base font-medium text-white hover:bg-indigo-700"
            >
              Submit Startup
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
```

Key responsive decisions:

The desktop links use `hidden md:flex`. This hides them on mobile and shows them as a flex row on medium screens and above.

The hamburger button uses `md:hidden`. It is visible on mobile and hidden on medium screens and above.

The mobile menu links have `py-3` for a tall touch target (about 48px including text). Each link is a full-width block, making it easy to tap.

The `onClick={() => setIsMobileMenuOpen(false)}` on each link closes the menu when the user navigates. Without this, the menu stays open after navigation.

The `aria-label` and `aria-expanded` attributes make the hamburger accessible to screen readers.

Note: This Navbar is now a client component because it uses `useState`. If your previous Navbar was a server component, this is a necessary trade-off for interactivity. The performance impact is minimal since the Navbar is small.

### Step 3: Make the Startup Card Grid Responsive

Update the `StartupList` component to use a responsive grid.

```tsx
// src/components/StartupList.tsx
import { Startup } from '@/types';
import StartupCard from '@/components/StartupCard';

interface StartupListProps {
  startups: Startup[];
}

export default function StartupList({ startups }: StartupListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {startups.map((startup) => (
        <StartupCard key={startup.slug} startup={startup} />
      ))}
    </div>
  );
}
```

The grid progression:
- Mobile (default): 1 column, 16px gap
- sm (640px+): 2 columns, 24px gap
- lg (1024px+): 3 columns, 24px gap

We also tighten the gap on mobile (`gap-4`) and widen it on larger screens (`sm:gap-6`) to maximize card space on small devices.

### Step 4: Make the StartupCard Responsive

The card itself might need adjustments for different screen sizes.

```tsx
// src/components/StartupCard.tsx
import Link from 'next/link';
import { Startup } from '@/types';
import UpvoteButton from '@/components/UpvoteButton';

interface StartupCardProps {
  startup: Startup;
}

export default function StartupCard({ startup }: StartupCardProps) {
  return (
    <Link
      href={'/startups/' + startup.slug}
      className="group block rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md sm:p-6"
    >
      {/* Category badge */}
      <span className="inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
        {startup.category}
      </span>

      {/* Title */}
      <h3 className="mt-3 text-base font-semibold text-gray-900 group-hover:text-indigo-600 sm:text-lg">
        {startup.name}
      </h3>

      {/* Tagline */}
      <p className="mt-1 text-sm text-gray-600 line-clamp-2">
        {startup.tagline}
      </p>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-gray-500 sm:text-sm">
          {startup.url}
        </span>
        <UpvoteButton
          count={startup.upvotes}
          startupSlug={startup.slug}
        />
      </div>
    </Link>
  );
}
```

The responsive changes:
- Padding: `p-4` on mobile, `sm:p-6` on larger screens
- Title size: `text-base` on mobile, `sm:text-lg` on larger screens
- URL text: `text-xs` on mobile, `sm:text-sm` on larger screens
- `line-clamp-2` prevents the tagline from taking up too much space on small screens

### Step 5: Make the Detail Page Responsive

The startup detail page needs layout adjustments for mobile.

```tsx
// src/app/startups/[slug]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      {/* Back link */}
      <Link
        href="/startups"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 sm:mb-6"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to startups
      </Link>

      {/* Header section */}
      <div className="mb-6 sm:mb-8">
        <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800 sm:text-sm">
          {startup.category}
        </span>
        <h1 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">
          {startup.name}
        </h1>
        <p className="mt-2 text-base text-gray-600 sm:text-lg">
          {startup.tagline}
        </p>
      </div>

      {/* Description */}
      <div className="prose prose-sm max-w-none sm:prose-base">
        <p className="text-gray-700 leading-relaxed">{startup.description}</p>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
        <a
          href={startup.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Visit Website
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <Link
          href="/startups"
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Browse More Startups
        </Link>
      </div>
    </div>
  );
}
```

Key responsive adjustments:
- The heading scales from `text-2xl` on mobile to `text-3xl` on tablets to `text-4xl` on desktops.
- Action buttons stack vertically on mobile (`flex-col`) and go horizontal on larger screens (`sm:flex-row`).
- Padding and margins are tighter on mobile and expand on larger screens.
- Buttons use `justify-center` so they look good when full-width on mobile.
- The `py-3` on buttons ensures comfortable touch targets.

### Step 6: Make the Form Responsive

The form at `/submit` is already in a `max-w-2xl` container, which keeps it narrow. But some tweaks help on mobile.

```tsx
// Update the SubmitPage wrapper in src/app/submit/page.tsx
export default async function SubmitPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Submit Your Startup
        </h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">
          Share your startup with the LaunchPad community. Fill in the details
          below and we will review your submission.
        </p>
      </div>
      <StartupForm categories={categories} />
    </div>
  );
}
```

The form inputs already use `w-full` so they fill the container on all screen sizes. The main changes are to the heading and description text sizes.

### Step 7: Make the Search and Filter Responsive

The `FilterBar` needs to wrap gracefully on mobile. It already uses `flex-wrap`, which helps. But the `SearchBar` and the area around it can benefit from some spacing adjustments.

Update the `StartupSearch` component's layout:

```tsx
// In src/components/StartupSearch.tsx, update the wrapper div
<div className="space-y-4 sm:space-y-6">
  <SearchBar defaultValue={currentQuery} onSearch={handleSearch} />
  <FilterBar
    categories={categories}
    activeCategory={currentCategory}
    onCategoryChange={handleCategoryChange}
  />

  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-gray-600">
      {resultsCount} {resultsCount === 1 ? 'startup' : 'startups'} found
    </p>
    {isSearching && (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Spinner size="sm" />
        Searching...
      </div>
    )}
  </div>

  {/* ... rest of the component ... */}
</div>
```

On mobile, the results count and the searching indicator stack vertically. On larger screens they sit side by side.

### Step 8: Make the Footer Responsive

```tsx
// src/components/Footer.tsx
export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-sm text-gray-600">
            LaunchPad. Built with Next.js and Tailwind CSS.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-gray-600 hover:text-indigo-600">
              About
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-indigo-600">
              Privacy
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-indigo-600">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

On mobile, the footer content stacks vertically and centers. On larger screens, the text goes left and the links go right.

### Step 9: Make the Hero Section Responsive

If your homepage has a hero section, adjust it for mobile:

```tsx
// In your homepage hero section
<section className="py-12 text-center sm:py-16 lg:py-20">
  <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl lg:text-5xl">
    Discover the Next Big Startup
  </h1>
  <p className="mx-auto mt-4 max-w-xl text-base text-gray-600 sm:text-lg lg:text-xl">
    Browse, upvote, and submit the latest startups building the future.
  </p>
  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
    <Link
      href="/startups"
      className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700"
    >
      Browse Startups
    </Link>
    <Link
      href="/submit"
      className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      Submit Yours
    </Link>
  </div>
</section>
```

The hero heading scales across three sizes. The CTA buttons stack on mobile and sit side-by-side on larger screens.

### Step 10: Test Responsiveness

Open Chrome DevTools (F12 or Cmd+Option+I) and click the device toolbar icon (or press Cmd+Shift+M). Test these screen widths:

- 375px (iPhone SE)
- 390px (iPhone 14)
- 768px (iPad)
- 1024px (iPad landscape / small laptop)
- 1280px (desktop)
- 1536px (large monitor)

For each width, check:
1. The Navbar shows a hamburger on mobile and full links on desktop
2. The mobile menu opens, links work, and it closes after navigation
3. The startup card grid shows 1 column on mobile, 2 on tablet, 3 on desktop
4. All text is readable without horizontal scrolling
5. Buttons and links are easy to tap (at least 44px tall)
6. The form inputs are not tiny on mobile
7. The footer stacks properly on mobile
8. No content is cut off or overflowing

You can also test on a real phone. Run your dev server with `npm run dev` and access it on your phone using your computer's local IP address (like `http://192.168.1.100:3000`).

## Try It Yourself

1. Add a slide-in animation to the mobile menu. Use CSS transitions or Tailwind's transition utilities to animate the menu height from 0 to its full height.

2. Add a backdrop overlay when the mobile menu is open. When the user taps outside the menu, it should close.

3. Test your app with a screen reader (VoiceOver on Mac, NVDA on Windows). Make sure the hamburger menu announces its state and navigation links are properly labeled.

4. Add a "scroll to top" button that appears when the user scrolls down on mobile. Scrolling through a long list of startups can leave users stranded at the bottom.

## Key Takeaways

- Tailwind CSS is mobile-first: base styles are for mobile, breakpoint prefixes add larger-screen overrides.
- The standard breakpoints are sm (640px), md (768px), lg (1024px), xl (1280px), and 2xl (1536px).
- Navigation is the hardest component to make responsive. A hamburger menu with a slide-out panel is the standard mobile pattern.
- Grid layouts should progress from fewer columns on small screens to more columns on larger screens.
- Touch targets should be at least 44x44 pixels. Use generous padding on mobile buttons and links.
- Test at multiple screen widths, not just "mobile" and "desktop". Tablets and small laptops are important breakpoints too.
- Stack elements vertically on mobile (flex-col) and switch to horizontal (flex-row) on larger screens.
- Always test on a real device if possible. The DevTools simulator does not capture everything.

## Next Steps

The app is responsive and works on every screen size. In the next lesson, you will add dark mode support and final visual polish, making LaunchPad look like a professionally designed product.
