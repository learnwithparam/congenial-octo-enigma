# Dark Mode and Polish

Dark mode is no longer a nice-to-have. Users expect it, and many prefer it, especially at night. Beyond dark mode, this lesson covers the final visual polish that separates a student project from a professional product: smooth transitions, refined typography, a proper favicon, and consistent spacing throughout the app.

## What You Will Learn

- How dark mode works in Tailwind CSS v4
- Building a ThemeToggle component that persists the user's preference
- Adding dark: variants to all existing components
- Storing and reading theme preference from localStorage
- Adding transitions and hover animations
- Polishing typography, spacing, and overall design consistency
- Setting up a favicon and meta tags

## Concepts

### Dark Mode in Tailwind CSS v4

Tailwind CSS v4 supports dark mode through the `dark:` variant. By default, it uses the CSS `prefers-color-scheme` media query, which follows the user's operating system setting. You can also configure it to use a class-based strategy, where you add a `dark` class to the `<html>` element to toggle dark mode manually.

We will use the class-based approach because it gives users control. They can override their OS preference within our app.

In Tailwind CSS v4, you configure the dark mode strategy in your CSS file rather than a config file:

```css
/* src/app/globals.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

This tells Tailwind that the `dark:` variant should activate when the element (or any ancestor) has the `dark` class.

### The Flash of Incorrect Theme

When using localStorage to persist theme preference, there is a problem: the page renders with the default theme before JavaScript runs and applies the stored preference. This causes a brief flash of the wrong theme. The solution is to run a tiny inline script in the `<head>` that applies the class before the page paints.

### Transition Best Practices

Adding `transition-colors` or `transition-all` to elements makes color changes smooth. But be careful with `transition-all` on large layouts as it can cause performance issues. Stick to specific transition properties when possible.

## Step by Step

### Step 1: Configure Dark Mode in CSS

Update your `src/app/globals.css` to enable class-based dark mode:

```css
/* src/app/globals.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
```

The `@custom-variant` directive is how Tailwind CSS v4 handles dark mode configuration. It replaces the `darkMode` option from the older `tailwind.config.js` approach.

### Step 2: Create the ThemeToggle Component

This component lets users switch between light and dark mode. It reads and writes to localStorage.

```tsx
// src/components/ThemeToggle.tsx
'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Read the stored preference or fall back to system preference
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <button
        className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
        aria-label="Toggle theme"
      >
        <div className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
```

Let us walk through the important decisions:

The `mounted` state prevents a hydration mismatch. On the server, React does not know the user's theme preference. If we tried to render the sun/moon icon immediately, the server HTML might not match the client. By rendering a placeholder until the component mounts, we avoid this issue.

We check `localStorage` first, then fall back to the system preference using `window.matchMedia`. This respects the user's explicit choice over their OS setting.

### Step 3: Prevent the Flash of Wrong Theme

Add an inline script to the root layout that runs before the page paints. This applies the correct class to `<html>` before React hydrates.

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

const themeScript = `
  (function() {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100 transition-colors">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

The `suppressHydrationWarning` on `<html>` prevents React from complaining that the server-rendered class does not match the client. This is expected behavior since the script modifies the class before hydration.

The `dangerouslySetInnerHTML` runs the script inline in the `<head>`, before any rendering occurs. This eliminates the flash.

Notice the dark mode styles on `<body>`: `dark:bg-gray-950` gives a very dark background, and `dark:text-gray-100` sets the base text to near-white.

### Step 4: Add ThemeToggle to the Navbar

Update the Navbar to include the theme toggle button.

```tsx
// In src/components/Navbar.tsx, import and add ThemeToggle

import ThemeToggle from '@/components/ThemeToggle';

// Inside the desktop navigation div (the one with hidden md:flex):
<div className="hidden items-center gap-6 md:flex">
  {navLinks.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors dark:text-gray-300 dark:hover:text-indigo-400"
    >
      {link.label}
    </Link>
  ))}
  <ThemeToggle />
  <Link
    href="/submit"
    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
  >
    Submit Startup
  </Link>
</div>

// In the mobile menu panel, add a ThemeToggle too:
<div className="flex items-center justify-between px-3 py-3">
  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
    Theme
  </span>
  <ThemeToggle />
</div>
```

### Step 5: Add Dark Mode to the Navbar

Update the full Navbar with dark mode styles:

```tsx
// src/components/Navbar.tsx — updated class strings

// Nav container
<nav className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">

// Logo
<Link href="/" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">

// Mobile hamburger
<button className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-800">

// Mobile menu panel
<div className="border-t border-gray-200 bg-white md:hidden dark:border-gray-800 dark:bg-gray-950">

// Mobile menu links
<Link className="block rounded-lg px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-indigo-400">
```

The pattern is consistent: gray-200 borders become gray-800, white backgrounds become gray-950, gray-700 text becomes gray-300.

### Step 6: Add Dark Mode to StartupCard

```tsx
// src/components/StartupCard.tsx — update class strings

// Card container
<Link className="group block rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md sm:p-6 dark:border-gray-800 dark:bg-gray-900 dark:hover:shadow-gray-900/50">

// Category badge
<span className="inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">

// Title
<h3 className="mt-3 text-base font-semibold text-gray-900 group-hover:text-indigo-600 sm:text-lg dark:text-gray-100 dark:group-hover:text-indigo-400">

// Tagline
<p className="mt-1 text-sm text-gray-600 line-clamp-2 dark:text-gray-400">

// URL text
<span className="text-xs text-gray-500 sm:text-sm dark:text-gray-500">
```

### Step 7: Add Dark Mode to the Form

```tsx
// In StartupForm.tsx, update the class strings

// Labels
<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">

// Input fields (normal state)
'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'

// Input fields (error state)
'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:bg-gray-900 dark:text-gray-100'

// Character count
<p className="mt-1 text-xs text-gray-500 dark:text-gray-500">

// Error messages stay red — they work on both light and dark backgrounds
<p className="mt-1 text-sm text-red-600 dark:text-red-400">
```

For the select dropdown, add the same dark styles:

```tsx
// Select element
<select className="... dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
```

### Step 8: Add Dark Mode to the Footer

```tsx
// src/components/Footer.tsx
export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            LaunchPad. Built with Next.js and Tailwind CSS.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400">
              About
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400">
              Privacy
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

### Step 9: Add Dark Mode to Loading and Error States

```tsx
// Skeleton component — update the background color
<div className={'animate-pulse rounded bg-gray-200 dark:bg-gray-800 ' + className} aria-hidden="true" />

// ErrorMessage component — update text and background colors
<div className="mb-4 rounded-full bg-red-100 p-3 dark:bg-red-900/30">
<h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
<p className="mb-6 max-w-md text-gray-600 dark:text-gray-400">

// 404 page
<h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100">
<h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
<p className="mb-8 max-w-md text-gray-600 dark:text-gray-400">
```

### Step 10: Add Dark Mode to Search Components

```tsx
// SearchBar input
<input className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500" />

// FilterBar pills (inactive)
'rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'

// FilterBar pills (active) — indigo stays the same, it works on both themes

// No results state
<div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center dark:border-gray-700">
<h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
```

### Step 11: Add Hover Animations and Transitions

Add subtle animations to make the app feel more alive.

For the startup cards, add a lift effect on hover:

```tsx
// StartupCard — add transform on hover
<Link className="group block rounded-lg border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 sm:p-6 dark:border-gray-800 dark:bg-gray-900">
```

For buttons, add a press effect:

```tsx
// Submit button — add active state
<button className="... active:scale-[0.98] transition-all">
```

For nav links, add an underline animation. Add this to your `globals.css`:

```css
.nav-link {
  position: relative;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background-color: currentColor;
  transition: width 0.2s ease;
}

.nav-link:hover::after {
  width: 100%;
}
```

Then add the `nav-link` class to your desktop navigation links.

### Step 12: Polish Typography

Good typography makes a huge difference. Update your global styles:

```css
/* Add to src/app/globals.css */

body {
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
}

h1, h2, h3, h4, h5, h6 {
  text-wrap: balance;
}

p {
  text-wrap: pretty;
}
```

The `text-wrap: balance` on headings prevents awkward line breaks where one word wraps to a second line. The `text-wrap: pretty` on paragraphs avoids orphaned words at the end of paragraphs. The `font-feature-settings` enables stylistic alternates if your font supports them.

### Step 13: Add a Favicon

Create a simple favicon. You can use an emoji-based favicon by adding this to your layout's metadata:

```tsx
// In src/app/layout.tsx, update the metadata
export const metadata: Metadata = {
  title: 'LaunchPad - Discover Startups',
  description: 'Discover, upvote, and submit the latest startups.',
  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
};
```

Create a simple SVG favicon:

```xml
<!-- public/favicon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#4F46E5"/>
  <text x="50" y="72" font-size="60" text-anchor="middle" fill="white" font-family="system-ui" font-weight="bold">L</text>
</svg>
```

This creates a simple indigo square with a white "L" for LaunchPad. SVG favicons are supported by all modern browsers and they scale perfectly to any size.

### Step 14: Add Open Graph Meta Tags

For better social media sharing, add Open Graph tags:

```tsx
// In src/app/layout.tsx
export const metadata: Metadata = {
  title: 'LaunchPad - Discover Startups',
  description: 'Discover, upvote, and submit the latest startups.',
  openGraph: {
    title: 'LaunchPad - Discover Startups',
    description: 'Discover, upvote, and submit the latest startups.',
    url: 'https://your-domain.vercel.app',
    siteName: 'LaunchPad',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LaunchPad - Discover Startups',
    description: 'Discover, upvote, and submit the latest startups.',
  },
  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
};
```

### Step 15: Final Review

Go through the entire app and check:

1. Toggle dark mode on every page. No element should have a white background or dark text that is unreadable.
2. Check hover states on all interactive elements.
3. Verify all skeletons use the dark variant (`dark:bg-gray-800`).
4. Make sure the toast notification looks good in both themes.
5. Check that focus rings are visible in both themes. Indigo works well on both.
6. Verify the form error messages (red) are readable in both themes.

A common color mapping reference for your project:

Light to Dark equivalents:
- `bg-white` becomes `dark:bg-gray-950` (page backgrounds)
- `bg-gray-50` becomes `dark:bg-gray-900` (card/section backgrounds)
- `bg-gray-100` becomes `dark:bg-gray-800` (subtle backgrounds, pills)
- `bg-gray-200` becomes `dark:bg-gray-800` (skeletons, dividers)
- `border-gray-200` becomes `dark:border-gray-800` (borders)
- `text-gray-900` becomes `dark:text-gray-100` (primary text)
- `text-gray-700` becomes `dark:text-gray-300` (secondary text)
- `text-gray-600` becomes `dark:text-gray-400` (muted text)
- `text-gray-500` stays the same or becomes `dark:text-gray-500`
- Indigo accent colors shift one shade: `text-indigo-600` becomes `dark:text-indigo-400`

## Try It Yourself

1. Add a system theme option to the ThemeToggle, so users can choose between Light, Dark, and System. The System option follows the OS preference.

2. Add a smooth color transition when toggling themes. Apply `transition-colors duration-200` to the `<body>` and key elements.

3. Create a dark-mode-specific hero section background using a subtle gradient instead of the plain dark background.

4. Add a subtle box shadow to cards in dark mode using something like `dark:shadow-gray-900/20` for depth.

## Key Takeaways

- Tailwind CSS v4 uses `@custom-variant dark` in CSS to configure class-based dark mode, replacing the old config file approach.
- Prevent the flash of incorrect theme by running an inline script in `<head>` before React hydrates.
- Use `suppressHydrationWarning` on `<html>` when the class may change before hydration.
- Wait until the component mounts before rendering theme-dependent UI to avoid hydration mismatches.
- Follow a consistent color mapping pattern: white backgrounds become gray-950, gray-200 borders become gray-800, and so on.
- Small animations (translate, scale, underlines) make the app feel alive without being distracting.
- Typography features like `text-wrap: balance` and `text-wrap: pretty` improve readability with zero effort.
- SVG favicons scale perfectly and are supported by all modern browsers.
- Open Graph meta tags improve how your app appears when shared on social media.

## Next Steps

LaunchPad is looking polished and professional. The final step is to put it on the internet so the world can see it. In the next lesson, you will deploy to Vercel and celebrate shipping your first full-stack application.
