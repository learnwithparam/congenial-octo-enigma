# 04 — Merge vs Rebase

Every developer eventually faces the question: should I merge or rebase? Both integrate changes from one branch into another, but they do it in fundamentally different ways and leave different histories behind. This lesson explains both mechanics in detail, introduces interactive rebase for cleaning up commits, and covers the golden rule that will keep you out of trouble.

## What You'll Learn

- How fast-forward merges work and when they happen
- How three-way merges work and what a merge commit is
- How rebase replays commits onto a new base
- Interactive rebase for squashing, rewording, and reordering commits
- The golden rule: never rebase public branches
- When to choose merge vs rebase

## Key Concepts

### Fast-Forward Merge

A fast-forward merge is the simplest case. It happens when the branch you are merging into has not moved since you branched off. Git simply moves the pointer forward:

```
Before:
main:     A ── B
                \
feature:         C ── D

After git merge feature (from main):
main:     A ── B ── C ── D
                         ^
                       (main, feature)
```

No new commit is created. The main pointer just slides forward to where feature already is.

```
$ git checkout main
$ git merge feature/add-utils
Updating a1b2c3d..c3d4e5f
Fast-forward
 src/utils.ts | 5 +++++
 1 file changed, 5 insertions(+)
 create mode 100644 src/utils.ts
```

Notice the word "Fast-forward" in the output. This tells you no merge commit was created.

If you always want a merge commit even when a fast-forward is possible (for a cleaner record in the history), use the --no-ff flag:

```
$ git merge --no-ff feature/add-utils
Merge branch 'feature/add-utils'
```

This creates a merge commit even though it was not strictly necessary. Some teams prefer this because it preserves the fact that work was done on a branch.

### Three-Way Merge

When both branches have new commits, Git cannot fast-forward. It performs a three-way merge, using three points of reference: the common ancestor, the tip of the current branch, and the tip of the branch being merged.

```
Before:
main:     A ── B ── E
                \
feature:         C ── D

After git merge feature (from main):
main:     A ── B ── E ── F (merge commit)
                \       /
feature:         C ── D
```

Git finds the common ancestor (B), compares what changed on each branch since B, and combines the changes into a new merge commit (F). This merge commit has two parents: E and D.

```
$ git checkout main
$ git merge feature/login
Merge made by the 'ort' strategy.
 src/login.ts | 25 +++++++++++++++++++++++++
 1 file changed, 25 insertions(+)
 create mode 100644 src/login.ts

$ git log --oneline --graph
*   f6a7b8c (HEAD -> main) Merge branch 'feature/login'
|\
| * d4e5f6a (feature/login) Add login form
| * c3d4e5f Add login route
|/
* b2c3d4e Update README
* a1b2c3d Initial commit
```

### Merge Conflicts

Sometimes both branches change the same lines in the same file. Git cannot automatically decide which version to keep, so it marks the conflict:

```
$ git merge feature/header-update
Auto-merging src/header.ts
CONFLICT (content): Merge conflict in src/header.ts
Automatic merge failed; fix conflicts and then commit the result.
```

The conflicted file will contain markers:

```
<<<<<<< HEAD
const title = "My Application";
=======
const title = "My Awesome App";
>>>>>>> feature/header-update
```

Everything between `<<<<<<< HEAD` and `=======` is what exists on your current branch. Everything between `=======` and `>>>>>>> feature/header-update` is what exists on the incoming branch.

To resolve:
1. Edit the file and choose what the final version should be
2. Remove all conflict markers
3. Stage the resolved file
4. Commit

```
# After editing the file to resolve the conflict:
$ git add src/header.ts
$ git commit -m "Merge feature/header-update, keep updated title"
```

You can also abort a merge in progress:

```
$ git merge --abort
```

### How Rebase Works

Rebase takes a different approach. Instead of creating a merge commit, it replays your commits on top of the target branch, one by one:

```
Before:
main:     A ── B ── E
                \
feature:         C ── D

After git rebase main (from feature):
main:     A ── B ── E
                     \
feature:              C' ── D'
```

Notice that C and D become C' and D'. They are new commits with new hashes because their parent has changed (from B to E). The content of the changes is the same, but they are technically different commits.

```
$ git checkout feature/login
$ git rebase main
Successfully rebased and updated refs/heads/feature/login.

$ git log --oneline --graph
* d5e6f7a (HEAD -> feature/login) Add login form
* c4d5e6f Add login route
* b2c3d4e (main) Update README
* a1b2c3d Initial commit
```

The history is now linear. It looks as if you started the feature branch from the latest main commit, even though you actually started it earlier.

After rebasing, you can now fast-forward merge into main:

```
$ git checkout main
$ git merge feature/login
Updating b2c3d4e..d5e6f7a
Fast-forward
```

### Rebase Conflicts

Rebase can also encounter conflicts. Since it replays commits one at a time, you might need to resolve conflicts for each commit:

```
$ git rebase main
CONFLICT (content): Merge conflict in src/index.ts
error: could not apply c3d4e5f... Add login route
hint: Resolve all conflicts manually, mark them as resolved with
hint: "git add/rm <conflicted_files>", then run "git rebase --continue".
hint: You can instead skip this commit: "git rebase --skip".
hint: To check out the original branch and stop rebasing, run "git rebase --abort".
```

The workflow for resolving:

```
# Edit the conflicted files
$ git add src/index.ts
$ git rebase --continue
# Git applies the next commit, which might also conflict
# Repeat until all commits are replayed

# Or abort the entire rebase:
$ git rebase --abort
```

### Interactive Rebase

Interactive rebase is one of Git's most powerful features. It lets you rewrite history by squashing, rewording, reordering, or dropping commits before sharing them.

```
$ git log --oneline
f7a8b9c Fix typo
e6f7a8b Add login validation
d5e6f7a Add login form
c4d5e6f Add login route

$ git rebase -i HEAD~4
```

This opens your editor with:

```
pick c4d5e6f Add login route
pick d5e6f7a Add login form
pick e6f7a8b Add login validation
pick f7a8b9c Fix typo

# Rebase b2c3d4e..f7a8b9c onto b2c3d4e (4 commands)
#
# Commands:
# p, pick = use commit as is
# r, reword = use commit, but edit the commit message
# e, edit = use commit, but stop for amending
# s, squash = use commit, but meld into previous commit
# f, fixup = like squash, but discard this commit's message
# d, drop = remove commit
```

Common operations:

Squash multiple commits into one:

```
pick c4d5e6f Add login route
squash d5e6f7a Add login form
squash e6f7a8b Add login validation
fixup f7a8b9c Fix typo
```

This combines all four commits into one. The `squash` keyword keeps the commit message for you to edit. The `fixup` keyword discards the commit message (perfect for typo fixes).

After saving and closing the editor, Git opens another editor to let you write the combined commit message:

```
# This is a combination of 4 commits.
# This is the 1st commit message:

Add login route

# This is the commit message #2:

Add login form

# This is the commit message #3:

Add login validation

# The commit message #4 will be skipped (fixup):
# Fix typo
```

You can edit this to produce a clean, single message:

```
Add login feature with route, form, and validation
```

Reword a commit message:

```
pick c4d5e6f Add login route
reword d5e6f7a Add login form
pick e6f7a8b Add login validation
```

Git will stop after applying d5e6f7a and open your editor to change its message.

Reorder commits:

```
pick e6f7a8b Add login validation
pick c4d5e6f Add login route
pick d5e6f7a Add login form
```

Just rearrange the lines. Be careful: reordering can cause conflicts if later commits depend on earlier ones.

Drop a commit entirely:

```
pick c4d5e6f Add login route
pick d5e6f7a Add login form
drop e6f7a8b Add login validation
pick f7a8b9c Fix typo
```

### The Golden Rule: Never Rebase Public Branches

This is the most important rule about rebase: never rebase commits that have been pushed to a shared remote and that other people may have based work on.

Why? Because rebase creates new commits with new hashes. If someone else has based their work on the original commits, rebasing will cause those original commits to disappear from the branch. The other developer's history will diverge from the remote, causing confusion and potential data loss.

```
# SAFE: rebasing your local feature branch onto main before pushing
$ git checkout feature/my-work
$ git rebase main
$ git push origin feature/my-work

# SAFE: rebasing a feature branch that only you work on
$ git checkout feature/my-solo-work
$ git rebase main
$ git push --force-with-lease origin feature/my-solo-work

# DANGEROUS: rebasing main or any shared branch
$ git checkout main
$ git rebase some-branch   # DO NOT DO THIS
```

The `--force-with-lease` flag is safer than `--force` because it will refuse to push if someone else has pushed to the same branch since your last fetch.

### When to Use Merge vs Rebase

Use merge when:
- Integrating a completed feature branch into main (via a pull request)
- You want to preserve the full history of how work was done
- Multiple people are working on the same branch
- You want a clear record of when branches were combined

Use rebase when:
- Updating your feature branch with the latest changes from main
- Cleaning up your commit history before opening a pull request
- You want a linear, easy-to-read history
- You are the only person working on the branch

A common team workflow combines both:
1. While working on a feature, rebase onto main regularly to stay current
2. Before opening a PR, interactive rebase to clean up commits
3. Merge (or squash merge) the PR into main through the GitHub UI

## Step by Step

### Step 1: Set up branches for practice

```
$ cd app/
$ git checkout main

# Create a commit on main
$ echo '// config' > src/config.ts
$ git add src/config.ts
$ git commit -m "Add config file"

# Create a feature branch and add commits
$ git checkout -b feat/new-feature
$ echo '// feature code' > src/feature.ts
$ git add src/feature.ts
$ git commit -m "Add feature module"

$ echo '// more feature code' >> src/feature.ts
$ git add src/feature.ts
$ git commit -m "Extend feature module"
```

### Step 2: Try a fast-forward merge

```
$ git checkout main
$ git merge feat/new-feature
# This should fast-forward since main has not moved
```

### Step 3: Set up for a three-way merge

```
$ git checkout main
$ git reset --hard HEAD~2  # Go back before the merge

$ echo '// main work' > src/main-work.ts
$ git add src/main-work.ts
$ git commit -m "Add main work"

$ git merge feat/new-feature
# This will create a merge commit (three-way merge)
```

### Step 4: Try rebasing instead

```
$ git checkout main
$ git reset --hard HEAD~1  # Undo the merge

$ git checkout feat/new-feature
$ git rebase main
$ git log --oneline --graph --all

$ git checkout main
$ git merge feat/new-feature
# Now it fast-forwards after the rebase
```

### Step 5: Practice interactive rebase

```
$ git checkout -b feat/messy-history
$ echo "a" > src/a.ts && git add . && git commit -m "Add a"
$ echo "b" > src/b.ts && git add . && git commit -m "Add b"
$ echo "a fixed" > src/a.ts && git add . && git commit -m "Fix typo in a"

$ git rebase -i HEAD~3
# Change the last commit to "fixup" to combine it with "Add a"
```

## Exercise

1. Create a feature branch with 4-5 small commits
2. Create a divergent commit on main
3. Try merging the feature branch (observe the merge commit)
4. Undo the merge with `git reset --hard HEAD~1`
5. Rebase the feature branch onto main instead, then merge (observe the fast-forward)
6. Create another branch with messy commits and use interactive rebase to squash them into clean, logical commits
7. Use `git log --oneline --graph --all` throughout to watch the graph change

## Summary

Merge and rebase are two strategies for integrating work. Merge preserves history as it actually happened, creating merge commits where branches converge. Rebase rewrites history to be linear, replaying commits onto a new base. Fast-forward merges happen when there is no divergence. Three-way merges combine divergent branches. Interactive rebase lets you squash, reword, reorder, and drop commits to craft a clean history. The golden rule: never rebase commits that others have based their work on. Most teams combine both approaches, rebasing locally for cleanliness and merging through pull requests for the official record.
