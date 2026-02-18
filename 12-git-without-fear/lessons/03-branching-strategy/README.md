# 03 — Branching Strategy

Branches are one of Git's most powerful features, and they are incredibly cheap to create. A branch is just a 41-byte pointer to a commit. But having the ability to branch and having a strategy for branching are very different things. This lesson covers how teams organize their branches, the two dominant strategies in the industry, and the naming conventions that keep everything sane.

## What You'll Learn

- How Git branches work mechanically
- Feature branch workflow and why it is the foundation of modern development
- Git-flow: the structured approach for release-driven projects
- Trunk-based development: the fast-moving approach for CI/CD teams
- Branch naming conventions that your team will thank you for
- When to use long-lived vs short-lived branches

## Key Concepts

### How Branches Work

As we covered in lesson 01, a branch is a pointer to a commit. When you create a branch, Git creates a new pointer at the current commit:

```
$ git branch feature/signup

$ git log --oneline --all
a1b2c3d (HEAD -> main, feature/signup) Initial commit
```

Both main and feature/signup point to the same commit. Now switch to the new branch and make a commit:

```
$ git checkout feature/signup
Switched to branch 'feature/signup'

$ echo "signup form" > signup.ts
$ git add signup.ts
$ git commit -m "Add signup form"

$ git log --oneline --all --graph
* b2c3d4e (HEAD -> feature/signup) Add signup form
* a1b2c3d (main) Initial commit
```

The feature/signup pointer moved forward. The main pointer stayed where it was. This is the fundamental mechanic that everything else builds on.

You can also create and switch in one step:

```
$ git checkout -b feature/login
Switched to a new branch 'feature/login'

# Or with the newer switch command:
$ git switch -c feature/login
Switched to a new branch 'feature/login'
```

### The Feature Branch Workflow

The simplest and most widely used branching strategy is the feature branch workflow. The idea is straightforward:

1. The main branch always contains working, deployable code
2. Every new piece of work gets its own branch
3. When the work is done, the branch is merged back into main through a pull request
4. The feature branch is deleted after merging

```
main:     A ─── B ─────────── E (merge commit)
                 \           /
feature:          C ─── D ──
```

This workflow gives you:
- Isolation: your work does not affect others until you merge
- Code review: pull requests let teammates review before merging
- Clean history: each feature is a logical unit in the history
- Easy rollback: if a feature causes problems, you can revert the merge commit

Here is the workflow in commands:

```
# Start from an up-to-date main
$ git checkout main
$ git pull origin main

# Create a feature branch
$ git checkout -b feature/user-profile

# Do your work, commit as you go
$ git add src/profile.ts
$ git commit -m "Add user profile component"

$ git add src/profile.test.ts
$ git commit -m "Add tests for user profile"

# Push your branch to the remote
$ git push -u origin feature/user-profile

# Create a pull request (covered in lesson 05)
# After review and approval, merge into main
# Delete the feature branch
```

### Git-Flow: The Structured Approach

Git-flow was introduced by Vincent Driessen in 2010 and became very popular for projects with scheduled releases. It uses multiple long-lived branches:

```
main ────────────────────────────────────── (production releases)
  │                                    ▲
  │                                    │
develop ──────────────────────────── merge
  │         ▲          ▲         │
  │         │          │         │
  │     feature/a  feature/b  release/1.2
  │         │          │         │
  └─────────┘          │         │
                       └─────────┘
```

The branches in git-flow:

- main: always reflects production. Every commit is a release, tagged with a version number.
- develop: integration branch where features come together. This is where the next release takes shape.
- feature branches: branch off develop, merge back into develop when done.
- release branches: branch off develop when you are preparing a release. Only bug fixes go here. Merges into both main and develop.
- hotfix branches: branch off main for urgent production fixes. Merges into both main and develop.

```
# Starting a feature in git-flow
$ git checkout develop
$ git checkout -b feature/shopping-cart

# ... work and commit ...

$ git checkout develop
$ git merge feature/shopping-cart
$ git branch -d feature/shopping-cart

# Preparing a release
$ git checkout develop
$ git checkout -b release/1.2.0

# ... fix any last-minute bugs ...

$ git checkout main
$ git merge release/1.2.0
$ git tag v1.2.0

$ git checkout develop
$ git merge release/1.2.0
$ git branch -d release/1.2.0
```

Git-flow works well for:
- Software with versioned releases (desktop apps, libraries, mobile apps)
- Teams that need to maintain multiple release versions simultaneously
- Projects where releases go through QA stages

Git-flow is less ideal for:
- Web applications that deploy continuously
- Small teams that want to move fast
- Projects where main should always be deployable

### Trunk-Based Development: The Fast Approach

Trunk-based development is the opposite philosophy: everyone works on main (the "trunk"), and branches are extremely short-lived (hours, not days).

```
main:  A ── B ── C ── D ── E ── F ── G ── H
            \   /      \  /
         feature1    feature2
       (1-2 commits) (1 commit)
```

The rules are simple:
- main is always in a deployable state
- Feature branches live for no more than 1-2 days
- Branches have only 1-3 commits before merging
- Continuous integration runs on every push to main
- Feature flags hide incomplete work from users

```
# Typical trunk-based flow
$ git checkout main
$ git pull

$ git checkout -b feat/add-search-bar

# Work quickly, keep it small
$ git add .
$ git commit -m "Add search bar component"
$ git push -u origin feat/add-search-bar

# Open PR, get quick review, merge same day
# The feature might be behind a feature flag if incomplete
```

Trunk-based development works well for:
- Web applications with continuous deployment
- Teams with strong CI/CD pipelines
- Organizations that value fast feedback loops
- Teams practicing pair programming (less review overhead)

Trunk-based development is harder when:
- Your CI pipeline is slow
- Your team does not have good test coverage
- Large features cannot be broken into small increments

### Branch Naming Conventions

Good branch names communicate intent at a glance. The most common convention uses a type prefix followed by a slash and a descriptive name:

```
feat/user-authentication
feat/shopping-cart
fix/login-redirect-loop
fix/null-pointer-on-empty-cart
chore/upgrade-typescript-5
chore/clean-up-unused-imports
docs/api-reference
refactor/extract-payment-service
test/add-integration-tests-for-orders
```

The prefixes:
- feat/ or feature/ — new functionality
- fix/ or bugfix/ — bug fixes
- chore/ — maintenance tasks (dependency updates, configuration)
- docs/ — documentation changes
- refactor/ — code restructuring without behavior changes
- test/ — adding or updating tests

Some teams also include ticket numbers:

```
feat/PROJ-123-user-authentication
fix/PROJ-456-login-redirect
```

Rules for good branch names:
- Use lowercase letters
- Separate words with hyphens (not underscores or spaces)
- Keep it concise but descriptive
- Include the ticket/issue number if your team uses them
- Never use special characters or spaces

### Long-Lived vs Short-Lived Branches

Long-lived branches persist for weeks or months. Examples include main, develop, staging, and production. Short-lived branches exist for days at most. Feature branches, bugfix branches, and hotfix branches should all be short-lived.

The longer a branch lives, the more it diverges from the main line, and the harder it becomes to merge:

```
# A short-lived branch (good)
main:     A ── B ── C ── D
               \        /
feature:        E ── F

# A long-lived feature branch (painful)
main:     A ── B ── C ── D ── E ── F ── G ── H
               \
feature:        I ── J ── K ── L ── M ── N ── O
# Merging this branch will likely have many conflicts
```

The solution for unavoidable long-lived branches is to regularly merge main into your feature branch (or rebase onto main) to keep them from diverging too far:

```
# On your long-running feature branch
$ git checkout feature/big-refactor
$ git merge main
# Resolve any conflicts now while they are small

# Or with rebase (discussed in lesson 04)
$ git rebase main
```

Do this frequently, at least every day or two, to keep conflicts manageable.

## Step by Step

### Step 1: Create feature branches

Starting from the app directory with your initial commit:

```
$ git checkout -b feat/add-utils
Switched to a new branch 'feat/add-utils'

$ echo 'export const VERSION = "1.0.0";' > src/version.ts
$ git add src/version.ts
$ git commit -m "Add version constant"
```

### Step 2: Create a second branch from main

```
$ git checkout main
$ git checkout -b fix/update-description
$ echo '// Updated description' >> src/index.ts
$ git add src/index.ts
$ git commit -m "Update project description"
```

### Step 3: Visualize the branches

```
$ git log --oneline --graph --all
* abc1234 (HEAD -> fix/update-description) Update project description
| * def5678 (feat/add-utils) Add version constant
|/
* 111aaaa (main) Initial commit
```

### Step 4: Merge a branch back into main

```
$ git checkout main
$ git merge feat/add-utils
$ git log --oneline --graph --all
$ git branch -d feat/add-utils
```

## Exercise

1. Create three feature branches from main: feat/helpers, feat/config, and fix/typo
2. Make at least one commit on each branch
3. Switch between branches using `git checkout` or `git switch` and observe how your working tree changes
4. Merge all three branches back into main one at a time
5. Run `git log --oneline --graph --all` after each merge to see the graph evolve
6. Delete the merged branches with `git branch -d`
7. Run `git branch` to confirm only main remains

## Summary

Branching strategies give structure to how your team collaborates. Feature branches provide isolation and enable code review. Git-flow adds release management for versioned software. Trunk-based development prioritizes speed and small changes for continuous deployment. Regardless of which strategy you choose, consistent naming conventions (feat/, fix/, chore/) and short-lived branches reduce merge conflicts and keep your repository history clean. The right strategy depends on your team size, release cadence, and CI/CD maturity.
