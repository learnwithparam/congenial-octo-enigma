# Architecture Decisions

Every software project is shaped by hundreds of decisions — which framework to use, which database, which hosting provider, how to structure the code. Most of these decisions are made informally, in Slack messages or hallway conversations, and the reasoning behind them is lost within weeks. Architecture Decision Records (ADRs) solve this problem by capturing the context, options considered, and rationale behind each significant technical choice. In this lesson, you will learn the ADR format and write several ADRs for LaunchPad.

## What You'll Learn

- What Architecture Decision Records are and why they matter for teams of any size
- The standard ADR template and how to fill it out
- How to evaluate trade-offs between competing technologies
- The difference between reversible and irreversible decisions and how that affects your approach
- Five complete ADRs for the LaunchPad project

## Concepts

### Why Document Decisions?

Imagine joining a project six months after development started. You look at the codebase and see that the team chose SQLite instead of PostgreSQL, Express instead of Fastify, and a monorepo instead of separate repositories. Your first question is: why?

Without documentation, you have two options — ask a team member (hoping they remember and are still on the team) or guess. Neither is great.

ADRs solve this by creating a permanent record of the decision, the alternatives that were considered, and the reasoning that led to the final choice. They are not about proving the decision was correct — they are about preserving the context so that future developers (including your future self) can understand why things are the way they are.

ADRs are valuable even for solo developers. When you revisit a project after months away, you will forget why you made certain choices. An ADR brings you back up to speed in minutes.

### The ADR Template

There are many ADR formats in use, but the most widely adopted is the format proposed by Michael Nygard. Here is the template we will use for LaunchPad:

```
# ADR-NNN: Title

Status: Proposed | Accepted | Deprecated | Superseded

## Context

What is the situation that requires a decision? What problem are we
trying to solve? What constraints exist?

## Options Considered

### Option A: Name
- Description of the option
- Pros
- Cons

### Option B: Name
- Description of the option
- Pros
- Cons

(additional options as needed)

## Decision

What is the change that we are proposing or have agreed to?

## Consequences

What becomes easier or more difficult because of this decision?
Include both positive and negative consequences.
```

The Status field tracks the lifecycle of a decision. A "Proposed" ADR is under discussion. "Accepted" means the team has agreed to it. "Deprecated" means the decision is no longer relevant. "Superseded" means a newer ADR has replaced this one — always reference the superseding ADR.

### Reversible vs Irreversible Decisions

Jeff Bezos categorizes decisions into two types:

Type 1 (Irreversible): These are one-way doors. Once you walk through, you cannot easily walk back. Examples include choosing a programming language for a large codebase, selecting a cloud provider with heavy vendor lock-in, or committing to a database schema that is already storing production data. These decisions deserve thorough analysis and deliberation.

Type 2 (Reversible): These are two-way doors. If the decision turns out to be wrong, you can reverse it without catastrophic cost. Examples include choosing a CSS framework, picking a state management library, or deciding on a folder structure. These decisions should be made quickly. Analysis paralysis on reversible decisions wastes more time than making a suboptimal choice.

For each ADR we write, we will label it as Type 1 or Type 2. This helps calibrate how much time and energy to invest in the decision.

### Trade-Off Analysis

Every technology choice involves trade-offs. There is no universally "best" framework, database, or architecture. The right choice depends on your specific context — your team's skills, your timeline, your scale requirements, and your budget.

A useful framework for evaluating options:

1. List your requirements. What must the solution provide? What are nice-to-haves?
2. List your constraints. Team size, timeline, budget, existing infrastructure.
3. Evaluate each option against requirements and constraints.
4. Consider the ecosystem. Documentation quality, community size, frequency of updates, availability of libraries and plugins.
5. Consider the learning curve. If your team knows React but not Svelte, the productivity cost of switching is real.
6. Prototype if uncertain. A 2-hour spike with a new technology tells you more than a week of reading blog posts.

## Step by Step

### Step 1: ADR-001 — Use Next.js 15 for the Frontend

```
# ADR-001: Use Next.js 15 for the Frontend Framework

Status: Accepted
Decision Type: Type 1 (Irreversible — changing frameworks mid-project is extremely costly)
```

Context:

LaunchPad needs a frontend framework to build its web application. The application consists of multiple pages (home, startup detail, submit, search, auth, profile), requires both static and dynamic rendering, needs good SEO for startup detail pages (so they appear in search results), and must support both server-side and client-side interactivity.

The team (in our case, individual learners following this course) will be writing TypeScript and React. The framework needs to handle routing, data fetching, and deployment concerns.

Options Considered:

Option A — Next.js 15 (App Router):

Next.js is the most widely adopted React meta-framework. The App Router (introduced in Next.js 13 and stabilized in 14 and 15) provides server components, server actions, file-based routing, and built-in API routes. It supports static generation, server-side rendering, and client-side rendering, letting you choose the right strategy per page.

Advantages: Largest React ecosystem, excellent documentation, built-in file-based routing, server components reduce client JavaScript, Vercel provides easy deployment, strong TypeScript support, large community means issues are well-documented.

Disadvantages: The App Router introduced significant complexity compared to the Pages Router. Vercel-centric deployment can feel like vendor lock-in (though self-hosting is possible). Server components have a learning curve for developers used to client-only React.

Option B — Create React App (or Vite + React):

A client-side-only React application using Vite as the build tool. All rendering happens in the browser.

Advantages: Simpler mental model (no server/client component distinction), faster development server startup, no server-side concerns.

Disadvantages: No server-side rendering means poor SEO without additional tooling. Need to set up routing separately (React Router). Need a separate backend server for APIs. No built-in code splitting by route.

Option C — Remix:

Remix is another React meta-framework with a focus on web standards and progressive enhancement. It uses loaders and actions instead of server components.

Advantages: Strong conventions for data loading and mutation, excellent error handling, works without JavaScript enabled.

Disadvantages: Smaller ecosystem than Next.js, fewer learning resources available, less community momentum since the Shopify acquisition. The mental model differs enough from standard React that it adds friction for learners.

Decision:

We will use Next.js 15 with the App Router for the LaunchPad frontend. It provides the server-side rendering we need for SEO, file-based routing that reduces boilerplate, and the largest ecosystem of any React framework. The App Router's server components align with our component tree design from Lesson 06, where most components are server-rendered with targeted client components for interactivity.

Consequences:

Positive: Server components reduce our client JavaScript bundle. File-based routing means the folder structure mirrors the URL structure. Built-in API routes mean we could consolidate frontend and backend in one project if desired. Deployment to Vercel is trivial.

Negative: The team must understand the server component vs client component distinction. Debugging server components requires understanding server-side rendering. Some third-party React libraries do not yet support server components.

### Step 2: ADR-002 — Use Express for the API Layer

```
# ADR-002: Use Express.js for the API Layer

Status: Accepted
Decision Type: Type 2 (Reversible — the API layer can be migrated to another framework with moderate effort since the API contracts remain the same)
```

Context:

While Next.js includes built-in API routes, we are building LaunchPad as a course project where learners need to understand how a standalone API server works. A separate API server teaches important concepts: CORS, middleware patterns, request/response handling, and deployment of backend services. The API will implement the endpoints defined in Lesson 05.

Options Considered:

Option A — Express.js:

Express is the original and most widely used Node.js web framework. It has been around since 2010 and virtually every Node.js developer has encountered it.

Advantages: Ubiquitous — nearly every Node.js tutorial and resource uses Express. Massive middleware ecosystem (helmet, cors, morgan, express-validator). Very flexible and un-opinionated, giving full control. Extremely well-documented. Easy to find help with any issue.

Disadvantages: Lacks built-in TypeScript support (needs @types/express). No built-in request validation. Performance is adequate but not best-in-class. The un-opinionated nature means more decisions for the developer to make.

Option B — Fastify:

Fastify is a modern Node.js framework focused on performance and developer experience. It includes built-in JSON schema validation and serialization.

Advantages: Significantly faster than Express in benchmarks. Built-in schema validation using JSON Schema. First-class TypeScript support. Plugin system encourages good architecture.

Disadvantages: Smaller community than Express. Fewer tutorials and learning resources. Some Express middleware does not have Fastify equivalents. The plugin system has a learning curve.

Option C — Hono:

Hono is a lightweight, edge-first web framework that runs on multiple runtimes (Node.js, Deno, Bun, Cloudflare Workers).

Advantages: Extremely fast and lightweight. Works across multiple runtimes. Modern API design. Built-in middleware for common tasks.

Disadvantages: Relatively new with a smaller community. Fewer learning resources. Edge-first design means some Node.js-specific patterns do not apply.

Decision:

We will use Express.js for the LaunchPad API. Since this is a learning project, the extensive documentation, tutorials, and community support of Express outweigh the performance advantages of alternatives. Learners can find answers to virtually any Express question online. The patterns learned with Express (middleware, routing, request handling) transfer to any Node.js framework.

Consequences:

Positive: Learners gain experience with the most widely used Node.js framework. Abundant learning resources accelerate understanding. The middleware ecosystem provides ready-made solutions for CORS, logging, validation, and security.

Negative: We need to manually set up request validation (using a library like Zod or express-validator). TypeScript types require an additional package. Performance is not optimized for high-traffic production use, though this is irrelevant for our learning context.

### Step 3: ADR-003 — Start with SQLite, Migrate to PostgreSQL

```
# ADR-003: Start with SQLite for Development, Migrate to PostgreSQL for Production

Status: Accepted
Decision Type: Type 2 (Reversible — using an ORM abstracts the database, making migration straightforward)
```

Context:

LaunchPad needs a relational database to store startups, users, categories, upvotes, and comments. The data model from Lesson 04 has clear relationships (a startup belongs to a user, an upvote links a user to a startup) that suit a relational database.

For a learning project, the database setup process should not block learners from starting development. Requiring Docker or a cloud database connection before writing the first line of code creates unnecessary friction.

Options Considered:

Option A — SQLite for development, PostgreSQL for production:

SQLite is a file-based database that requires zero setup. You install the npm package and it creates a database file in your project directory. PostgreSQL is a full-featured production database that requires a running server.

Advantages: No database setup required to start coding. SQLite is fast for development. The ORM (Drizzle or Prisma) abstracts the differences, so most code works with both databases. Learners can start building immediately and deal with PostgreSQL when they are ready for deployment.

Disadvantages: Some SQL features differ between SQLite and PostgreSQL (e.g., date functions, JSON operators). Learners might write queries that work in SQLite but fail in PostgreSQL. Two database configurations to maintain.

Option B — PostgreSQL from the start:

Use PostgreSQL for both development and production. Learners set up a local PostgreSQL server or use Docker.

Advantages: No database differences between environments. Learners get familiar with PostgreSQL from day one. Can use PostgreSQL-specific features (JSON columns, full-text search, arrays).

Disadvantages: Requires Docker or a local PostgreSQL installation. Docker adds complexity for beginners. Cloud database adds cost. Creates a barrier to getting started.

Option C — MongoDB:

Use a document database instead of a relational one.

Advantages: Flexible schema is forgiving during rapid development. JSON-like documents map naturally to JavaScript objects.

Disadvantages: Our data model has clear relationships (startups belong to users, upvotes link users and startups) that are better served by a relational database. Lacks ACID transactions by default. The flexibility can lead to inconsistent data shapes if not carefully managed.

Decision:

We will use SQLite during development and migrate to PostgreSQL for production deployment. We will use Drizzle ORM to define our schema and queries, which provides a database-agnostic layer that makes the migration smooth. The schema definition (from Lesson 04) will be written once in Drizzle's TypeScript schema format and work with both databases.

Consequences:

Positive: Zero setup cost to start development. Learners can focus on application logic rather than database administration. The Drizzle ORM teaches transferable skills — understanding ORMs applies to any database. Migration to PostgreSQL is a configuration change, not a rewrite.

Negative: Learners may encounter differences in SQL behavior between SQLite and PostgreSQL. Some PostgreSQL features (full-text search, JSONB queries) are not available in SQLite. We must test the production database separately to catch compatibility issues.

### Step 4: ADR-004 — Use TypeScript Everywhere

```
# ADR-004: Use TypeScript for All Application Code

Status: Accepted
Decision Type: Type 1 (Irreversible — converting a large TypeScript codebase back to JavaScript would require removing all type annotations, and the codebase is designed around TypeScript patterns)
```

Context:

LaunchPad is a full-stack application with a Next.js frontend and an Express backend. We need to decide whether to use JavaScript or TypeScript for both codebases. The API contracts from Lesson 05 define strict data shapes — request bodies, response objects, and error formats — that both the frontend and backend must conform to.

Options Considered:

Option A — TypeScript everywhere:

Write all application code in TypeScript. Define shared types for API contracts that both the frontend and backend use. Use strict mode for maximum type safety.

Advantages: Catches errors at compile time rather than runtime. API contract types ensure the frontend and backend agree on data shapes. IDE support (autocomplete, refactoring, documentation) is significantly better with types. Self-documenting code — types serve as documentation. Refactoring is safer because the compiler catches broken references.

Disadvantages: Learning curve for developers unfamiliar with TypeScript. Slightly more verbose code. Build step is required (though Next.js and modern tools handle this automatically). Some third-party libraries have incomplete type definitions.

Option B — JavaScript with JSDoc:

Write plain JavaScript but add type annotations using JSDoc comments. This provides some type checking in IDEs without a compilation step.

Advantages: No build step or compilation. Lower barrier to entry for JavaScript developers. Types are optional and non-blocking.

Disadvantages: JSDoc type annotations are more verbose than TypeScript. Less complete type coverage. No enforcement — developers can ignore type errors. Shared types between projects require separate type definition files.

Option C — JavaScript without types:

Write plain JavaScript with no type annotations.

Advantages: Simplest setup. No learning curve beyond JavaScript itself.

Disadvantages: No compile-time error detection. Refactoring is risky in a codebase of any significant size. API contract mismatches are only caught at runtime. IDE support is limited to inference.

Decision:

We will use TypeScript with strict mode for all LaunchPad code. The API contracts defined in Lesson 05 will be expressed as TypeScript interfaces that both the frontend and backend import. This creates a single source of truth for data shapes. If the API contract changes, the TypeScript compiler will identify every file that needs to be updated.

Consequences:

Positive: The compiler catches mismatches between frontend expectations and backend responses. Refactoring is safe — renaming a field in the API contract highlights every affected component and endpoint. IDE autocomplete and documentation improve developer productivity. New developers can understand data shapes by reading type definitions.

Negative: The team must learn TypeScript syntax and concepts (generics, type narrowing, discriminated unions). Initial setup requires TypeScript configuration for both projects. Occasional "fighting the type system" when dealing with dynamic data or complex generics.

### Step 5: ADR-005 — Separate Repositories per Course Module

```
# ADR-005: Use Separate Repositories per Course Module

Status: Accepted
Decision Type: Type 2 (Reversible — repositories can be combined into a monorepo later if needed)
```

Context:

The fullstack masterclass is structured as multiple course modules (Think in Systems, frontend, backend, database, deployment, etc.). We need to decide how to organize the code. Learners will follow along and build the application incrementally across courses.

Options Considered:

Option A — Monorepo (all code in one repository):

A single repository containing both the frontend (Next.js) and backend (Express) applications, plus shared code. Use a tool like Turborepo or npm workspaces to manage the packages.

Advantages: Shared types are easy to reference. Atomic commits across frontend and backend. Single git history for the entire project. Tool coordination (linting, testing) is centralized.

Disadvantages: More complex initial setup (workspace configuration, build orchestration). Larger repository size. Git history mixes frontend and backend changes. For a course, learners might feel overwhelmed by seeing the full monorepo before they understand each piece.

Option B — Separate repositories per course module:

Each course module gets its own repository. The frontend course has a repo, the backend course has a repo, and shared types are published as a package or duplicated.

Advantages: Each course module is self-contained and independently understandable. Learners work in a focused context — when learning backend development, they only see backend code. Repository size stays small. Clear separation of concerns at the project level. Each repo can have its own README with course-specific instructions.

Disadvantages: Shared types must be duplicated or managed through a published package. Changes that span frontend and backend require commits in two repositories. No atomic cross-project commits.

Option C — Monorepo with feature-based structure:

A single repository organized by feature rather than by technology layer. Each feature folder contains its frontend and backend code.

Advantages: Features are self-contained. Easy to see all code related to a feature.

Disadvantages: Unconventional structure that does not match how most real-world projects are organized. Framework configuration becomes complex.

Decision:

We will use separate repositories for each course module. The frontend (Next.js) application will have its own repository, the backend (Express) API will have its own, and any shared types will be defined in both projects (kept in sync manually during the course). This structure matches the course progression — learners build the backend first, then the frontend, then connect them.

Consequences:

Positive: Each course module is self-contained with a clear README and instructions. Learners are not distracted by code from future lessons. Repositories are small and fast to clone. The separation reinforces the concept that frontend and backend are independent services communicating through API contracts.

Negative: Shared TypeScript types for API contracts must be maintained in two places. If a type changes, both repositories need updating. No single git command to see all changes across the full stack.

### Step 6: Understanding the Trade-Off Matrix

Looking at all five ADRs together, a pattern emerges. Here is a summary of the key factors that influenced each decision:

| Decision | Primary Factor | Secondary Factor | Reversibility |
|----------|---------------|------------------|---------------|
| Next.js | Ecosystem and learning resources | Server-side rendering for SEO | Irreversible |
| Express | Ubiquity and documentation | Middleware ecosystem | Reversible |
| SQLite to PostgreSQL | Zero setup friction | ORM abstraction enables migration | Reversible |
| TypeScript | Type safety for API contracts | IDE productivity | Irreversible |
| Separate repos | Course structure clarity | Focused learning context | Reversible |

Notice that the irreversible decisions (Next.js, TypeScript) received the most thorough analysis. The reversible decisions (Express, SQLite, separate repos) were made more quickly, with the understanding that they can be changed if needed.

This is a useful heuristic for your own projects. Spend your analysis budget on decisions that are hard to undo. Make reversible decisions quickly and move on.

### Step 7: When Decisions Go Wrong

ADRs are living documents. When a decision turns out to be wrong, you do not delete the original ADR — you create a new one that supersedes it.

For example, suppose we discover during development that SQLite's lack of full-text search makes implementing the startup search feature much harder than expected. We would write:

```
# ADR-006: Migrate to PostgreSQL for Development

Status: Accepted (supersedes ADR-003)

## Context

ADR-003 chose SQLite for development to reduce setup friction.
During implementation of the search feature (Lesson XX), we
discovered that SQLite's lack of full-text search requires
implementing search in application code, which is significantly
slower and more complex than using PostgreSQL's built-in
full-text search.

## Decision

We will use PostgreSQL for both development and production.
We will provide Docker Compose configuration for easy local
setup.

## Consequences

Positive: Full-text search is built into the database.
No differences between development and production databases.

Negative: Learners must install Docker or set up PostgreSQL
locally. Added setup step before starting development.
```

The original ADR-003 would be updated to say "Status: Superseded by ADR-006." This preserves the complete decision history — future developers can see that SQLite was tried, why it was chosen, and why it was eventually replaced.

## Try It Yourself

Write an ADR for choosing a CSS approach for LaunchPad. Here are the options to consider:

Option A — Tailwind CSS: Utility-first CSS framework where you apply styles using classes like `bg-blue-500 text-white p-4` directly in your JSX.

Option B — CSS Modules: Write traditional CSS in `.module.css` files. Each file is scoped to its component, preventing style conflicts. Classes are imported as JavaScript objects.

Option C — Styled Components (or Emotion): CSS-in-JS libraries where you define styles using tagged template literals in JavaScript. Styles are scoped to components and can use props dynamically.

Use the ADR template from this lesson. Consider these factors in your evaluation:

- Performance: Which approach generates the smallest CSS bundle?
- Developer experience: Which is most productive for building a component-heavy UI?
- Server components: Which approaches work with React Server Components?
- Learning value: Which teaches the most transferable skills?
- Ecosystem: Which has the best component libraries and design systems?

Here is the ADR header to get you started:

```
# ADR-006: CSS Approach for LaunchPad Frontend

Status: Proposed
Decision Type: Type 2 (Reversible)

## Context

LaunchPad needs a styling approach for its React component library.
The application has approximately 30-40 components across 7 pages.
The design uses a modern aesthetic with cards, badges, forms, and
responsive layouts. The team values developer productivity and
consistent styling across components.

## Options Considered

(your analysis here)

## Decision

(your choice and reasoning here)

## Consequences

(positive and negative outcomes here)
```

Evaluate the three options honestly. There is no single right answer — the goal is to practice the analytical framework and clearly communicate your reasoning.

## Key Takeaways

- Architecture Decision Records capture the context, options, and reasoning behind significant technical choices, preventing knowledge loss as teams change over time.
- The ADR format (Context, Options, Decision, Consequences) forces structured thinking about trade-offs rather than gut-feel decisions.
- Classify decisions as reversible or irreversible. Spend your analysis time on irreversible decisions and make reversible ones quickly.
- There is no universally "best" technology — every choice involves trade-offs that depend on your specific context (team skills, timeline, scale, budget).
- When a decision is superseded, create a new ADR rather than deleting the old one. The decision history itself is valuable.
- For LaunchPad, we chose Next.js (ecosystem), Express (ubiquity), SQLite-to-PostgreSQL (zero friction), TypeScript (type safety), and separate repos (course clarity). Each choice was driven by the specific needs of a learning project.

## Next Steps

With our architecture decisions documented, we have all the building blocks for a complete technical specification. In the final lesson of this course, we will pull together everything from Lessons 01 through 07 — the project vision, user stories, feature scope, data model, API contracts, component tree, and architecture decisions — into a single, comprehensive technical specification document. This is the document you would hand to a team to start building LaunchPad.
