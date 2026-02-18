# 06 — Conventional Commits

Commit messages are the narrative of your project. A well-written history tells you not just what changed, but why, and what impact it has. Conventional Commits is a specification that adds structure to commit messages, making them readable by both humans and machines. This lesson covers the format, the reasoning behind it, and how it connects to semantic versioning and automated changelog generation.

## What You'll Learn

- The Conventional Commits specification and its format
- Common commit types: feat, fix, chore, docs, refactor, test, style, perf, ci, build
- How to indicate breaking changes
- How scopes work to narrow the context
- The connection between commit types and semantic versioning
- How structured commits enable automated changelog generation
- How to enforce conventional commits with tooling

## Key Concepts

### The Problem with Unstructured Commits

Look at this commit history and try to understand what happened:

```
$ git log --oneline
a8f9b0c stuff
b7e8c9d fix
c6d7e8f updates
d5c6d7e wip
e4b5c6d more changes
f3a4b5c fixed it
g2f3a4b done
```

This history is useless. You cannot tell what features were added, what bugs were fixed, or whether any change might break existing functionality. Now compare with this:

```
$ git log --oneline
a8f9b0c feat(auth): add password reset flow
b7e8c9d fix(cart): resolve quantity not updating on edit
c6d7e8f docs: update API reference for v2 endpoints
d5c6d7e chore: upgrade typescript to 5.3
e4b5c6d feat(search): add fuzzy matching to product search
f3a4b5c fix(auth): prevent session expiry during checkout
g2f3a4b feat!: redesign user profile API response shape
```

Every commit tells you exactly what it does. The last one even warns you about a breaking change with the exclamation mark. This is what Conventional Commits gives you.

### The Format

The Conventional Commits specification defines this structure:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

The first line is the most important:
- type: categorizes the change (feat, fix, chore, etc.)
- scope: optional, narrows the area of the codebase affected
- description: short summary in imperative mood ("add" not "added")

A complete example:

```
feat(auth): add email verification on signup

Users now receive a verification email after signing up.
The account remains in a "pending" state until the link
in the email is clicked.

Closes #127
```

### Commit Types

The core types:

feat - A new feature visible to the user. This is the type you use when adding functionality.

```
$ git commit -m "feat: add dark mode toggle to settings page"
$ git commit -m "feat(notifications): add push notification support"
```

fix - A bug fix. Something that was broken and is now working correctly.

```
$ git commit -m "fix: prevent crash when user profile is null"
$ git commit -m "fix(cart): correct total calculation with discount codes"
```

chore - Maintenance tasks that do not affect the application's behavior from the user's perspective. Dependency updates, configuration changes, and tooling updates fall here.

```
$ git commit -m "chore: upgrade eslint to v9"
$ git commit -m "chore: update .gitignore for new IDE files"
$ git commit -m "chore(deps): bump express from 4.18 to 4.19"
```

docs - Documentation changes only. README updates, code comments, API documentation.

```
$ git commit -m "docs: add contributing guidelines"
$ git commit -m "docs(api): document rate limiting behavior"
```

refactor - Code changes that neither fix a bug nor add a feature. Restructuring code, renaming variables, extracting functions.

```
$ git commit -m "refactor: extract validation logic into separate module"
$ git commit -m "refactor(auth): simplify token refresh logic"
```

test - Adding or modifying tests. No production code changes.

```
$ git commit -m "test: add integration tests for checkout flow"
$ git commit -m "test(auth): cover edge case for expired tokens"
```

style - Changes that do not affect the meaning of the code: formatting, whitespace, missing semicolons, etc.

```
$ git commit -m "style: format files with prettier"
$ git commit -m "style: fix indentation in config files"
```

perf - Performance improvements.

```
$ git commit -m "perf: lazy load product images below the fold"
$ git commit -m "perf(db): add index on users.email column"
```

ci - Changes to CI/CD configuration and scripts.

```
$ git commit -m "ci: add caching for node_modules in GitHub Actions"
$ git commit -m "ci: split test and lint into parallel jobs"
```

build - Changes that affect the build system or external dependencies.

```
$ git commit -m "build: switch from webpack to vite"
$ git commit -m "build: configure output directory for production builds"
```

### Scopes

Scopes narrow the context of a commit. They go in parentheses after the type:

```
feat(auth): add two-factor authentication
fix(cart): handle empty cart on checkout
refactor(api): consolidate error handling middleware
test(payments): add Stripe webhook integration tests
```

Choose scopes based on your project's architecture. Common approaches:

By feature area:
```
feat(auth): ...
feat(cart): ...
feat(search): ...
feat(notifications): ...
```

By technical layer:
```
fix(api): ...
fix(db): ...
fix(ui): ...
fix(middleware): ...
```

By package (in a monorepo):
```
feat(web): ...
feat(api): ...
feat(shared): ...
```

The key is consistency. Pick a set of scopes and stick to them across the team.

### Breaking Changes

When a commit introduces a change that is not backward-compatible, you must signal it. There are two ways:

Using an exclamation mark after the type (or scope):

```
$ git commit -m "feat!: change user API response from array to paginated object"
$ git commit -m "feat(api)!: require authentication for all endpoints"
```

Using a BREAKING CHANGE footer:

```
feat(api): change user list endpoint response format

The /api/users endpoint now returns a paginated response
object instead of a plain array.

BREAKING CHANGE: API consumers must update their code to
handle the new { data: [], total: number, page: number }
response shape instead of a plain array.
```

Both approaches are valid. The exclamation mark is quicker for the first line; the footer allows for a more detailed explanation of what breaks.

### Semantic Versioning Connection

Conventional Commits maps directly to semantic versioning (semver: MAJOR.MINOR.PATCH):

```
Commit Type          Version Bump      Example
─────────────────    ─────────────     ──────────────────
fix:                 PATCH (0.0.X)     1.2.3 -> 1.2.4
feat:                MINOR (0.X.0)     1.2.3 -> 1.3.0
BREAKING CHANGE      MAJOR (X.0.0)     1.2.3 -> 2.0.0
chore, docs, etc.    No release        1.2.3 -> 1.2.3
```

This mapping is why the specification exists. Tools can read your commit history and automatically determine the next version number:

```
$ git log --oneline v1.2.3..HEAD
a8f9b0c feat(auth): add password reset flow
b7e8c9d fix(cart): resolve quantity not updating

# Contains a feat commit -> MINOR bump -> v1.3.0
```

If any commit in the range has a breaking change, it becomes a MAJOR bump. If the highest-level change is a feat, it is a MINOR bump. If only fixes, it is a PATCH bump.

### Automated Changelog Generation

With structured commits, tools can automatically generate changelogs:

```
# Changelog for v1.3.0

## Features
- auth: add password reset flow (a8f9b0c)
- search: add fuzzy matching to product search (e4b5c6d)

## Bug Fixes
- cart: resolve quantity not updating on edit (b7e8c9d)
- auth: prevent session expiry during checkout (f3a4b5c)

## Documentation
- update API reference for v2 endpoints (c6d7e8f)

## Maintenance
- upgrade typescript to 5.3 (d5c6d7e)
```

This changelog was generated entirely from commit messages. No manual writing required.

Popular tools for this:
- conventional-changelog: generates changelogs from conventional commits
- semantic-release: fully automates versioning and publishing
- standard-version: bumps versions and generates changelogs
- release-please: Google's tool for automated releases via PR

### Writing Good Commit Messages

Beyond the type and scope, the description and body matter:

Use imperative mood (like giving a command):

```
# Good
feat: add user search endpoint
fix: prevent null pointer in profile handler

# Bad
feat: added user search endpoint
fix: fixed the null pointer issue
feat: adding search
```

Keep the first line under 72 characters:

```
# Good (54 characters)
feat(auth): add email verification on signup

# Bad (89 characters)
feat(auth): add email verification on signup that sends a link to the user's email address
```

Put details in the body, not the subject:

```
fix(payments): handle declined cards gracefully

Previously, a declined card would cause a 500 error and show the
user a generic error page. Now we catch the Stripe decline error,
display a user-friendly message, and allow them to try a different
payment method.

Closes #234
```

### Enforcing Conventional Commits

You can use Git hooks to prevent non-conventional commits from being made:

commitlint is a popular tool:

```
# Install
$ npm install --save-dev @commitlint/cli @commitlint/config-conventional

# Create config file commitlint.config.js
$ echo "module.exports = { extends: ['@commitlint/config-conventional'] };" > commitlint.config.js

# Set up a Git hook using husky
$ npm install --save-dev husky
$ npx husky init
$ echo "npx --no -- commitlint --edit \$1" > .husky/commit-msg
```

Now if someone tries a bad commit message:

```
$ git commit -m "fixed stuff"
⧗   input: fixed stuff
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]

✖   Found 2 problems, 0 warnings

$ git commit -m "fix: resolve null pointer in user handler"
✔   All good!
[main abc1234] fix: resolve null pointer in user handler
```

## Step by Step

### Step 1: Practice the format

Make a series of commits using different types:

```
$ cd app/

$ echo 'export function subtract(a: number, b: number) { return a - b; }' > src/math.ts
$ git add src/math.ts
$ git commit -m "feat: add subtract function to math module"

$ echo 'export function subtract(a: number, b: number): number { return a - b; }' > src/math.ts
$ git add src/math.ts
$ git commit -m "fix: add return type annotation to subtract"

$ echo '// Math utilities for the application' | cat - src/math.ts > temp && mv temp src/math.ts
$ git add src/math.ts
$ git commit -m "docs: add module description comment to math utils"
```

### Step 2: Use scopes

```
$ echo 'export const API_URL = "http://localhost:3000";' > src/config.ts
$ git add src/config.ts
$ git commit -m "feat(config): add API URL constant"

$ echo 'export const API_URL = "https://api.example.com";' > src/config.ts
$ git add src/config.ts
$ git commit -m "fix(config): use production API URL"
```

### Step 3: Review your structured history

```
$ git log --oneline
f7a8b9c fix(config): use production API URL
e6f7a8b feat(config): add API URL constant
d5e6f7a docs: add module description comment to math utils
c4d5e6f fix: add return type annotation to subtract
b3c4d5e feat: add subtract function to math module
```

## Exercise

1. Make 8-10 commits using at least 5 different conventional commit types
2. Use scopes on at least half of your commits
3. Write one commit with a multi-line body that explains the reasoning behind the change
4. Write one commit that indicates a breaking change using the exclamation mark syntax
5. Run `git log --oneline` and verify that the history reads like a structured changelog
6. Challenge: group your commits mentally by type and imagine what the auto-generated changelog would look like

## Summary

Conventional Commits adds a lightweight structure to commit messages that makes history readable and machine-parseable. The format is simple: type, optional scope, and description. The common types (feat, fix, chore, docs, refactor, test) categorize every change. Breaking changes get special notation with an exclamation mark or a footer. This structure maps directly to semantic versioning: fixes bump the patch version, features bump the minor version, and breaking changes bump the major version. Tools can then automate changelog generation and version bumps. The real benefit is a project history that tells a coherent story.
