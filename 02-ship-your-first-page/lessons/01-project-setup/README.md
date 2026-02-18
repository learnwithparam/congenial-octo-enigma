# Project Setup

Welcome to the very first lesson of "Ship Your First Page." By the end of this lesson you will have a fully working Next.js 15 project with TypeScript and Tailwind CSS v4 running on your machine. You will understand why we picked these tools and how they fit together to form the foundation of LaunchPad, the startup directory app we are building throughout this course.

## What You'll Learn

- What Next.js 15 is and why it is a great choice for modern web apps
- How to scaffold a new project with create-next-app
- The file and folder structure of a Next.js App Router project
- How Tailwind CSS v4 differs from earlier versions (CSS-first configuration)
- How the TypeScript path alias `@/*` keeps imports clean
- The difference between the development server and a production build
- How to verify everything works with a simple "Hello LaunchPad" page

## Concepts

### Why Next.js 15?

Next.js is a React framework that gives you everything you need to build production web applications. Version 15 is a major milestone because it pairs React 19 with a stable App Router, server components by default, and a streamlined developer experience.

Here is why we chose it for LaunchPad:

1. App Router -- The newer routing system uses the file system to define routes. A file at `app/about/page.tsx` automatically becomes the `/about` route. No separate router configuration needed.

2. Server Components -- React components render on the server by default. This means faster initial page loads, smaller JavaScript bundles sent to the browser, and the ability to fetch data directly inside components without an extra API layer.

3. Built-in Optimizations -- Image optimization, font loading, script management, and metadata handling are all built in. You get production-grade performance without bolting on extra libraries.

4. TypeScript First -- The project scaffolding, configuration files, and documentation all assume TypeScript. You get type safety from day one.

5. Vibrant Ecosystem -- Next.js has one of the largest communities in the React world. You will find answers, plugins, and deployment options everywhere you look.

### What is the App Router?

Before Next.js 13, routing was handled by a `pages/` directory (often called the "Pages Router"). The App Router, introduced in Next.js 13 and now stable in 15, lives inside the `app/` directory and brings several improvements:

- Layouts that persist across navigations without re-mounting
- Loading and error UI at the route level
- Server components by default (no `getServerSideProps` or `getStaticProps`)
- Nested routing with collocated files (loading.tsx, error.tsx, not-found.tsx)

We will use the App Router exclusively in this course.

### Tailwind CSS v4 -- A New Era

Tailwind CSS v4 is a ground-up rewrite. The biggest change you will notice is the move from a JavaScript configuration file (`tailwind.config.js`) to a CSS-first approach. Configuration now lives inside your CSS using the `@theme` directive.

Key changes in v4:

- No `tailwind.config.js` required for most projects. Theme values are defined in CSS.
- The `@tailwind` directives are replaced by a single `@import "tailwindcss"` statement.
- Automatic content detection means you no longer need a `content` array.
- Colors, spacing, fonts, and other design tokens are customized with `@theme` blocks right in your stylesheet.

This makes the setup simpler and keeps all styling concerns in CSS where they belong.

### TypeScript and Path Aliases

TypeScript adds static type checking to JavaScript. Instead of discovering bugs at runtime, the compiler catches them while you write code. For a project like LaunchPad, types help us describe the shape of a startup, a category, or a user with precision.

The path alias `@/*` is configured in `tsconfig.json` so that instead of writing fragile relative imports like `../../../components/Navbar`, you write `@/components/Navbar`. This works no matter how deeply nested your file is.

## Step by Step

### Step 1: Create the Next.js Project

Open your terminal and navigate to the directory where you keep your projects. Run the following command:

```bash
npx create-next-app@15 launchpad
```

The CLI will ask you several questions. Choose these options:

```
Would you like to use TypeScript?                 Yes
Would you like to use ESLint?                     Yes
Would you like to use Tailwind CSS?               Yes
Would you like your code inside a `src/` directory? Yes
Would you like to use App Router?                 Yes
Would you like to use Turbopack for next dev?     Yes
Would you like to customize the import alias?     Yes
What import alias would you like configured?      @/*
```

When it finishes you will have a `launchpad` directory with everything installed.

```bash
cd launchpad
```

### Step 2: Explore the File Structure

Open the project in your code editor. Here is what the scaffolded project looks like:

```
launchpad/
  src/
    app/
      layout.tsx        # Root layout wrapping every page
      page.tsx           # Homepage (the "/" route)
      globals.css        # Global styles with Tailwind import
    favicon.ico
  public/
    file.svg
    globe.svg
    next.svg
    vercel.svg
    window.svg
  .eslintrc.json
  next.config.ts
  package.json
  postcss.config.mjs
  tsconfig.json
  tailwind.config.ts     # May or may not exist depending on version
```

Let us walk through the most important files.

`src/app/layout.tsx` -- This is the root layout. Every page in your application is rendered inside this layout. It contains the `<html>` and `<body>` tags, sets the language, and loads fonts. Think of it as the shell of your application.

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        {children}
      </body>
    </html>
  );
}
```

Notice how we updated the `metadata` object with our app name and description. Next.js uses this to set the `<title>` and `<meta name="description">` tags automatically.

`src/app/page.tsx` -- This is the homepage. When someone visits `/`, Next.js renders this component inside the root layout. We will replace the default content shortly.

`src/app/globals.css` -- This is where Tailwind is loaded. In Tailwind v4 with the create-next-app scaffold, you will see something like:

```css
@import "tailwindcss";
```

That single line imports all of Tailwind's utility classes. No `@tailwind base`, `@tailwind components`, `@tailwind utilities` needed anymore.

### Step 3: Understand the Tailwind v4 CSS-First Config

In Tailwind v4, you customize the design system directly in CSS. Open `src/app/globals.css` and update it to include our custom theme for LaunchPad:

```css
@import "tailwindcss";

@theme {
  --color-primary-50: #ecfdf5;
  --color-primary-100: #d1fae5;
  --color-primary-200: #a7f3d0;
  --color-primary-300: #6ee7b7;
  --color-primary-400: #34d399;
  --color-primary-500: #10b981;
  --color-primary-600: #059669;
  --color-primary-700: #047857;
  --color-primary-800: #065f46;
  --color-primary-900: #064e3b;
  --color-primary-950: #022c22;

  --font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
}
```

With this in place you can use classes like `bg-primary-500`, `text-primary-700`, and `border-primary-200` anywhere in your components. The `@theme` block tells Tailwind to generate utility classes for each token you define. If you later need to adjust colors or add spacing values, you do it right here in CSS.

If the scaffold created a `tailwind.config.ts` file, you can delete it. Tailwind v4 does not need it when you configure through CSS. However, leaving it is fine too -- Tailwind v4 will merge both sources.

### Step 4: Verify the Path Alias

Open `tsconfig.json` and confirm the paths configuration:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

The key line is `"@/*": ["./src/*"]`. This tells TypeScript (and Next.js) that whenever it sees an import starting with `@/`, it should resolve it relative to the `src/` directory. For example:

```tsx
import { Navbar } from "@/components/Navbar";
// resolves to src/components/Navbar
```

This is much cleaner than counting `../` segments.

### Step 5: Create the Hello LaunchPad Page

Replace the contents of `src/app/page.tsx` with a simple page to confirm everything is wired up:

```tsx
// src/app/page.tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900">
          Hello, LaunchPad
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Discover and upvote the best new startups
        </p>
        <div className="mt-8">
          <span className="inline-block rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 transition-colors">
            Get Started
          </span>
        </div>
      </div>
    </main>
  );
}
```

This page uses:
- Flexbox utilities to center content vertically and horizontally
- Typography utilities for font size, weight, tracking, and color
- Our custom `bg-primary-500` color from the theme
- A hover transition to confirm interactive styles work

### Step 6: Start the Development Server

Run the development server:

```bash
npm run dev
```

Open your browser to `http://localhost:3000`. You should see a centered page with "Hello, LaunchPad" in large bold text, a subtitle, and a green "Get Started" button.

The development server uses Turbopack (the successor to Webpack for development) and gives you:

- Hot Module Replacement (HMR) -- changes appear instantly without a full page reload
- Fast Refresh -- React state is preserved across edits when possible
- Error overlay -- syntax errors and runtime errors show up directly in the browser

Try editing the heading text and saving. The change should appear in your browser almost instantly.

### Step 7: Understand Dev vs Build

There are two ways to run your Next.js application:

Development mode (`npm run dev`):
- Optimized for developer experience, not performance
- Includes helpful error messages and warnings
- Pages are compiled on demand (only when you visit them)
- Source maps are included for debugging
- Turbopack handles bundling for fast refresh

Production build (`npm run build` followed by `npm run start`):
- Optimized for end-user performance
- Minified JavaScript and CSS
- Static pages are pre-rendered at build time
- Server components are rendered once and cached
- Tree shaking removes unused code

During this course we will use `npm run dev` almost exclusively. When we deploy in the final lesson, we will run `npm run build` and examine the output.

Try running the build now to see what happens:

```bash
npm run build
```

You will see output showing each route, its size, and whether it was statically generated or server-rendered. Our simple homepage should be marked as static since it has no dynamic data yet.

```
Route (app)                  Size     First Load JS
┌ ○ /                        5.2 kB         92 kB
└ ○ /_not-found              977 B          88 kB
```

The circle symbol (○) means the route was statically generated at build time.

### Step 8: Add a Few Useful Scripts

Open `package.json` and confirm these scripts exist (they should be there by default):

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

The `--turbopack` flag enables the Turbopack bundler for development, which is significantly faster than Webpack for large projects.

### Step 9: Create the Initial Folder Structure

Before we move on, let us create the folder structure we will use throughout the course. You do not need to add files yet -- just the directories:

```
src/
  app/
    layout.tsx
    page.tsx
    globals.css
    startups/
      page.tsx            (we will create this later)
      [slug]/
        page.tsx          (we will create this later)
    categories/
      page.tsx            (we will create this later)
  components/             (shared UI components)
  data/                   (mock data files)
  lib/                    (utility functions and API helpers)
  types/                  (TypeScript type definitions)
```

Create these directories now:

```bash
mkdir -p src/components src/data src/lib src/types
```

This structure keeps things organized:
- `app/` holds routes and pages
- `components/` holds reusable UI components
- `data/` will hold our mock JSON data
- `lib/` will hold helper functions and API utilities
- `types/` will hold shared TypeScript type definitions

## Try It Yourself

Now that the project is running, try these small experiments:

1. Change the background color of the main element to `bg-primary-50` and see how it looks with our custom theme color.

2. Add a second line of text below the subtitle. Use `text-sm` and `text-gray-400` for a more muted look.

3. Open your browser's developer tools (F12 or Cmd+Shift+I) and inspect the HTML. Notice that the page is server-rendered -- the full HTML is in the initial response, not injected by JavaScript.

4. Try adding an invalid Tailwind class like `bg-notacolor-500`. Notice that nothing breaks -- Tailwind simply ignores classes it does not recognize.

5. In `globals.css`, try adding a new color to the `@theme` block:

```css
--color-accent-500: #8b5cf6;
```

Then use `bg-accent-500` somewhere on the page. Confirm that Tailwind picks up the new token automatically.

## Key Takeaways

- Next.js 15 gives us the App Router with server components, file-based routing, and built-in optimizations out of the box.

- The `src/app/` directory is where all routes live. A `page.tsx` file inside a folder becomes a route automatically.

- `layout.tsx` wraps all pages and is the right place for shared elements like fonts, metadata, and global providers.

- Tailwind CSS v4 uses a CSS-first configuration with the `@theme` directive. No JavaScript config file is needed.

- The `@/*` path alias maps to `./src/*` and keeps imports clean regardless of file depth.

- `npm run dev` is for development with hot reload. `npm run build` creates an optimized production bundle.

- Server components render on the server by default. This means faster page loads and less JavaScript shipped to the browser.

## Next Steps

Your project is up and running with a simple "Hello, LaunchPad" page. In the next lesson, we will build our first real React component: a StartupCard that displays information about a startup. You will learn how to define props with TypeScript, style components with Tailwind, and compose UI from smaller building blocks.
