# 02 — Essential Commands

Now that you have a mental model of how Git works, it is time to build muscle memory with the commands you will use every single day. This lesson covers the core Git commands for creating repositories, tracking changes, inspecting history, and temporarily shelving work. By the end, these commands will feel like second nature.

## What You'll Learn

- How to initialize repositories and make commits
- How to inspect changes with status, diff, and show
- How to read history with log and its many flags
- How to temporarily save work with stash

## Key Concepts

### git init: Starting a New Repository

Every Git project starts with `git init`. This creates the .git directory and sets up the internal data structures.

```
$ mkdir my-app && cd my-app
$ git init
Initialized empty Git repository in /home/user/my-app/.git/

$ ls -a
.  ..  .git
```

You now have an empty repository. No commits exist yet. The default branch (usually main) will be created when you make your first commit.

If you are working with an existing project from GitHub, you would use `git clone` instead:

```
$ git clone https://github.com/user/repo.git
Cloning into 'repo'...
remote: Enumerating objects: 150, done.
remote: Counting objects: 100% (150/150), done.
Receiving objects: 100% (150/150), 45.00 KiB | 1.50 MiB/s, done.
```

### git add: Moving Changes to the Staging Area

The `git add` command copies changes from the working tree into the staging area. It has several forms:

```
# Stage a specific file
$ git add src/index.ts

# Stage multiple specific files
$ git add src/index.ts package.json

# Stage all changes in a directory
$ git add src/

# Stage all tracked files that have been modified (not new untracked files)
$ git add -u

# Stage everything (use with caution)
$ git add .
```

You can also stage parts of a file using the patch flag:

```
$ git add -p src/index.ts
diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,5 @@
+import { helper } from './utils';
+
 const app = express();
Stage this hunk [y,n,q,a,d,s,e,?]?
```

Pressing `y` stages that hunk. Pressing `n` skips it. This is invaluable when you have made multiple unrelated changes in one file and want to split them into separate commits.

### git commit: Saving a Snapshot

Once your staging area looks right, you commit:

```
$ git commit -m "Add user authentication module"
[main 3a4b5c6] Add user authentication module
 3 files changed, 45 insertions(+), 2 deletions(-)
 create mode 100644 src/auth.ts
```

The -m flag provides the commit message inline. For longer messages, omit -m and Git will open your configured editor:

```
$ git commit
```

This opens your editor (vim, nano, VS Code, etc.) where you can write a multi-line message:

```
Add user authentication module

Implements JWT-based auth with login and signup endpoints.
Includes middleware for protecting routes.
```

Save and close the editor to complete the commit.

A few useful variations:

```
# Stage all tracked modified files and commit in one step
$ git commit -am "Fix typo in header"

# Create an empty commit (useful for triggering CI)
$ git commit --allow-empty -m "Trigger CI build"
```

### git status: Understanding Your Current State

This is the command you will run most often. It tells you exactly what is happening across the three areas:

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	modified:   src/index.ts

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   src/utils.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	src/helpers.ts
```

This output tells you:
- src/index.ts has been staged and is ready to be committed
- src/utils.ts has been modified but not staged
- src/helpers.ts is a new file that Git is not tracking yet

For a shorter view:

```
$ git status -s
M  src/index.ts
 M src/utils.ts
?? src/helpers.ts
```

The two columns mean: left column is the staging area status, right column is the working tree status. `M` means modified, `??` means untracked.

### git log: Reading History

The log command shows you the commit history:

```
$ git log
commit 3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b (HEAD -> main)
Author: Developer <dev@example.com>
Date:   Mon Nov 13 10:30:00 2024 +0000

    Add user authentication module

commit 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b
Author: Developer <dev@example.com>
Date:   Mon Nov 13 09:00:00 2024 +0000

    Initial commit
```

The default output is verbose. Here are the flags you will use constantly:

```
# Compact one-line format
$ git log --oneline
3a4b5c6 (HEAD -> main) Add user authentication module
1a2b3c4 Initial commit

# Show the branch graph
$ git log --oneline --graph --all
* 7d8e9f0 (feature/login) Add login form
* 5c6d7e8 Add login route
| * 3a4b5c6 (HEAD -> main) Add user authentication module
|/
* 1a2b3c4 Initial commit

# Show last N commits
$ git log --oneline -5

# Show commits by a specific author
$ git log --author="Developer"

# Show commits that changed a specific file
$ git log --oneline -- src/index.ts
3a4b5c6 Add user authentication module
1a2b3c4 Initial commit

# Show commits from the last week
$ git log --since="1 week ago" --oneline

# Show what files changed in each commit
$ git log --oneline --stat
3a4b5c6 Add user authentication module
 src/auth.ts    | 30 ++++++++++++++++++++++++++++++
 src/index.ts   |  3 ++-
 src/routes.ts  | 14 ++++++++++++++
 3 files changed, 46 insertions(+), 1 deletion(-)
```

The `--graph --all` combination is especially useful for understanding how branches relate to each other. Make it a habit.

### git diff: Seeing Exactly What Changed

The diff command compares the three areas:

```
# Working tree vs staging area (unstaged changes)
$ git diff
diff --git a/src/index.ts b/src/index.ts
index abc1234..def5678 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -10,6 +10,8 @@ const app = express();
 app.use(cors());
 app.use(express.json());

+app.use('/api/auth', authRouter);
+
 app.listen(3000, () => {
   console.log('Server running on port 3000');
 });
```

The lines starting with `+` are additions. Lines starting with `-` are deletions. Context lines (no prefix) show surrounding code.

```
# Staging area vs last commit (staged changes, ready to be committed)
$ git diff --staged
diff --git a/src/auth.ts b/src/auth.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/auth.ts
@@ -0,0 +1,30 @@
+import jwt from 'jsonwebtoken';
+...

# Working tree vs last commit (all changes, staged and unstaged combined)
$ git diff HEAD

# Compare two branches
$ git diff main..feature/login

# Compare a specific file between branches
$ git diff main..feature/login -- src/index.ts
```

Understanding the difference between `git diff` (unstaged), `git diff --staged` (staged), and `git diff HEAD` (everything) is critical. Run these three commands regularly before committing to make sure you are committing exactly what you intend.

### git show: Inspecting a Specific Commit

While `git log` shows you the list of commits, `git show` displays the details of one commit:

```
$ git show 3a4b5c6
commit 3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b
Author: Developer <dev@example.com>
Date:   Mon Nov 13 10:30:00 2024 +0000

    Add user authentication module

diff --git a/src/auth.ts b/src/auth.ts
new file mode 100644
...
```

You can use it with various references:

```
# Show the latest commit
$ git show HEAD

# Show the commit before the latest
$ git show HEAD~1

# Show a specific file at a specific commit
$ git show HEAD:src/index.ts

# Show just the commit message and stats, no diff
$ git show --stat 3a4b5c6
```

### git stash: Shelving Work Temporarily

Sometimes you are in the middle of something and need to switch branches, but you are not ready to commit. The stash saves your changes temporarily:

```
$ git status
On branch feature/login
Changes not staged for commit:
	modified:   src/login.ts
	modified:   src/styles.css

$ git stash
Saved working directory and index state WIP on feature/login: 3a4b5c6 Add login route

$ git status
On branch feature/login
nothing to commit, working tree clean
```

Your changes are saved. The working tree is clean. You can now switch branches, do whatever you need, and come back:

```
$ git checkout main
# ... do some work on main ...
$ git checkout feature/login

$ git stash pop
On branch feature/login
Changes not staged for commit:
	modified:   src/login.ts
	modified:   src/styles.css

Dropped refs/stash@{0} (abc123def456)
```

The `pop` command restores your changes and removes the stash entry. Use `apply` instead if you want to keep the stash entry around:

```
$ git stash apply
```

Managing multiple stashes:

```
# Save with a descriptive message
$ git stash push -m "login form validation WIP"

# List all stashes
$ git stash list
stash@{0}: On feature/login: login form validation WIP
stash@{1}: WIP on main: 1a2b3c4 Initial commit

# Apply a specific stash
$ git stash apply stash@{1}

# Drop a specific stash
$ git stash drop stash@{0}

# Clear all stashes
$ git stash clear
```

Stashing also supports including untracked files:

```
# Include untracked files in the stash
$ git stash push -u -m "includes new files"

# Include everything, even ignored files
$ git stash push -a -m "includes everything"
```

## Step by Step

### Step 1: Set up a fresh practice repo

If you have not already initialized the app directory as a Git repo from lesson 01, do so now:

```
$ cd app/
$ git init
$ git add package.json src/index.ts tsconfig.json
$ git commit -m "Initial commit"
```

### Step 2: Practice the edit-stage-commit cycle

Create a new file and go through the full workflow:

```
$ echo 'export function add(a: number, b: number) { return a + b; }' > src/utils.ts
$ git status
$ git diff
$ git add src/utils.ts
$ git diff --staged
$ git commit -m "Add utils module with add function"
$ git log --oneline
```

### Step 3: Practice reading history

```
$ git log --oneline --graph --all
$ git show HEAD
$ git show HEAD:src/utils.ts
$ git log --stat
```

### Step 4: Practice stashing

```
$ echo 'export function multiply(a: number, b: number) { return a * b; }' >> src/utils.ts
$ git stash push -m "multiply function WIP"
$ git status
$ git stash list
$ git stash pop
$ git status
```

## Exercise

1. Make three separate commits: add a new file src/helpers.ts, modify src/index.ts, and modify src/utils.ts, each in their own commit
2. Run `git log --oneline --stat` to see the summary of all commits
3. Use `git show` to inspect the second commit you made
4. Modify two files, stage only one, then run `git diff` and `git diff --staged` to see the difference
5. Stash some work, create and commit a different change, then pop the stash and commit that too
6. Run `git log --oneline --graph` and read the history you have built

## Summary

The essential Git commands form a daily workflow: `git status` to understand where you are, `git add` to stage changes, `git commit` to save snapshots, `git log` to read history, `git diff` to inspect changes, `git show` to examine specific commits, and `git stash` to temporarily shelve work. These commands all operate on the three areas from lesson 01: the working tree, staging area, and repository. Once you internalize the flow of data between these areas, every command becomes intuitive.
