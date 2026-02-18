# 07 — Undo and Recover

This is the lesson that earns the course its name. The fear most developers have around Git comes from the belief that mistakes are permanent, that a wrong command can destroy their work forever. The truth is that Git is designed to keep your data safe, and almost everything can be recovered. This lesson covers every tool Git gives you for undoing mistakes and recovering lost work.

## What You'll Learn

- git reset with its three modes: --soft, --mixed, and --hard
- git revert for safely undoing published commits
- git checkout and git restore for discarding file changes
- git reflog for finding and recovering "lost" commits
- When to use each undo tool
- A decision framework for "I made a mistake, now what?"

## Key Concepts

### Understanding Where Changes Live (Recap)

Before learning to undo, remember the three areas:

```
Working Tree  ──git add──>  Staging Area  ──git commit──>  Repository
                           (Index)                        (Commits)
```

Each undo command targets a different area. Knowing which area your change is in tells you which command to use.

### git restore: Discarding Working Tree Changes

The `git restore` command (introduced in Git 2.23) is the simplest undo tool. It discards changes in your working tree, replacing them with the version from the staging area or a specific commit.

Discard unstaged changes to a file:

```
$ git status
Changes not staged for commit:
	modified:   src/index.ts

$ git restore src/index.ts

$ git status
nothing to commit, working tree clean
```

The modified file is restored to match the staging area (which matches the last commit if you have not staged anything).

Unstage a file (move it from staging back to the working tree):

```
$ git add src/index.ts

$ git status
Changes to be committed:
	modified:   src/index.ts

$ git restore --staged src/index.ts

$ git status
Changes not staged for commit:
	modified:   src/index.ts
```

The change still exists in the working tree; it is just no longer staged.

Restore a file to a specific commit's version:

```
$ git restore --source HEAD~3 src/index.ts
```

This replaces the working tree version with whatever that file looked like three commits ago.

### git checkout for Files (Legacy Approach)

Before `git restore` existed, `git checkout` was used for this purpose. You will still see it in older documentation and scripts:

```
# Discard changes in working tree (same as git restore)
$ git checkout -- src/index.ts

# Restore from a specific commit
$ git checkout HEAD~3 -- src/index.ts
```

The `--` separates the commit reference from the file path, preventing ambiguity if a branch and file have the same name.

### git reset: Moving the Branch Pointer

The `reset` command is more powerful and more nuanced. It moves the current branch pointer to a different commit. The three modes control what happens to the staging area and working tree.

The three modes visualized:

```
                    Repository    Staging Area    Working Tree
git reset --soft      moves        unchanged       unchanged
git reset --mixed     moves        reset           unchanged
git reset --hard      moves        reset           reset
```

git reset --soft HEAD~1:

Moves the branch pointer back one commit. The staging area and working tree are untouched. The changes from the undone commit are now staged and ready to be recommitted.

```
$ git log --oneline
c3d4e5f (HEAD -> main) Add validation logic
b2c3d4e Add login form
a1b2c3d Initial commit

$ git reset --soft HEAD~1

$ git log --oneline
b2c3d4e (HEAD -> main) Add login form
a1b2c3d Initial commit

$ git status
Changes to be committed:
	modified:   src/validation.ts
```

The commit is gone from the branch, but the changes are staged. You can now modify them and recommit, or add more changes to the commit. This is perfect for "I committed too early" or "I want to combine this with the next change."

git reset --mixed HEAD~1 (the default):

Moves the branch pointer back and resets the staging area. Changes end up in the working tree as unstaged modifications.

```
$ git reset HEAD~1

$ git log --oneline
b2c3d4e (HEAD -> main) Add login form
a1b2c3d Initial commit

$ git status
Changes not staged for commit:
	modified:   src/validation.ts
```

The changes are in the working tree but not staged. You can selectively re-add parts of the change, make edits, and then commit. This is the default mode when you do not specify a flag.

git reset --hard HEAD~1:

Moves the branch pointer back and resets both the staging area and working tree. Changes are discarded.

```
$ git reset --hard HEAD~1

$ git log --oneline
b2c3d4e (HEAD -> main) Add login form
a1b2c3d Initial commit

$ git status
nothing to commit, working tree clean
```

The changes are gone from all three areas. This is the most destructive form of reset. Use it when you truly want to discard commits and their changes.

You can also reset to specific commits, not just relative positions:

```
# Reset to a specific commit hash
$ git reset --soft a1b2c3d

# Reset to where a branch points
$ git reset --mixed origin/main

# Reset to a tagged version
$ git reset --hard v1.0.0
```

### git reset for Unstaging (Without Moving HEAD)

A common use of reset is unstaging files without moving the branch pointer:

```
$ git add src/index.ts src/utils.ts

$ git status
Changes to be committed:
	modified:   src/index.ts
	modified:   src/utils.ts

# Unstage just one file
$ git reset HEAD src/utils.ts

$ git status
Changes to be committed:
	modified:   src/index.ts
Changes not staged for commit:
	modified:   src/utils.ts
```

This is equivalent to `git restore --staged src/utils.ts` but you will see it in older tutorials.

### git revert: Safely Undoing Published Commits

While reset rewrites history (moves the branch pointer backward), revert creates a new commit that undoes the changes of a previous commit. This is safe for shared branches because it does not change existing history.

```
$ git log --oneline
d4e5f6a (HEAD -> main) Add buggy feature
c3d4e5f Add validation logic
b2c3d4e Add login form

$ git revert d4e5f6a
[main e5f6a7b] Revert "Add buggy feature"
 1 file changed, 0 insertions(+), 15 deletions(-)

$ git log --oneline
e5f6a7b (HEAD -> main) Revert "Add buggy feature"
d4e5f6a Add buggy feature
c3d4e5f Add validation logic
b2c3d4e Add login form
```

The original commit still exists in history. A new commit has been added that reverses its changes. This is the correct way to undo something that has already been pushed to a shared branch.

You can revert multiple commits:

```
# Revert a range of commits (oldest to newest)
$ git revert c3d4e5f..d4e5f6a

# Revert without automatically committing (stage the reverts)
$ git revert --no-commit d4e5f6a
$ git revert --no-commit c3d4e5f
$ git commit -m "Revert buggy feature and validation changes"
```

Reverting a merge commit requires specifying which parent to keep:

```
$ git revert -m 1 f6a7b8c
```

The `-m 1` flag tells Git to keep the first parent (usually the main branch side) and undo the second parent's changes (the feature branch).

### git reflog: Your Safety Net

The reflog is Git's record of every time HEAD moved. Every commit, checkout, reset, rebase, and merge is logged. Even when you think you have "lost" a commit, the reflog usually still has it.

```
$ git reflog
e5f6a7b (HEAD -> main) HEAD@{0}: revert: Revert "Add buggy feature"
d4e5f6a HEAD@{1}: commit: Add buggy feature
c3d4e5f HEAD@{2}: commit: Add validation logic
b2c3d4e HEAD@{3}: commit: Add login form
a1b2c3d HEAD@{4}: commit (initial): Initial commit
```

Every entry shows a commit hash, what caused HEAD to move, and a description. The HEAD@{N} syntax lets you reference these entries.

Recovering from an accidental hard reset:

```
$ git log --oneline
c3d4e5f (HEAD -> main) Add validation logic
b2c3d4e Add login form
a1b2c3d Initial commit

# Oops! Accidentally reset too far back
$ git reset --hard a1b2c3d

$ git log --oneline
a1b2c3d (HEAD -> main) Initial commit

# Panic? No. Check the reflog.
$ git reflog
a1b2c3d (HEAD -> main) HEAD@{0}: reset: moving to a1b2c3d
c3d4e5f HEAD@{1}: commit: Add validation logic
b2c3d4e HEAD@{2}: commit: Add login form

# Recover by resetting to where you were before
$ git reset --hard c3d4e5f

$ git log --oneline
c3d4e5f (HEAD -> main) Add validation logic
b2c3d4e Add login form
a1b2c3d Initial commit
```

Everything is back. The reflog saved you.

Recovering a deleted branch:

```
$ git branch -D feature/experiment
Deleted branch feature/experiment (was f7a8b9c).

# The commit still exists, find it in the reflog
$ git reflog
... HEAD@{5}: checkout: moving from feature/experiment to main
f7a8b9c HEAD@{6}: commit: Experimental changes

# Recreate the branch at that commit
$ git branch feature/experiment f7a8b9c
```

The branch is back with all its commits.

Recovering from a bad rebase:

```
$ git reflog
b3c4d5e (HEAD -> feature) HEAD@{0}: rebase (finish): returning to refs/heads/feature
b3c4d5e HEAD@{1}: rebase (pick): Add feature
a2b3c4d HEAD@{2}: rebase (start): checkout main
e6f7a8b HEAD@{3}: commit: Add feature    # <-- this is where you were before the rebase

$ git reset --hard e6f7a8b
```

Reflog entries expire after 90 days by default (30 days for entries not reachable from any branch). This means you have a generous window to recover from mistakes.

### Decision Framework: Which Undo Tool to Use

Here is a quick reference for common scenarios:

```
Scenario                                          Command
────────────────────────────────────────────      ─────────────────────────
Discard unstaged changes to a file                git restore <file>
Unstage a file (keep the working tree change)     git restore --staged <file>
Undo the last commit, keep changes staged         git reset --soft HEAD~1
Undo the last commit, keep changes unstaged       git reset HEAD~1
Undo the last commit, discard all changes         git reset --hard HEAD~1
Undo a published commit (safe for shared branch)  git revert <commit>
Recover from an accidental reset or delete        git reflog + git reset
Find a lost commit or branch                      git reflog
```

The big decision: reset vs revert.

- Use reset when the commits have NOT been pushed (or only you are working on the branch).
- Use revert when the commits HAVE been pushed to a shared branch.

Reset rewrites history, which causes problems for anyone who has already pulled the old history. Revert adds new history, which is safe for everyone.

## Step by Step

### Step 1: Practice git restore

```
$ cd app/
$ echo "temporary change" >> src/index.ts
$ git status
$ git restore src/index.ts
$ git status
```

### Step 2: Practice the three reset modes

```
# Make three commits
$ echo "commit 1" > src/one.ts && git add . && git commit -m "feat: add one"
$ echo "commit 2" > src/two.ts && git add . && git commit -m "feat: add two"
$ echo "commit 3" > src/three.ts && git add . && git commit -m "feat: add three"

$ git log --oneline

# Soft reset: commit is gone, changes are staged
$ git reset --soft HEAD~1
$ git status
$ git log --oneline

# Recommit
$ git commit -m "feat: add three (recommitted)"

# Mixed reset: commit is gone, changes are unstaged
$ git reset HEAD~1
$ git status
$ git log --oneline

# Hard reset: commit is gone, changes are discarded
$ git add . && git commit -m "feat: add three (again)"
$ git reset --hard HEAD~1
$ git status
$ git log --oneline
```

### Step 3: Practice git revert

```
$ echo "buggy code" > src/bug.ts && git add . && git commit -m "feat: add buggy code"
$ git log --oneline

$ git revert HEAD
$ git log --oneline
# Notice the new revert commit
```

### Step 4: Use the reflog to recover

```
# Check your reflog
$ git reflog

# Try an accidental hard reset
$ git reset --hard HEAD~3
$ git log --oneline

# Recover using reflog
$ git reflog
# Find the commit you want to return to
$ git reset --hard HEAD@{1}
$ git log --oneline
```

## Exercise

1. Create 5 commits with different changes
2. Use `git reset --soft HEAD~1` to undo the last commit, modify the staged changes, and recommit
3. Use `git reset --mixed HEAD~1` and selectively re-add only part of the changes
4. Use `git reset --hard HEAD~1` and then recover the commit using `git reflog`
5. Use `git revert` to undo a commit in the middle of your history (not just the latest one)
6. Intentionally delete a branch, then recover it using the reflog
7. Run `git reflog` and read through it to understand the full record of HEAD movements

## Summary

Git provides a layered set of undo tools, each appropriate for different situations. Use `git restore` to discard working tree changes or unstage files. Use `git reset --soft` to uncommit while keeping changes staged, `--mixed` to uncommit and unstage, and `--hard` to discard everything. Use `git revert` when you need to undo a published commit safely. And when all else fails, `git reflog` is your safety net, recording every movement of HEAD so you can recover from almost any mistake. The key rule: use reset for local history, revert for shared history. With these tools, there is very little you can do in Git that cannot be undone.
