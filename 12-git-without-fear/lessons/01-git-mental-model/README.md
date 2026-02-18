# 01 — Git Mental Model

Most developers learn Git by memorizing commands. That approach works until something goes wrong, and then panic sets in. This lesson builds a solid mental model of how Git actually works under the hood. Once you understand the three areas where your files live, how commits form a graph, and what HEAD really means, every Git command becomes predictable.

## What You'll Learn

- The three areas of Git: working tree, staging area (index), and repository
- How commits form a directed acyclic graph (DAG)
- What HEAD is and how it moves
- How refs (branches, tags) are just pointers to commits
- Why commits are snapshots, not diffs

## Key Concepts

### The Three Areas

Every Git repository has three distinct areas where your files exist in different states. Understanding this is the single most important thing you can learn about Git.

```
  Working Tree          Staging Area           Repository
  (your files)          (the index)            (.git directory)
 ┌─────────────┐      ┌─────────────┐       ┌─────────────┐
 │             │      │             │       │             │
 │  Edit files │─────>│  git add    │──────>│  git commit │
 │  here       │      │  prepares   │       │  saves      │
 │             │      │  snapshot   │       │  permanently│
 │             │<─────│             │<──────│             │
 │             │      │             │       │             │
 └─────────────┘      └─────────────┘       └─────────────┘
   git checkout          git reset            stored as
   / restore             (unstage)            commit objects
```

The working tree is the actual directory on your filesystem. These are the files you open in your editor. When you modify a file, you are changing the working tree.

The staging area (also called the index) is a file inside .git that stores information about what will go into your next commit. When you run `git add`, you are copying a snapshot of the file from the working tree into the staging area.

The repository is the .git directory itself. It contains every commit ever made, stored as objects. When you run `git commit`, Git takes what is in the staging area and stores it permanently.

Let us see this in action:

```
$ mkdir my-project && cd my-project
$ git init
Initialized empty Git repository in /home/user/my-project/.git/

$ echo "Hello World" > greeting.txt

$ git status
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	greeting.txt

nothing added to commit but untracked files present (use "git add" to track)
```

The file exists only in the working tree. Git sees it but is not tracking it.

```
$ git add greeting.txt

$ git status
On branch main

No commits yet

Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
	new file:   greeting.txt
```

Now the file is in the staging area. Git has taken a snapshot of its contents.

```
$ git commit -m "Add greeting"
[main (root-commit) a1b2c3d] Add greeting
 1 file changed, 1 insertion(+)
 create mode 100644 greeting.txt
```

The snapshot is now permanently stored in the repository. All three areas are in sync.

### Why the Staging Area Exists

The staging area lets you craft precise commits. Suppose you changed three files but only two changes are related. You can stage just those two and commit them together, leaving the third change for a separate commit.

```
$ echo "line 1" > file-a.txt
$ echo "line 2" > file-b.txt
$ echo "line 3" > file-c.txt

$ git add file-a.txt file-b.txt
$ git commit -m "Add file-a and file-b"

$ git add file-c.txt
$ git commit -m "Add file-c"
```

This results in two focused commits instead of one messy one. Clean commits make your project history readable and make it easy to revert specific changes later.

### The Directed Acyclic Graph (DAG)

Every commit in Git points back to its parent commit (or parents, in the case of a merge). This forms a graph structure:

```
A <── B <── C <── D       (main)
                   \
                    E <── F   (feature)
```

This is a directed acyclic graph (DAG). Directed because each commit points to its parent (backward in time). Acyclic because you can never follow the parent pointers and end up back where you started. This structure is what makes Git fast and reliable.

Each letter above represents a commit. Commit D knows that C is its parent. Commit C knows B is its parent. Commit E also knows D is its parent, because the feature branch was created at D.

You can visualize this in your terminal:

```
$ git log --oneline --graph --all
* f3e4d5a (feature) Add login form
* b2c3d4e Add login route
| * d4e5f6a (HEAD -> main) Update README
|/
* a1b2c3d Initial commit
```

The asterisks and lines show you the graph structure. Branches diverge and can later converge through merges.

### What is a Commit, Really?

A commit is a snapshot of your entire project at a point in time. This is a common misconception: Git does not store diffs. It stores complete snapshots.

When you make a commit, Git stores:
- A tree object: a snapshot of every file and directory at that moment
- A pointer to the parent commit(s)
- Author name and email
- Committer name and email
- The commit message
- A timestamp

You can inspect any commit:

```
$ git cat-file -p HEAD
tree 4b825dc642cb6eb9a060e54bf899d67f50b7c123
parent a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
author Developer <dev@example.com> 1700000000 +0000
committer Developer <dev@example.com> 1700000000 +0000

Add greeting
```

The tree entry points to the complete snapshot. Git is smart about storage: if a file has not changed between commits, Git reuses the same blob object. So while each commit conceptually contains the full project, the actual storage is efficient.

### HEAD: Where You Are Right Now

HEAD is a pointer that tells Git which commit you are currently working on. Most of the time, HEAD points to a branch name, which in turn points to a commit.

```
HEAD -> main -> d4e5f6a
```

When you make a new commit, the branch pointer moves forward, and HEAD follows along:

```
Before commit:
HEAD -> main -> d4e5f6a

After commit:
HEAD -> main -> e5f6a7b -> d4e5f6a
```

You can always see where HEAD is:

```
$ git log --oneline -1
e5f6a7b (HEAD -> main) Latest commit message

$ cat .git/HEAD
ref: refs/heads/main
```

HEAD normally points to a branch reference. When you checkout a specific commit (not a branch), you enter "detached HEAD" state, where HEAD points directly to a commit hash instead of a branch name. This is something we will explore more in lesson 07.

### Refs: Branches and Tags Are Just Pointers

A branch in Git is not a heavy object. It is a 41-byte file containing a commit hash. That is it.

```
$ cat .git/refs/heads/main
d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3
```

When you create a new branch, Git creates a new file with the current commit hash:

```
$ git branch feature/login
$ cat .git/refs/heads/feature/login
d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3
```

Both main and feature/login now point to the same commit. They will diverge as you make new commits on one or the other.

Tags work similarly, but they do not move. A branch pointer advances when you commit. A tag stays put forever, marking a specific point in history (like a release).

```
$ git tag v1.0.0
$ cat .git/refs/tags/v1.0.0
d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3
```

### The .git Directory

Everything Git knows about your repository lives in the .git directory:

```
$ ls .git/
HEAD            config          hooks/          objects/
branches/       description     info/           refs/
```

The objects directory stores all the data: commits, trees (directories), and blobs (file contents). The refs directory stores branch and tag pointers. The HEAD file tells Git where you are.

You never need to edit these files by hand, but knowing they exist removes the mystery. Git is not magic. It is a content-addressable filesystem with a version control interface on top.

## Step by Step

### Step 1: Initialize a practice repository

Navigate to the app directory and initialize a Git repository:

```
$ cd app/
$ git init
Initialized empty Git repository in .../12-git-without-fear/app/.git/
```

### Step 2: Observe the three areas

Check the status, stage a file, and commit:

```
$ git status
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	package.json
	src/
	tsconfig.json

$ git add package.json src/index.ts tsconfig.json
$ git status
On branch main

No commits yet

Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
	new file:   package.json
	new file:   src/index.ts
	new file:   tsconfig.json

$ git commit -m "Initial commit"
[main (root-commit) abc1234] Initial commit
 3 files changed, 50 insertions(+)
```

### Step 3: Explore the object store

```
$ git log --oneline
abc1234 (HEAD -> main) Initial commit

$ git cat-file -t abc1234
commit

$ git cat-file -p abc1234
tree 9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e
author You <you@example.com> 1700000000 +0000
committer You <you@example.com> 1700000000 +0000

Initial commit
```

### Step 4: Make changes and watch the areas diverge

```
$ echo "// TODO: add more features" >> src/index.ts
$ git status
On branch main
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   src/index.ts

$ git diff
diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -49,3 +49,4 @@
+// TODO: add more features
```

The working tree has changed, but the staging area still matches the last commit. Use `git add` to move the change into staging, then `git commit` to store it permanently.

## Exercise

1. In the app directory, initialize a git repository if you have not already
2. Create your initial commit with the existing files
3. Create a new file called `src/utils.ts` with a simple helper function
4. Use `git status` at each step to observe which area your changes are in
5. Use `git diff` and `git diff --staged` to see the difference between working tree vs staging, and staging vs last commit
6. Commit your new file
7. Run `git log --oneline` and `git cat-file -p HEAD` to inspect your commit
8. Look inside `.git/refs/heads/` to see your branch pointer

## Summary

Git has three areas: the working tree (your files), the staging area (preparation zone), and the repository (permanent history). Files flow from left to right as you edit, add, and commit. Commits are full snapshots of your project, linked together in a directed acyclic graph. HEAD tells you where you are, and branches are lightweight pointers that move forward as you commit. Understanding this model turns every Git command from a mysterious incantation into a predictable operation on a simple data structure.
