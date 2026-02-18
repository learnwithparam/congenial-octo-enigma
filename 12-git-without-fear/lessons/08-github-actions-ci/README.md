# 08 — GitHub Actions CI

Continuous Integration (CI) is the practice of automatically building and testing your code every time someone pushes changes. GitHub Actions is GitHub's built-in CI/CD platform that lets you define workflows as YAML files in your repository. This lesson covers how to set up CI pipelines that run tests, lint code, cache dependencies, and report status, all triggered automatically on pushes and pull requests.

## What You'll Learn

- What GitHub Actions is and how it fits into the CI/CD workflow
- The structure of workflow files in .github/workflows/
- Trigger events: push, pull_request, and others
- Jobs, steps, and the runner environment
- Running tests and linters automatically
- Caching node_modules for faster builds
- Adding status badges to your repository

## Key Concepts

### What is CI and Why Does It Matter?

Without CI, the process looks like this:

```
Developer pushes code -> Someone remembers to run tests -> Maybe they pass
```

With CI:

```
Developer pushes code -> Automated pipeline runs tests, lint, type-check ->
  Pass: green checkmark, safe to merge
  Fail: red X, cannot merge until fixed
```

CI catches bugs before they reach the main branch. It enforces quality standards automatically. It gives the team confidence that merged code works.

### The .github/workflows/ Directory

GitHub Actions workflows are YAML files stored in your repository:

```
my-project/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy.yml
│       └── release.yml
├── src/
├── package.json
└── ...
```

Each YAML file in .github/workflows/ defines a separate workflow. GitHub automatically discovers and runs them based on their trigger conditions.

### Anatomy of a Workflow File

Here is a basic CI workflow:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test
```

Let us break down each section.

### name: The Workflow Name

```yaml
name: CI
```

This is the display name that appears in the GitHub Actions tab. Choose something descriptive. You will see it on every PR and in the repository's Actions page.

### on: Trigger Events

The `on` section defines when the workflow runs:

```yaml
# Run on pushes to main and on all pull requests targeting main
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

Common trigger configurations:

```yaml
# Run on push to any branch
on: push

# Run on push to specific branches
on:
  push:
    branches: [main, develop]

# Run on pull requests
on:
  pull_request:
    branches: [main]

# Run on both push and PR
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Run on a schedule (cron syntax)
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM UTC

# Run manually from the GitHub UI
on:
  workflow_dispatch:

# Run only when specific files change
on:
  push:
    paths:
      - 'src/**'
      - 'package.json'
    branches: [main]

# Ignore certain paths
on:
  push:
    paths-ignore:
      - '**.md'
      - 'docs/**'
    branches: [main]
```

For most projects, triggering on push to main and on pull_request is the right default. This ensures that every PR is tested before merging, and the main branch is verified after merging.

### jobs: The Units of Work

A workflow contains one or more jobs. Each job runs on a fresh virtual machine (called a runner):

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx tsc --noEmit
```

By default, jobs run in parallel. This means lint, test, and typecheck all start at the same time, which is faster than running them sequentially.

If one job needs to wait for another, use the `needs` keyword:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - run: npm run deploy
```

The deploy job only runs after the test job passes, and only on the main branch.

### steps: The Individual Commands

Each job contains a sequence of steps. Steps run sequentially within a job. A step is either an action (uses) or a shell command (run):

```yaml
steps:
  # An action step: uses a pre-built action from the marketplace
  - name: Checkout code
    uses: actions/checkout@v4

  # A run step: executes a shell command
  - name: Install dependencies
    run: npm ci

  # Multi-line run step
  - name: Run tests with coverage
    run: |
      npm test -- --coverage
      echo "Tests complete"

  # Step with environment variables
  - name: Run integration tests
    run: npm run test:integration
    env:
      DATABASE_URL: postgres://localhost:5432/testdb
      NODE_ENV: test
```

The `name` field is optional but recommended. It appears in the GitHub UI and makes debugging much easier.

### Runner Environments

GitHub provides hosted runners with common operating systems:

```yaml
# Linux (most common for Node.js projects)
runs-on: ubuntu-latest

# macOS
runs-on: macos-latest

# Windows
runs-on: windows-latest
```

You can also test across multiple versions using a matrix:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]

    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

This runs the test job three times in parallel, once for each Node.js version. If any version fails, the whole matrix fails.

### Caching node_modules

Installing dependencies is often the slowest part of a CI pipeline. Caching speeds this up dramatically:

```yaml
jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
```

The `cache: 'npm'` option in the setup-node action automatically caches the npm cache directory. On subsequent runs, if package-lock.json has not changed, dependencies install in seconds instead of minutes.

For more control, you can use the cache action directly:

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Cache node_modules
    uses: actions/cache@v4
    with:
      path: node_modules
      key: node-modules-${{ hashFiles('package-lock.json') }}
      restore-keys: |
        node-modules-

  - name: Install dependencies
    run: npm ci

  - name: Run tests
    run: npm test
```

The cache key is based on the hash of package-lock.json. When the lock file changes (new dependencies), a new cache is created. When it has not changed, the cached node_modules is restored.

The output when cache is hit:

```
Run actions/cache@v4
  Cache restored from key: node-modules-abc123def456
```

The output when cache is missed:

```
Run actions/cache@v4
  Cache not found for key: node-modules-xyz789
  ...
Post actions/cache@v4
  Cache saved with key: node-modules-xyz789
```

### A Complete CI Workflow

Here is a production-ready CI workflow for a TypeScript project:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run TypeScript compiler
        run: npx tsc --noEmit

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Upload coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
```

This runs lint, typecheck, and test in parallel. Each job is independent and fails or passes on its own. The coverage report is uploaded as an artifact even if the test step fails (because of `if: always()`).

### Status Badges

Status badges show the current state of your workflow in your README or anywhere else. They are a quick visual indicator that your main branch is healthy.

The badge URL format:

```
https://github.com/{owner}/{repo}/actions/workflows/{workflow-file}/badge.svg
```

Add it to your README:

```markdown
![CI](https://github.com/user/my-project/actions/workflows/ci.yml/badge.svg)
```

You can also scope badges to a specific branch:

```markdown
![CI](https://github.com/user/my-project/actions/workflows/ci.yml/badge.svg?branch=main)
```

The badge automatically updates to show a green "passing" or red "failing" indicator based on the latest workflow run.

You can find the badge URL by:

```
$ gh run list --limit 1
STATUS  TITLE              WORKFLOW  BRANCH  EVENT        ID          ELAPSED  AGE
✓       Add user profile   CI        main    push         1234567890  2m30s    5m

# Or navigate to:
# Repository -> Actions tab -> Click workflow name -> "..." menu -> "Create status badge"
```

### Protecting Branches with Required Checks

CI becomes most powerful when combined with branch protection rules. You can require that CI passes before a PR can be merged:

```
# Using gh CLI to set up branch protection
$ gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["lint","test","typecheck"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}'
```

Or configure it in the GitHub UI:
1. Go to Settings -> Branches
2. Add a branch protection rule for main
3. Enable "Require status checks to pass before merging"
4. Select the specific checks (lint, test, typecheck)
5. Enable "Require branches to be up to date before merging"

Now if anyone opens a PR and CI fails, the merge button is disabled:

```
$ gh pr checks 42
Some checks were not successful
1 failing, 2 successful, 0 skipped, and 0 pending checks

✓  lint        45s
✗  test        1m30s
✓  typecheck   30s
```

The PR cannot be merged until the test job passes.

### Secrets and Environment Variables

For steps that need API keys or other sensitive values:

```yaml
steps:
  - name: Deploy to production
    run: npm run deploy
    env:
      DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
      API_KEY: ${{ secrets.API_KEY }}
```

Add secrets through the GitHub UI (Settings -> Secrets and variables -> Actions) or via the CLI:

```
$ gh secret set DEPLOY_TOKEN
? Paste your secret: ****
✓ Set secret DEPLOY_TOKEN for user/repo
```

Secrets are encrypted and never exposed in logs. If a step tries to print a secret, GitHub automatically masks it with asterisks.

### Workflow Tips and Patterns

Cancel in-progress runs when a new push arrives (saves runner time):

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

Run a step only on the main branch:

```yaml
- name: Deploy
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  run: npm run deploy
```

Set a timeout to prevent hung jobs:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
```

Use composite actions for reusable step sequences:

```yaml
# .github/actions/setup/action.yml
name: 'Setup'
description: 'Checkout, setup Node, install deps'
runs:
  using: 'composite'
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    - run: npm ci
      shell: bash
```

Then use it in your workflow:

```yaml
steps:
  - name: Setup
    uses: ./.github/actions/setup
  - run: npm test
```

## Step by Step

### Step 1: Create the workflow directory

```
$ cd app/
$ mkdir -p .github/workflows
```

### Step 2: Create a basic CI workflow

Create the file .github/workflows/ci.yml with this content:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
```

### Step 3: Commit and push

```
$ git add .github/workflows/ci.yml
$ git commit -m "ci: add GitHub Actions CI workflow"
$ git push origin main
```

### Step 4: Verify the workflow runs

```
$ gh run list --limit 5
STATUS  TITLE                          WORKFLOW  BRANCH  EVENT  ID          ELAPSED  AGE
✓       ci: add GitHub Actions CI...   CI        main    push   1234567890  1m15s    2m

$ gh run view 1234567890
✓ main CI · 1234567890
Triggered via push about 2 minutes ago

JOBS
✓ build-and-test in 1m15s (ID 9876543210)
```

### Step 5: Add more jobs

Expand the workflow to separate lint, typecheck, and test into parallel jobs. Update the ci.yml file following the complete example shown earlier in this lesson.

## Exercise

1. Create a .github/workflows/ci.yml file in the app directory
2. Configure it to trigger on pushes to main and on pull requests
3. Add a job that installs dependencies and runs the test script
4. Add a second parallel job that runs a typecheck (npx tsc --noEmit)
5. Commit the workflow file with a conventional commit message
6. If you have a GitHub remote set up, push and verify the workflow runs with `gh run list`
7. Add caching for node_modules using the setup-node cache option
8. Add a status badge URL to a comment in your README or index.ts

## Summary

GitHub Actions automates your CI pipeline with workflow files stored in .github/workflows/. Workflows trigger on events like push and pull_request. Jobs run on virtual machines and contain sequential steps that execute shell commands or pre-built actions. Running lint, typecheck, and tests in parallel catches problems quickly. Caching node_modules dramatically speeds up builds. Status badges provide at-a-glance health indicators. Combined with branch protection rules, CI ensures that broken code never reaches the main branch. The investment in setting up CI pays for itself many times over in bugs caught, confidence gained, and time saved debugging production issues.
