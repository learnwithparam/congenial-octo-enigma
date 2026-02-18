# Deploy to Vercel

You have built a complete startup directory app. It has search, filtering, forms, loading states, error handling, responsive design, and dark mode. But right now it only exists on your computer. In this final lesson, you will deploy LaunchPad to Vercel so anyone on the internet can use it. Deploying is the most satisfying part of building software: turning lines of code into a live product.

## What You Will Learn

- What Vercel is and why it is the best choice for Next.js apps
- Preparing your app for production
- Deploying via GitHub integration (recommended)
- Deploying via the Vercel CLI (alternative)
- Understanding the build process and what gets deployed
- Setting up a custom domain (optional)
- What to build next

## Concepts

### What Is Vercel

Vercel is the company behind Next.js. Their hosting platform is purpose-built for Next.js applications. It handles server components, API routes, edge functions, image optimization, and incremental static regeneration out of the box. You do not need to configure servers, containers, or reverse proxies.

The free tier (called Hobby) is generous enough for personal projects and portfolios. You get:
- Unlimited static sites
- Serverless function execution
- Automatic HTTPS
- Preview deployments for every pull request
- A `.vercel.app` subdomain

### Build vs Development

When you run `npm run dev`, Next.js serves your app in development mode with:
- Hot module replacement (changes appear instantly)
- Detailed error messages
- No optimization or minification
- Source maps for debugging

When you run `npm run build`, Next.js creates a production build:
- All pages are pre-rendered where possible
- JavaScript is minified and tree-shaken
- CSS is optimized
- Images are configured for lazy loading
- Server components are executed at build time or request time

The build output is what Vercel deploys.

### Preview Deployments

Every time you push to a branch that is not your main branch, Vercel creates a preview deployment with a unique URL. This lets you test changes before merging to production. Reviewers can see the actual running app, not just code diffs.

## Step by Step

### Step 1: Prepare Your App for Production

Before deploying, make sure the app builds cleanly. Run the build command locally:

```bash
npm run build
```

Watch the output carefully. Common issues that break production builds:

TypeScript errors: In development, Next.js shows type errors as warnings. In production builds, they become hard errors. Fix any TypeScript issues that appear.

Missing imports: If you imported something that does not exist, development might still work through hot reloading. A clean build will catch it.

ESLint errors: Next.js runs ESLint during the build. Fix any lint issues.

Image optimization: If you are using the `<Image>` component with external URLs, you need to configure the domains in `next.config.ts`.

If the build succeeds, you will see output like this:

```
Route (app)                              Size     First Load JS
┌ ○ /                                    5.2 kB        92 kB
├ ○ /categories                          1.8 kB        88 kB
├ ○ /startups                            3.1 kB        95 kB
├ ● /startups/[slug]                     2.4 kB        89 kB
├ ○ /submit                              4.3 kB        91 kB
└ ○ /not-found                           1.2 kB        88 kB
```

The symbols tell you how each route is rendered:
- `○` (static): Pre-rendered at build time. Fastest possible delivery.
- `●` (SSG): Pre-rendered with dynamic params using `generateStaticParams`.
- `λ` (dynamic): Rendered on every request. Used when the page needs request-time data.

### Step 2: Push Your Code to GitHub

If you have not already, initialize a Git repository and push to GitHub:

```bash
git init
git add .
git commit -m "LaunchPad v1 - ready for deployment"
```

Create a new repository on GitHub. You can do this through the GitHub website or using the GitHub CLI:

```bash
gh repo create launchpad --public --source=. --push
```

If you already have a repository, make sure all your changes are committed and pushed:

```bash
git add .
git commit -m "Add dark mode, responsive design, and final polish"
git push origin main
```

Make sure your `.gitignore` includes:

```
node_modules
.next
.env.local
.env
```

Do not commit `node_modules` or the `.next` build directory. They are large and Vercel will generate them during deployment.

### Step 3: Deploy via GitHub Integration (Recommended)

This is the easiest and most common approach.

1. Go to vercel.com and sign up (or log in) with your GitHub account.

2. Click "Add New Project" from your dashboard.

3. Vercel will show your GitHub repositories. Find and select your LaunchPad repository.

4. Vercel auto-detects that it is a Next.js project. The default settings are correct:
   - Framework Preset: Next.js
   - Build Command: `next build`
   - Output Directory: `.next`
   - Install Command: `npm install`

5. Click "Deploy".

6. Wait about 1-2 minutes. Vercel installs dependencies, runs the build, and deploys the output.

7. When it finishes, you get a URL like `launchpad-abc123.vercel.app`. Click it to see your live app.

That is it. Your app is on the internet.

Every future push to the `main` branch will trigger an automatic deployment. Push to any other branch and Vercel creates a preview deployment.

### Step 4: Deploy via Vercel CLI (Alternative)

If you prefer the command line, install the Vercel CLI:

```bash
npm install -g vercel
```

Then deploy from your project directory:

```bash
vercel
```

The CLI will ask you a series of questions:

```
? Set up and deploy? Yes
? Which scope? (your account)
? Link to existing project? No
? What's your project's name? launchpad
? In which directory is your code located? ./
? Want to modify these settings? No
```

The CLI uploads your code, builds it on Vercel's servers, and gives you a deployment URL.

For subsequent deployments:

```bash
vercel --prod
```

The `--prod` flag deploys to your production URL. Without it, you get a preview deployment.

### Step 5: Understand What Vercel Deployed

When Vercel deploys your Next.js app, it creates several things:

Static assets: Your CSS, JavaScript bundles, images, and fonts are uploaded to a global CDN. When users in Tokyo request your page, they get the static assets from a server near them, not from a server in the US.

Serverless functions: Any server components or API routes that need to run at request time are deployed as serverless functions. They spin up on demand, handle the request, and shut down. You do not pay for idle time.

Edge network: The routing layer that connects users to the right static asset or serverless function runs at the edge (close to the user).

For our LaunchPad app with mock data, most pages are statically generated. This means they load extremely fast because they are served directly from the CDN without running any server-side code.

### Step 6: Configure Environment Variables

Our current app does not use environment variables because we are using mock data. But when you connect to a real API or database later (in Course 05), you will need them.

To add environment variables in Vercel:

1. Go to your project dashboard on vercel.com.
2. Click "Settings" then "Environment Variables".
3. Add your variables. You can set different values for Production, Preview, and Development environments.

For example, when you later add a database:

```
DATABASE_URL = postgresql://...
NEXT_PUBLIC_APP_URL = https://your-domain.vercel.app
```

Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. All others are server-only. Never put secrets in `NEXT_PUBLIC_` variables.

After adding environment variables, you need to redeploy for them to take effect:

```bash
vercel --prod
```

Or push a new commit if using the GitHub integration.

### Step 7: Set Up a Custom Domain (Optional)

Vercel gives you a `.vercel.app` subdomain, but you can connect your own domain.

1. Go to your project's Settings on vercel.com.
2. Click "Domains".
3. Enter your domain name (e.g., `launchpad.dev`).
4. Vercel will give you DNS records to add at your domain registrar.

If you bought your domain through a registrar like Namecheap, Cloudflare, or Google Domains:
- Add the provided CNAME or A record
- Wait for DNS propagation (usually 5-30 minutes)
- Vercel automatically provisions an SSL certificate

If you do not have a domain, the `.vercel.app` URL works perfectly for portfolios and sharing.

### Step 8: Monitor Your Deployment

After deploying, check a few things:

1. Visit every page on the live site:
   - Homepage
   - /startups
   - /startups/[any-slug]
   - /categories
   - /submit
   - A nonexistent URL (should show your 404 page)

2. Toggle dark mode. Make sure the theme persists across page refreshes.

3. Test on your phone. Open the live URL in your mobile browser.

4. Try the search and filter functionality.

5. Submit the form and verify the success toast appears.

If something is broken in production but works locally, check:
- The Vercel deployment logs (in your project dashboard under "Deployments")
- The "Functions" tab for any serverless function errors
- The browser console for client-side errors

### Step 9: Run a Lighthouse Audit

Open your deployed site in Chrome. Open DevTools (F12), go to the Lighthouse tab, and run an audit. This gives you scores for:

- Performance: How fast the page loads
- Accessibility: How well it works for users with disabilities
- Best Practices: Security, modern standards
- SEO: How well search engines can index your site

A well-built Next.js app should score 90+ in all categories. If any score is low, Lighthouse tells you exactly what to fix.

Common Lighthouse improvements:
- Add `alt` text to all images
- Ensure color contrast ratios meet WCAG guidelines
- Use `next/image` for image optimization
- Add descriptive `title` and `description` metadata to each page

### Step 10: Celebrate

You shipped a real web application. It is live on the internet. Anyone with the URL can use it. Take a moment to appreciate what you built:

- A Next.js 15 application with the App Router
- Reusable components with TypeScript
- A mock data layer with an API pattern that is ready for a real backend
- Search and filtering with URL-based state
- Form handling with client-side validation
- Skeleton loading screens and error boundaries
- Fully responsive layout with mobile navigation
- Dark mode with persistent user preference
- Production deployment with continuous delivery

This is not a trivial project. These are the exact patterns used in production applications at real companies.

## What Comes Next

You have built the frontend. The mock data served its purpose: it let you focus on UI, components, routing, and user experience without worrying about backends and databases.

In future courses, you will:

Course 03 - REST APIs That Don't Suck: Build a production Express API with proper routing, middleware, validation, error handling, and authentication.

Course 04 - GraphQL from Scratch: Learn GraphQL server and client development with Apollo, including schemas, resolvers, queries, mutations, and subscriptions.

Course 05 - Connect the Dots: Wire your Next.js frontend to real APIs. Handle loading states, error boundaries, optimistic updates, and end-to-end data flow.

Course 06 - Schema Design with PostgreSQL: Design relational schemas, write migrations, model relationships, and query data with SQL and Drizzle ORM.

Each course builds on what you have here. The LaunchPad app you just deployed is the foundation.

## Try It Yourself

1. Share your deployed URL with a friend or post it on social media. Getting your work in front of real users is a skill in itself.

2. Set up a staging environment. Create a `staging` branch in Git, and push to it. Vercel will create a preview deployment that you can use for testing before merging to main.

3. Add a simple analytics tracking. Vercel has built-in Web Analytics (free for Hobby plans). Enable it in your project settings to see how many people visit your site.

4. Try breaking the build intentionally (add a TypeScript error) and push to a branch. Notice how Vercel catches the error in the preview deployment without affecting your production site.

## Key Takeaways

- Always run `npm run build` locally before deploying to catch errors early.
- The GitHub integration is the recommended way to deploy: push to main for production, push to branches for previews.
- Vercel auto-detects Next.js settings. You rarely need to change the defaults.
- Static pages are served from a global CDN for maximum speed. Dynamic pages run as serverless functions.
- Environment variables are managed in the Vercel dashboard and scoped to production, preview, or development.
- Run a Lighthouse audit on your deployed site to find and fix performance, accessibility, and SEO issues.
- Deploying is not the end. It is the beginning. Ship early, ship often, and iterate based on feedback.

## Wrapping Up

You started this course with an empty folder. Now you have a live web application built with modern tools and best practices. The patterns you learned here, component architecture, type safety, responsive design, dark mode, loading states, error handling, and deployment, are the same patterns used by professional developers every day.

The most important thing you can do now is keep building. Pick a project that excites you and apply what you have learned. The gap between a beginner and a professional is not knowledge. It is reps. Keep shipping.
