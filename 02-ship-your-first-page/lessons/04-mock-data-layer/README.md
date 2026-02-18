# Mock Data Layer

Real applications fetch data from databases and APIs, but building the backend before the frontend slows you down. In this lesson you will create a mock data layer that lets you develop the entire UI with realistic data, then swap in real API calls later without changing a single component. This is a professional technique used in teams of all sizes.

## What You'll Learn

- Why mock data is valuable during frontend development
- How to structure JSON data files for startups and categories
- How to build a typed API module with functions for fetching, filtering, and searching
- How to use mock API functions inside Next.js server components
- How type safety carries through from data files to components

## Concepts

### Why Mock Data?

In a real project, backend and frontend development often happen in parallel. The database schema might not be finalized, the API endpoints might not be built yet, or the third-party service might not be connected. Mock data solves this by giving the frontend a stable, predictable data source to build against.

Benefits of a mock data layer:

1. Speed -- You do not need to wait for the backend to be ready. Build the entire UI immediately.

2. Consistency -- Mock data is deterministic. The same data appears every time you refresh, making it easier to debug layout issues and test edge cases.

3. Offline development -- No network requests means you can work on a plane, in a cafe with spotty wifi, or anywhere else.

4. Easy testing -- Want to test how the UI handles 100 startups? Or zero? Just change the mock data.

5. Clean separation -- By defining functions like `getStartups()` and `getStartupBySlug()`, you create a contract between the data layer and the UI. When you later replace mock data with real API calls, the components do not need to change.

### The API Module Pattern

Instead of importing JSON directly into components, we create an API module (`src/lib/api.ts`) that exports functions. Components call these functions and receive typed data back. The functions encapsulate where the data comes from and how it is transformed.

This pattern has a name in software engineering: the Repository pattern. The components "ask" for data through a well-defined interface, and the implementation behind that interface can change without affecting the rest of the application.

## Step by Step

### Step 1: Create the Startups Data File

Create a JSON file with 12 realistic startup entries. Each entry includes all the fields defined in our `Startup` type:

```json
// src/data/startups.json
[
  {
    "id": "1",
    "name": "CodeCraft AI",
    "slug": "codecraft-ai",
    "tagline": "AI-powered code review that catches bugs before they ship",
    "description": "CodeCraft AI uses advanced machine learning models trained on millions of code reviews to analyze your pull requests in real-time. It catches potential bugs, security vulnerabilities, and performance issues before they reach production. The tool integrates with GitHub, GitLab, and Bitbucket, providing inline suggestions directly in your pull request workflow. Teams using CodeCraft AI report 40% fewer production bugs and 25% faster code review cycles.",
    "category": "Developer Tools",
    "url": "https://codecraft.ai",
    "upvotes": 142,
    "createdAt": "2025-01-15",
    "founder": "Sarah Chen"
  },
  {
    "id": "2",
    "name": "FinTrack",
    "slug": "fintrack",
    "tagline": "Personal finance dashboard that actually makes sense",
    "description": "FinTrack connects to over 12,000 financial institutions to aggregate all your accounts in one place. Unlike traditional budgeting apps that overwhelm you with categories and rules, FinTrack uses AI to automatically categorize spending, detect recurring charges, and surface actionable insights. The clean dashboard shows your net worth trend, upcoming bills, and spending patterns at a glance. FinTrack never stores your bank credentials -- it uses read-only connections through Plaid.",
    "category": "Fintech",
    "url": "https://fintrack.io",
    "upvotes": 89,
    "createdAt": "2025-02-01",
    "founder": "Marcus Johnson"
  },
  {
    "id": "3",
    "name": "LearnLoop",
    "slug": "learnloop",
    "tagline": "Spaced repetition meets AI tutoring for any subject",
    "description": "LearnLoop combines scientifically-proven spaced repetition with an AI tutor that adapts to your learning style. Upload any material -- textbooks, lecture notes, articles -- and LearnLoop generates flashcards, practice questions, and interactive explanations. The algorithm tracks what you know and what you struggle with, scheduling reviews at the optimal time for long-term retention. Students using LearnLoop consistently score 20-30% higher on exams compared to traditional study methods.",
    "category": "Education",
    "url": "https://learnloop.com",
    "upvotes": 215,
    "createdAt": "2025-01-20",
    "founder": "Priya Patel"
  },
  {
    "id": "4",
    "name": "ShipFast",
    "slug": "shipfast",
    "tagline": "Deploy full-stack apps in minutes, not days",
    "description": "ShipFast provides production-ready starter templates for Next.js, SvelteKit, and Nuxt with authentication, payments, email, and database already configured. Pick a template, customize the design, connect your Stripe account, and deploy. What used to take a week of boilerplate setup now takes under 10 minutes. ShipFast templates come with built-in analytics, SEO optimization, and responsive design so you can focus on your unique features.",
    "category": "SaaS",
    "url": "https://shipfast.dev",
    "upvotes": 176,
    "createdAt": "2025-02-10",
    "founder": "Alex Rivera"
  },
  {
    "id": "5",
    "name": "MediSync",
    "slug": "medisync",
    "tagline": "Unified health records across all your providers",
    "description": "MediSync solves the fragmented health records problem by creating a single, patient-controlled health profile that syncs across doctors, hospitals, and clinics. Using FHIR-compliant APIs, MediSync pulls records from participating providers and presents them in a clean timeline view. Patients can share specific records with new providers instantly, eliminating the fax-and-wait cycle. MediSync is HIPAA compliant and uses end-to-end encryption for all health data.",
    "category": "Health",
    "url": "https://medisync.health",
    "upvotes": 134,
    "createdAt": "2025-01-28",
    "founder": "Dr. Amara Obi"
  },
  {
    "id": "6",
    "name": "CartGenius",
    "slug": "cartgenius",
    "tagline": "AI shopping assistant that finds the best deals across stores",
    "description": "CartGenius is a browser extension and mobile app that monitors prices across 500+ online retailers. When you browse a product, CartGenius instantly shows you the same or similar items at lower prices elsewhere. It tracks price history so you know if a sale is genuinely good or just marketing. The AI assistant can also recommend alternatives based on reviews and ratings. CartGenius has saved its users over $2 million collectively in its first year.",
    "category": "E-commerce",
    "url": "https://cartgenius.shop",
    "upvotes": 98,
    "createdAt": "2025-02-05",
    "founder": "Jordan Lee"
  },
  {
    "id": "7",
    "name": "DevBoard",
    "slug": "devboard",
    "tagline": "The developer portfolio that builds itself from your GitHub",
    "description": "DevBoard automatically generates a polished developer portfolio by analyzing your GitHub activity. It highlights your best projects, visualizes your contribution patterns, extracts README descriptions, and showcases your tech stack. The portfolio updates automatically as you push new code. DevBoard also includes a blog engine powered by your GitHub markdown files and an analytics dashboard showing who views your portfolio. Perfect for job seekers and freelancers who want to showcase their work without maintaining a separate website.",
    "category": "Developer Tools",
    "url": "https://devboard.dev",
    "upvotes": 167,
    "createdAt": "2025-01-10",
    "founder": "Tomoko Sato"
  },
  {
    "id": "8",
    "name": "NeuralNote",
    "slug": "neuralnote",
    "tagline": "AI meeting assistant that captures decisions, not just words",
    "description": "NeuralNote joins your video calls as a silent participant and uses AI to generate structured meeting notes. Unlike basic transcription tools, NeuralNote understands context: it identifies action items, decisions, questions, and follow-ups. After each meeting, participants receive a summary with their personal action items highlighted. NeuralNote integrates with Slack, Notion, and Linear to automatically create tasks from meeting decisions. It supports Zoom, Google Meet, and Microsoft Teams.",
    "category": "AI/ML",
    "url": "https://neuralnote.ai",
    "upvotes": 203,
    "createdAt": "2025-01-18",
    "founder": "Liam O'Brien"
  },
  {
    "id": "9",
    "name": "CommunityHub",
    "slug": "communityhub",
    "tagline": "Build thriving online communities without the complexity",
    "description": "CommunityHub is a modern community platform designed for creators, brands, and organizations. It combines discussion forums, events, courses, and member directories in one clean interface. Unlike Discord or Slack, CommunityHub is purpose-built for communities with features like member onboarding flows, reputation systems, and content moderation powered by AI. The platform is fully white-label, letting you match your brand. CommunityHub communities see 3x higher engagement compared to traditional forums.",
    "category": "Social",
    "url": "https://communityhub.io",
    "upvotes": 156,
    "createdAt": "2025-02-08",
    "founder": "Maya Rodriguez"
  },
  {
    "id": "10",
    "name": "PaySplit",
    "slug": "paysplit",
    "tagline": "Split business expenses with co-founders, no awkward conversations",
    "description": "PaySplit automates expense splitting for small teams and co-founders. Connect your business bank account or credit card, and PaySplit automatically categorizes expenses and splits them according to your agreed-upon ratios. It handles unequal splits, reimbursements, and tax-deductible categorization. Monthly settlement reports make bookkeeping painless. PaySplit integrates with QuickBooks and Xero for seamless accounting. Over 2,000 startups use PaySplit to keep co-founder finances transparent.",
    "category": "Fintech",
    "url": "https://paysplit.co",
    "upvotes": 78,
    "createdAt": "2025-02-12",
    "founder": "David Kim"
  },
  {
    "id": "11",
    "name": "SkillForge",
    "slug": "skillforge",
    "tagline": "Hands-on coding challenges that mirror real work",
    "description": "SkillForge offers coding challenges based on real-world scenarios rather than abstract algorithm puzzles. Build a rate limiter, implement OAuth from scratch, design a URL shortener with analytics -- each challenge comes with a real codebase, requirements document, and automated tests. SkillForge tracks your progress across different skill areas and suggests challenges that target your weaknesses. Companies use SkillForge for technical interviews because the challenges reflect actual job tasks.",
    "category": "Education",
    "url": "https://skillforge.dev",
    "upvotes": 191,
    "createdAt": "2025-01-25",
    "founder": "Rahul Mehta"
  },
  {
    "id": "12",
    "name": "PipelineAI",
    "slug": "pipelineai",
    "tagline": "No-code AI model deployment for any team",
    "description": "PipelineAI lets non-ML engineers deploy machine learning models with a visual interface. Upload a trained model from PyTorch, TensorFlow, or scikit-learn, configure scaling rules, and get a production API endpoint in minutes. PipelineAI handles model versioning, A/B testing, monitoring, and auto-scaling. It supports GPU inference for large models and provides a playground for testing predictions before going live. Teams using PipelineAI deploy models 10x faster than building custom infrastructure.",
    "category": "AI/ML",
    "url": "https://pipeline-ai.com",
    "upvotes": 223,
    "createdAt": "2025-01-08",
    "founder": "Elena Vasquez"
  }
]
```

A few things to note about this data:

- Each startup has a unique `slug` derived from its name. We will use slugs in URLs (`/startups/codecraft-ai`) rather than numeric IDs because they are more readable and better for SEO.

- The `description` field is a full paragraph. This gives us enough text to build a compelling detail page.

- We have startups spread across all eight categories, with some categories having two or three entries.

- Upvote counts vary widely (78 to 223) to make sorting and ranking interesting.

- Dates span January and February 2025, giving us a range to test "newest" sorting.

### Step 2: Create the Categories Data File

```json
// src/data/categories.json
[
  {
    "name": "SaaS",
    "slug": "saas",
    "description": "Software as a Service products and platforms"
  },
  {
    "name": "AI/ML",
    "slug": "ai-ml",
    "description": "Artificial intelligence and machine learning tools"
  },
  {
    "name": "Developer Tools",
    "slug": "developer-tools",
    "description": "Tools and services that make developers more productive"
  },
  {
    "name": "Fintech",
    "slug": "fintech",
    "description": "Financial technology and services"
  },
  {
    "name": "Health",
    "slug": "health",
    "description": "Healthcare, wellness, and medical technology"
  },
  {
    "name": "Education",
    "slug": "education",
    "description": "Learning platforms and education technology"
  },
  {
    "name": "E-commerce",
    "slug": "e-commerce",
    "description": "Online shopping, retail, and marketplace tools"
  },
  {
    "name": "Social",
    "slug": "social",
    "description": "Social networking and community platforms"
  }
]
```

The categories file is intentionally separate from the startups file. In a real application, categories might come from a different database table or API endpoint. Keeping them separate now makes the eventual transition smoother.

### Step 3: Build the API Module

This is the core of the lesson. Create the API module that wraps the raw JSON data with typed, queryable functions:

```tsx
// src/lib/api.ts

import { Startup, Category } from "@/types";
import startupsData from "@/data/startups.json";
import categoriesData from "@/data/categories.json";

// Type assertion -- ensure imported JSON matches our types
const startups: Startup[] = startupsData as Startup[];
const categories: Category[] = categoriesData.map((cat) => ({
  ...cat,
  count: startups.filter((s) => s.category === cat.name).length,
}));

// ---------------------
// Startup functions
// ---------------------

export function getStartups(): Startup[] {
  return startups.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getStartupBySlug(slug: string): Startup | undefined {
  return startups.find((s) => s.slug === slug);
}

export function getStartupsByCategory(categoryName: string): Startup[] {
  return startups
    .filter((s) => s.category === categoryName)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function getFeaturedStartups(limit: number = 3): Startup[] {
  return [...startups]
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, limit);
}

export function searchStartups(query: string): Startup[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return getStartups();

  return startups.filter(
    (s) =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.tagline.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery) ||
      s.category.toLowerCase().includes(lowerQuery) ||
      s.founder.toLowerCase().includes(lowerQuery)
  );
}

export function getStartupSlugs(): string[] {
  return startups.map((s) => s.slug);
}

// ---------------------
// Category functions
// ---------------------

export function getCategories(): Category[] {
  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
```

Let us walk through each function:

`getStartups()` -- Returns all startups sorted by creation date (newest first). This is the default listing order. We create a new sorted array rather than mutating the original.

`getStartupBySlug(slug)` -- Finds a single startup by its URL slug. Returns `undefined` if no match is found -- the calling code needs to handle this case (we will show a 404 page).

`getStartupsByCategory(categoryName)` -- Filters startups by category name and sorts by date. Note that we match on the full category name ("Developer Tools"), not the slug ("developer-tools"). This keeps the filter logic simple.

`getFeaturedStartups(limit)` -- Returns the top N startups by upvote count. We spread into a new array (`[...startups]`) before sorting so we do not mutate the original data. The default limit is 3, which is perfect for a "featured" section on the homepage.

`searchStartups(query)` -- A simple text search across multiple fields. It converts both the query and the data to lowercase for case-insensitive matching. If the query is empty, it returns all startups. This function searches across name, tagline, description, category, and founder -- casting a wide net so users find what they are looking for.

`getStartupSlugs()` -- Returns an array of all startup slugs. We will use this later for static site generation (telling Next.js which dynamic routes to pre-render at build time).

`getCategories()` -- Returns all categories sorted alphabetically. The `count` field is computed dynamically by counting how many startups belong to each category.

`getCategoryBySlug(slug)` -- Finds a single category by its slug. Useful for category detail pages.

### Step 4: Update the Types File

We need to make sure the `Category` type in our types file does not require the `count` field when defining the JSON data (since we compute it dynamically). The current type already works because we add `count` in the API module when we map over the JSON data. However, let us make the types more precise:

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

This is the same type definition we created in Lesson 02. No changes needed -- the API module handles the transformation from raw JSON to the full `Category` type with the count field.

### Step 5: Enable JSON Imports

TypeScript needs to be told it is okay to import JSON files. Open `tsconfig.json` and make sure `resolveJsonModule` is set to `true` (it should already be from the scaffolding):

```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    // ... other options
  }
}
```

This lets us write `import startupsData from "@/data/startups.json"` and get a typed array back. TypeScript infers the types from the JSON structure.

### Step 6: Use the API in the Startups Page

Now let us replace the placeholder content in the startups page with real data from our mock layer:

```tsx
// src/app/startups/page.tsx

import type { Metadata } from "next";
import { getStartups } from "@/lib/api";
import { StartupCard } from "@/components/StartupCard";

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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {startups.map((startup) => (
            <StartupCard key={startup.id} startup={startup} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

Look at how clean this is. The component calls `getStartups()`, gets a typed array back, and renders it. There is no `fetch()`, no `useEffect()`, no loading state. Because this is a server component, the function runs on the server during rendering. The data is available synchronously.

This is one of the biggest advantages of server components: data fetching becomes a simple function call.

### Step 7: Update the Categories Page

Replace the hardcoded categories array with data from the API:

```tsx
// src/app/categories/page.tsx

import type { Metadata } from "next";
import Link from "next/link";
import { getCategories } from "@/lib/api";

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
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/categories/${category.slug}`}
              className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:shadow-md hover:border-primary-300"
            >
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                {category.name}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {category.description}
              </p>
              <p className="mt-3 text-xs text-gray-400">
                {category.count} {category.count === 1 ? "startup" : "startups"}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Now the category cards show the real count of startups in each category, computed from the actual data. We also wrapped each card in a `Link` component so clicking a category navigates to its detail page (which we will build in a future lesson).

### Step 8: Update the Homepage

Replace the hardcoded sample data on the homepage with featured startups from the API:

```tsx
// src/app/page.tsx

import { getFeaturedStartups } from "@/lib/api";
import { StartupCard } from "@/components/StartupCard";

export default function HomePage() {
  const featured = getFeaturedStartups(3);

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

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900">
            Trending Startups
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            The most upvoted startups this month
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((startup) => (
              <StartupCard key={startup.id} startup={startup} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
```

The homepage now shows the top 3 startups by upvote count. If you add a new startup to `startups.json` with a high upvote count, it will automatically appear in the featured section.

### Step 9: The Replacement Path

Here is the key insight about this architecture. When you eventually connect to a real database, you only need to change the `src/lib/api.ts` file. The components never know or care where the data comes from. For example, `getStartups()` might change from:

```tsx
// Current: mock data
export function getStartups(): Startup[] {
  return startups.sort(/* ... */);
}
```

To:

```tsx
// Future: real database
export async function getStartups(): Promise<Startup[]> {
  const result = await db.select().from(startupsTable).orderBy(desc(startupsTable.createdAt));
  return result;
}
```

The component call changes minimally -- you add `await` in front:

```tsx
const startups = await getStartups();
```

Server components in Next.js support `async/await` natively, so this transition is seamless. This is why the mock data layer pattern is so valuable: it gives you the right abstractions from day one.

## Try It Yourself

1. Add a 13th startup to `startups.json`. Give it a very high upvote count (say, 300) and verify that it appears in the "Trending Startups" section on the homepage.

2. Open the browser console and confirm there are no errors. Then deliberately break the JSON by removing a comma. See how the error appears.

3. Add a new function to `api.ts` called `getRecentStartups(days: number)` that returns startups created within the last N days. Hint: compare `new Date(s.createdAt)` to `Date.now() - days * 86400000`.

4. Try calling `searchStartups("ai")` in one of the pages and render the results. Notice how it matches "CodeCraft AI" (name), "NeuralNote" (description mentions AI), and "PipelineAI" (name and description).

5. Modify the `Category` type to include an `icon` field (a string). Update the JSON and the categories page to display the icon.

## Key Takeaways

- A mock data layer decouples your frontend from the backend, letting you build the full UI before the API is ready.

- JSON files with TypeScript type assertions give you type-safe mock data with zero runtime overhead.

- The API module pattern (functions like `getStartups()`, `getStartupBySlug()`) creates a clean contract between data and UI. Swapping mock data for a real database means changing only the API module.

- Server components can call data functions directly without `useEffect` or `fetch`. Data is available synchronously during server rendering.

- Computing derived values (like category counts) in the API module keeps the logic centralized and the components simple.

- Sorting, filtering, and searching all belong in the API module, not in components. This keeps components focused on presentation.

## Next Steps

We have realistic mock data flowing through typed API functions into our pages. In the next lesson, we will refine the card layout, build a proper StartupList component, add a hero section to the homepage, and create a responsive grid that looks great on every screen size.
