# Refactoring with AI

Refactoring is the process of restructuring code without changing its behavior. It is essential for maintaining a healthy codebase, but it is also tedious and error-prone when done manually. AI tools excel at refactoring because the task is well-defined: the inputs and outputs stay the same, only the internal structure changes. In this lesson, you will learn how to use AI to extract functions, rename symbols, restructure code, and improve type definitions while keeping everything working.

## What You Will Learn

- How to use AI for safe, systematic refactoring
- Techniques for extracting functions, splitting files, and improving structure
- How to refactor types and interfaces for better expressiveness
- How to verify that refactoring did not change behavior
- When to refactor with AI versus by hand

## Key Concepts

### Refactoring Safety

The golden rule of refactoring is that behavior must not change. This means you need a way to verify that the refactored code produces the same output as the original. For our codebase, we can run `npm run dev` before and after the refactoring and compare the output. In a production codebase, you would rely on tests.

When asking AI to refactor, always specify that behavior must be preserved. Without this instruction, the AI might "improve" the code by changing edge case behavior.

### The Refactoring Conversation

Refactoring with AI works best as a conversation, not a single prompt. Start with the simplest refactoring, verify it, then move to the next. This mirrors the professional practice of making small, atomic commits during refactoring.

## Step by Step

### Step 1: Capture the Current Output

Before any refactoring, capture the current program output:

```bash
npm run dev
```

Save this output somewhere. After every refactoring step, run the program again and compare. If the output changes, the refactoring introduced a bug.

### Step 2: Extract Helper Functions

The `calculateStats` function does several things: it copies and sorts the array, calculates the total, calculates the mean, and calculates the median. Ask the AI to extract each calculation into its own function:

```
> Refactor calculateStats in src/index.ts by extracting the median
> calculation into a separate helper function called calculateMedian.
> It should take a sorted number array and return the median. The
> behavior of calculateStats must not change.
```

The AI should produce:

```ts
function calculateMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculateStats(scores: number[]): Stats {
  if (scores.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, total: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const total = sorted.reduce((sum, val) => sum + val, 0);
  const mean = total / sorted.length;

  return {
    mean,
    median: calculateMedian(sorted),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    total,
  };
}
```

Run `npm run dev` and verify the output is identical.

### Step 3: Rename for Clarity

Ask the AI to improve naming throughout the file:

```
> Review all variable names in src/index.ts and suggest renames
> that would make the code more readable. Do not rename the exported
> function names or interface names, only internal variables and
> parameters. Show me the suggestions before making changes.
```

The AI might suggest:

- In `calculateStats`: rename `val` to `score` in the reduce callback for clarity
- In `formatUserReport`: rename the array of lines to `reportLines` instead of using an anonymous array
- The parameter `scores` in `calculateStats` is clear and should stay as is

The "show me before making changes" instruction is important. For renaming, you want to review the suggestions first because naming is subjective. Accept the changes that improve readability and reject any that do not.

### Step 4: Improve Type Definitions

Ask the AI to make the types more expressive:

```
> Improve the TypeScript types in src/index.ts. Consider:
> - Adding readonly modifiers where mutation should not happen
> - Making the Stats interface fields readonly
> - Creating a branded type or more specific type for the email field
> - Adding JSDoc comments to all interface fields
> Do not change the runtime behavior.
```

The AI might produce:

```ts
interface UserData {
  /** Unique identifier for the user */
  readonly id: number;
  /** Display name */
  readonly name: string;
  /** Email address */
  readonly email: string;
  /** List of numeric scores */
  readonly scores: readonly number[];
  /** Whether the user account is currently active */
  readonly active: boolean;
}

interface Stats {
  /** Arithmetic mean of all scores */
  readonly mean: number;
  /** Middle value when scores are sorted */
  readonly median: number;
  /** Lowest score */
  readonly min: number;
  /** Highest score */
  readonly max: number;
  /** Sum of all scores */
  readonly total: number;
}
```

Adding `readonly` modifiers is a refactoring that strengthens the type system without changing runtime behavior. If any code was accidentally mutating these objects, the TypeScript compiler will now catch it.

Run `npx tsc` to verify the types are valid.

### Step 5: Extract Into Modules

As a codebase grows, keeping everything in one file becomes unwieldy. Ask the AI to split the code:

```
> Propose a plan to split src/index.ts into multiple files. The demo
> code should stay in index.ts, the interfaces should go to types.ts,
> the stats functions should go to stats.ts, and the user functions
> should go to users.ts. Show me the file structure and the import
> relationships before making changes.
```

The AI should propose:

```
src/
  types.ts      — UserData, Stats, and any other interfaces
  stats.ts      — calculateStats, calculateMedian
  users.ts      — filterActiveUsers, formatUserReport
  index.ts      — imports from the other modules + demo code
```

Review the plan, then ask the AI to execute it:

```
> That looks good. Go ahead and split the files as proposed. Make sure
> to use ESM import syntax with .js extensions for the relative imports
> as specified in our CLAUDE.md coding conventions.
```

After the split, run both `npx tsc` and `npm run dev` to verify nothing broke.

### Step 6: Refactor Control Flow

The `formatUserReport` function builds a string by joining an array. Ask the AI to refactor it to use a template approach instead:

```
> Refactor formatUserReport to use a template-based approach. Define
> a report template as a function that takes the computed values and
> returns the formatted string. The output must be identical to the
> current implementation.
```

The AI might produce:

```ts
function buildReport(data: {
  name: string;
  email: string;
  active: boolean;
  scores: number[];
  stats: Stats;
}): string {
  return [
    `User: ${data.name} (${data.email})`,
    `Status: ${data.active ? "Active" : "Inactive"}`,
    `Scores: ${data.scores.join(", ")}`,
    `Average: ${data.stats.mean.toFixed(2)}`,
    `Median: ${data.stats.median}`,
    `Range: ${data.stats.min} - ${data.stats.max}`,
  ].join("\n");
}

export function formatUserReport(user: UserData): string {
  const stats = calculateStats(user.scores);
  return buildReport({
    name: user.name,
    email: user.email,
    active: user.active,
    scores: [...user.scores],
    stats,
  });
}
```

This refactoring separates data preparation from formatting, making both easier to test independently.

### Step 7: Add Pure Function Guards

Ask the AI to ensure functions do not mutate their inputs:

```
> Review all functions in the codebase and identify any that could
> accidentally mutate their input parameters. Add defensive copies
> where needed. Explain each change.
```

The AI should note that `calculateStats` already copies with `[...scores]`, but it should check `filterActiveUsers` (which uses `.filter()` and returns a new array, so it is safe) and `formatUserReport` (which reads properties but does not mutate, also safe).

This kind of systematic review-and-refactor is where AI saves the most time. Checking every function for mutation safety is tedious manually but fast with AI.

### Step 8: Verify the Full Refactoring

After all refactoring steps, run the complete verification:

```bash
npx tsc
npm run dev
```

Compare the output of `npm run dev` with the output you captured in Step 1. They should be identical. If the type checker passes and the output matches, the refactoring was successful.

## Exercise

1. Extract `calculateMedian` as described in Step 2 and verify the output does not change
2. Ask the AI to extract a `calculateSum` helper as well, and refactor `calculateStats` to use both helpers
3. Split `src/index.ts` into separate module files as described in Step 5. Verify with `npx tsc` that all imports resolve correctly
4. Ask the AI to refactor `filterActiveUsers` into a more generic `filterUsers` function that accepts a predicate function as a parameter. The original `filterActiveUsers` should become a one-liner that calls `filterUsers` with the appropriate predicate
5. After all refactoring, run `npm run dev` and confirm the output is identical to the original

## Summary

- Always capture the current output before refactoring so you can verify behavior is preserved
- Refactor incrementally: one function, one rename, one extraction at a time
- Ask AI to show you a plan before executing large refactors like file splitting
- Adding `readonly` modifiers and JSDoc comments improves code quality without changing behavior
- Extracting helper functions makes code more testable and each piece easier to understand
- Verify after every step with `npx tsc` (type safety) and `npm run dev` (behavior preservation)
- AI-driven refactoring is most valuable for systematic tasks: renaming across files, adding types, extracting patterns
