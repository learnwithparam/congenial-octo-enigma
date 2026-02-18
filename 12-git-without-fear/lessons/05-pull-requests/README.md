# 05 — Pull Requests

Pull requests (PRs) are where code becomes a team sport. A PR is not a Git feature; it is a platform feature provided by GitHub, GitLab, and similar services. It wraps the act of merging a branch into a structured review process. This lesson covers how to create PRs from the command line using the GitHub CLI, how to write descriptions that reviewers actually want to read, and the workflow for reviewing and merging code.

## What You'll Learn

- What a pull request actually is and why it exists
- How to create PRs from the terminal using the gh CLI
- How to write PR descriptions that make reviewers happy
- The code review workflow: requesting reviews, giving feedback, approving
- Squash merge vs merge commit vs rebase merge
- Keeping PRs small and focused

## Key Concepts

### What is a Pull Request?

A pull request is a request to merge one branch into another, wrapped in a discussion thread. It provides:

- A diff showing all the changes
- A place for reviewers to leave comments, both general and line-specific
- Status checks from CI/CD pipelines
- An approval workflow before merging
- A permanent record of why and how changes were made

The typical flow:

```
1. Create a feature branch
2. Push the branch to the remote
3. Open a pull request targeting main
4. Reviewers examine the code and leave feedback
5. Author addresses feedback with additional commits
6. Reviewers approve
7. The PR is merged
8. The feature branch is deleted
```

### Setting Up the GitHub CLI

The GitHub CLI (gh) lets you manage pull requests without leaving your terminal. Install it first:

```
# macOS
$ brew install gh

# Verify installation
$ gh --version
gh version 2.40.0 (2024-01-15)

# Authenticate
$ gh auth login
? What account do you want to log into? GitHub.com
? What is your preferred protocol for Git operations? HTTPS
? Authenticate Git with your GitHub credentials? Yes
? How would you like to authenticate GitHub CLI? Login with a web browser

! First copy your one-time code: XXXX-XXXX
Press Enter to open github.com in your browser...
✓ Authentication complete.
```

### Creating a Pull Request with gh

After pushing your feature branch, create a PR:

```
# First, push your branch
$ git push -u origin feat/user-profile
Enumerating objects: 8, done.
Counting objects: 100% (8/8), done.
Writing objects: 100% (6/6), 1.20 KiB | 1.20 MiB/s, done.
Total 6 (delta 2), reused 0 (delta 0)
remote: Resolving deltas: 100% (2/2), done.
To https://github.com/user/repo.git
 * [new branch]      feat/user-profile -> feat/user-profile
Branch 'feat/user-profile' set up to track remote branch 'feat/user-profile' from 'origin'.

# Create the PR
$ gh pr create --title "Add user profile page" --body "## Summary
- Adds a new /profile route
- Displays user name, email, and avatar
- Includes responsive layout for mobile

## Test Plan
- Navigate to /profile after logging in
- Verify all user fields display correctly
- Test on mobile viewport sizes"

Creating pull request for feat/user-profile into main in user/repo

https://github.com/user/repo/pull/42
```

The gh CLI has several useful flags:

```
# Create with interactive prompts
$ gh pr create

# Create as a draft PR (not ready for review yet)
$ gh pr create --draft --title "WIP: Add user profile"

# Assign reviewers
$ gh pr create --title "Add user profile" --reviewer teammate1,teammate2

# Add labels
$ gh pr create --title "Add user profile" --label "feature,frontend"

# Target a specific base branch (defaults to main)
$ gh pr create --base develop --title "Add user profile"
```

### Writing Good PR Descriptions

A good PR description answers three questions: what changed, why it changed, and how to verify it works. Here is a template:

```
## Summary
Brief explanation of what this PR does and why.

## Changes
- List of specific changes made
- Each change as a separate bullet point
- Group related changes together

## Screenshots (if applicable)
Include before/after screenshots for UI changes.

## Test Plan
- Step-by-step instructions for testing
- Include edge cases to verify
- Mention any automated tests added

## Notes for Reviewers
- Anything reviewers should pay special attention to
- Known limitations or trade-offs
- Related PRs or issues
```

A real example:

```
## Summary
Adds user profile page that displays account information.
Closes #34.

## Changes
- New ProfilePage component at src/pages/profile.tsx
- New useUserProfile hook for fetching profile data
- Added /profile route to the router configuration
- Added profile link to the navigation menu

## Test Plan
- Log in with a test account
- Click the profile link in the nav menu
- Verify name, email, and avatar display correctly
- Log out and navigate to /profile directly, verify redirect to login

## Notes for Reviewers
- The avatar upload feature will come in a follow-up PR
- I chose to use a custom hook instead of a context because the profile
  data is only needed on this one page
```

### The Code Review Workflow

Reviewing PRs from the command line:

```
# List open PRs
$ gh pr list
Showing 3 of 3 open pull requests in user/repo

#42  Add user profile page      feat/user-profile
#41  Fix login redirect          fix/login-redirect
#40  Update dependencies         chore/deps

# View a specific PR
$ gh pr view 42
Add user profile page #42
Open - user wants to merge 3 commits into main from feat/user-profile

  ## Summary
  Adds user profile page that displays account information.

  ## Changes
  - New ProfilePage component
  ...

# Check out a PR locally for testing
$ gh pr checkout 42
remote: Enumerating objects: 8, done.
Switched to branch 'feat/user-profile'

# View the diff
$ gh pr diff 42
diff --git a/src/pages/profile.tsx b/src/pages/profile.tsx
new file mode 100644
...
```

Leaving a review:

```
# Approve a PR
$ gh pr review 42 --approve --body "Looks good! Clean implementation."

# Request changes
$ gh pr review 42 --request-changes --body "A few things to address:
- The useUserProfile hook should handle the loading state
- Missing error boundary for failed API calls"

# Leave a comment without approving or requesting changes
$ gh pr review 42 --comment --body "Left some suggestions, but nothing blocking."
```

After the author addresses feedback, they push new commits to the same branch, and the PR automatically updates:

```
# Author fixes the issues
$ git add src/hooks/useUserProfile.ts
$ git commit -m "Add loading and error states to useUserProfile"
$ git push
```

### Merging a Pull Request

There are three ways to merge a PR on GitHub, each with different effects on history:

Merge commit (the default):

```
$ gh pr merge 42 --merge
✓ Merged pull request #42 (Add user profile page)
```

This creates a merge commit with two parents. The full branch history is preserved:

```
*   f6a7b8c Merge pull request #42
|\
| * d4e5f6a Add loading states
| * c3d4e5f Add profile page
|/
* b2c3d4e Previous commit on main
```

Squash merge:

```
$ gh pr merge 42 --squash
✓ Squashed and merged pull request #42 (Add user profile page)
```

All commits from the branch are combined into a single commit on main:

```
* e5f6a7b Add user profile page (#42)
* b2c3d4e Previous commit on main
```

Squash merging is popular because it keeps the main branch history clean. Each PR becomes exactly one commit.

Rebase merge:

```
$ gh pr merge 42 --rebase
✓ Rebased and merged pull request #42 (Add user profile page)
```

Each commit from the branch is replayed individually onto main (no merge commit):

```
* d5e6f7a Add loading states
* c4d5e6f Add profile page
* b2c3d4e Previous commit on main
```

This gives a linear history while preserving individual commits.

After merging, delete the remote branch:

```
$ gh pr merge 42 --squash --delete-branch
✓ Squashed and merged pull request #42 (Add user profile page)
✓ Deleted branch feat/user-profile

# Clean up the local branch too
$ git checkout main
$ git pull
$ git branch -d feat/user-profile
```

### Keeping PRs Small and Focused

Large PRs are hard to review and more likely to introduce bugs. Aim for:

- Under 400 lines of changes (excluding generated files and tests)
- One logical change per PR
- If a feature is large, break it into multiple PRs that build on each other

```
# Instead of one massive PR:
PR #1: "Add user profile page" (all at once, 2000 lines)

# Break it into smaller PRs:
PR #1: "Add useUserProfile hook and API endpoint" (150 lines)
PR #2: "Add ProfilePage component with basic layout" (200 lines)
PR #3: "Add avatar upload to profile page" (180 lines)
PR #4: "Add profile link to navigation" (50 lines)
```

Each PR can be reviewed, tested, and merged independently. If PR #3 has issues, PRs #1 and #2 are already merged and delivering value.

### Other Useful gh Commands

```
# Check CI status of a PR
$ gh pr checks 42
All checks were successful
0 failing, 2 successful, 0 skipped, and 0 pending checks

✓  build     1m30s
✓  lint      45s

# Add a comment to a PR
$ gh pr comment 42 --body "Updated the hook, ready for re-review"

# Mark a draft PR as ready for review
$ gh pr ready 42

# Close a PR without merging
$ gh pr close 42

# Reopen a closed PR
$ gh pr reopen 42

# Edit the PR title or body
$ gh pr edit 42 --title "Add user profile page and hook"
```

## Step by Step

### Step 1: Create a repository on GitHub

```
# If you do not have a remote yet, create one
$ gh repo create my-git-practice --public --source=. --push
✓ Created repository user/my-git-practice on GitHub
✓ Added remote origin
✓ Pushed commits to origin/main
```

### Step 2: Create a feature branch and push it

```
$ git checkout -b feat/add-helpers
$ echo 'export function greet(name: string) { return "Hello " + name; }' > src/helpers.ts
$ git add src/helpers.ts
$ git commit -m "Add greet helper function"
$ git push -u origin feat/add-helpers
```

### Step 3: Create a PR

```
$ gh pr create --title "Add greet helper function" --body "## Summary
Adds a greet function to the helpers module.

## Test Plan
- Import and call greet('World'), verify output"
```

### Step 4: View and merge the PR

```
$ gh pr view
$ gh pr merge --squash --delete-branch
$ git checkout main
$ git pull
```

## Exercise

1. Create a feature branch with 2-3 commits
2. Push the branch and create a pull request using gh pr create
3. View the PR details with gh pr view
4. Check the PR diff with gh pr diff
5. If working with a partner, have them review your PR; otherwise, approve it yourself
6. Merge the PR using squash merge and delete the branch
7. Pull main and verify the squashed commit appears in your local history

## Summary

Pull requests transform Git merging into a collaborative review process. The gh CLI lets you create, review, and merge PRs without leaving your terminal. Good PR descriptions explain the what, why, and how to test. Keep PRs small and focused for faster reviews and fewer bugs. Choose squash merge for clean history, merge commits for preserved branch history, or rebase merge for linear history with individual commits. The PR workflow, combined with CI checks and code review, is the backbone of professional software development.
