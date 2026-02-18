/**
 * Git Without Fear - Course 12
 * A conceptual course about Git workflows, branching, and team collaboration.
 */

export const courseName = "Git Without Fear";
export const courseDescription =
  "Version Control, Branching, and Team Workflows";

export interface GitCommand {
  name: string;
  description: string;
  example: string;
}

export const essentialCommands: GitCommand[] = [
  {
    name: "git init",
    description: "Initialize a new Git repository",
    example: "git init my-project",
  },
  {
    name: "git clone",
    description: "Clone a remote repository",
    example: "git clone https://github.com/user/repo.git",
  },
  {
    name: "git branch",
    description: "List, create, or delete branches",
    example: "git branch feature/login",
  },
  {
    name: "git merge",
    description: "Merge a branch into the current branch",
    example: "git merge feature/login",
  },
  {
    name: "git rebase",
    description: "Reapply commits on top of another base",
    example: "git rebase main",
  },
  {
    name: "git stash",
    description: "Temporarily save uncommitted changes",
    example: "git stash push -m 'work in progress'",
  },
];

console.log(`Course: ${courseName}`);
console.log(`${courseDescription}`);
console.log(`\nEssential commands covered: ${essentialCommands.length}`);
