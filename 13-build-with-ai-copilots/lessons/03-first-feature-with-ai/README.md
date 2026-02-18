# First Feature with AI

Now that your tools are set up, it is time to build something real. In this lesson, you will implement a complete feature from scratch using AI assistance. The goal is not just to get working code but to learn the workflow: how to break a feature into pieces, prompt the AI effectively, review and integrate the output, and iterate until the result is production-ready.

We will add a leaderboard feature to our utility codebase, using the existing `UserData` and `Stats` types as a foundation.

## What You Will Learn

- How to plan a feature before prompting the AI
- The workflow for building a feature incrementally with AI
- How to review AI-generated code critically
- How to iterate on AI output to improve quality
- When to accept AI suggestions and when to write code yourself

## Key Concepts

### The AI-Assisted Development Workflow

Building a feature with AI follows a predictable pattern: Plan, Prompt, Review, Iterate, Integrate.

**Plan** what you want before touching the AI. Define the inputs, outputs, and behavior. The clearer your plan, the better the AI's first attempt will be.

**Prompt** the AI with a specific, well-scoped request. Avoid vague asks like "add a leaderboard." Instead, describe exactly what the function should accept and return.

**Review** the output critically. Does it handle edge cases? Does it match your project's conventions? Is the logic correct?

**Iterate** on anything that is not right. Tell the AI what to change specifically rather than asking it to "try again."

**Integrate** the final code into your project. Run the type checker, test the function, and make sure it works with existing code.

### Incremental Feature Building

The biggest mistake developers make with AI tools is trying to generate an entire feature in a single prompt. This leads to large blocks of code that are hard to review and often contain subtle bugs.

Instead, build features in small, verifiable steps. Generate one function at a time. Test each piece before moving to the next. This mirrors good software development practice, AI or not.

## Step by Step

### Step 1: Define the Feature

We want to add a leaderboard system. Here is our plan:

- A function that ranks users by their average score
- A function that generates a formatted leaderboard string
- Support for configurable ranking criteria (by mean, median, or total)

Before prompting the AI, write down the type signatures you expect:

```ts
interface LeaderboardEntry {
  rank: number;
  user: UserData;
  stats: Stats;
}

type RankingCriteria = "mean" | "median" | "total";

function rankUsers(
  users: UserData[],
  criteria: RankingCriteria
): LeaderboardEntry[];

function formatLeaderboard(entries: LeaderboardEntry[]): string;
```

Having this plan means you can evaluate the AI's output against a clear specification.

### Step 2: Generate the First Function

Open Claude Code in the project directory and provide context:

```
> Read src/index.ts. I want to add a leaderboard feature. Start by writing
> a rankUsers function that takes an array of UserData and a ranking
> criteria ("mean", "median", or "total"), computes stats for each user
> using the existing calculateStats function, and returns an array of
> LeaderboardEntry objects sorted by the chosen criteria in descending order.
```

The AI should generate something like:

```ts
type RankingCriteria = "mean" | "median" | "total";

interface LeaderboardEntry {
  rank: number;
  user: UserData;
  stats: Stats;
}

/** Ranks users by the specified statistical criteria in descending order. */
export function rankUsers(
  users: UserData[],
  criteria: RankingCriteria = "mean"
): LeaderboardEntry[] {
  const entries = users.map((user) => ({
    user,
    stats: calculateStats(user.scores),
  }));

  entries.sort((a, b) => b.stats[criteria] - a.stats[criteria]);

  return entries.map((entry, index) => ({
    rank: index + 1,
    user: entry.user,
    stats: entry.stats,
  }));
}
```

### Step 3: Review the Output

Before accepting this code, review it critically. Ask yourself:

1. Does it use the existing `calculateStats` function? Yes.
2. Does it handle the edge case of an empty array? It would return an empty array, which is reasonable.
3. Does it follow the project conventions (explicit types, const, JSDoc)? Check each one.
4. Is the sorting correct? Descending order means higher scores rank first. The `b - a` comparison does this correctly.
5. Does it handle users with no scores? The `calculateStats` function returns zeros for empty arrays, so these users would be ranked last. That is acceptable.

This review step is critical. AI-generated code often looks correct at first glance but has subtle issues. Training yourself to review systematically is one of the most important skills in AI-assisted development.

### Step 4: Iterate on the Output

Suppose you want to handle ties. Users with the same score should have the same rank. Ask the AI to improve the function:

```
> Update rankUsers to handle ties. Users with the same score for the
> chosen criteria should have the same rank. Use standard competition
> ranking (1, 2, 2, 4 - skip rank 3 when two users tie for rank 2).
```

The AI should update the ranking logic:

```ts
export function rankUsers(
  users: UserData[],
  criteria: RankingCriteria = "mean"
): LeaderboardEntry[] {
  const entries = users
    .map((user) => ({
      user,
      stats: calculateStats(user.scores),
    }))
    .sort((a, b) => b.stats[criteria] - a.stats[criteria]);

  let currentRank = 1;
  return entries.map((entry, index) => {
    if (index > 0 && entry.stats[criteria] < entries[index - 1].stats[criteria]) {
      currentRank = index + 1;
    }
    return {
      rank: currentRank,
      user: entry.user,
      stats: entry.stats,
    };
  });
}
```

Review again. The tie-handling logic uses standard competition ranking where tied entries share a rank and the next rank is skipped. This is correct.

### Step 5: Generate the Formatter

Now ask for the second function:

```
> Write a formatLeaderboard function that takes an array of LeaderboardEntry
> and returns a formatted string showing rank, name, and the mean score
> for each entry. Include a header line.
```

Expected output:

```ts
/** Formats leaderboard entries as a readable string table. */
export function formatLeaderboard(entries: LeaderboardEntry[]): string {
  if (entries.length === 0) {
    return "No entries to display.";
  }

  const header = "Rank  Name          Average";
  const separator = "-".repeat(header.length);
  const rows = entries.map((entry) => {
    const rank = String(entry.rank).padStart(4);
    const name = entry.user.name.padEnd(14);
    const avg = entry.stats.mean.toFixed(2).padStart(7);
    return `${rank}  ${name}${avg}`;
  });

  return [header, separator, ...rows].join("\n");
}
```

### Step 6: Integrate into the Demo

Ask the AI to add the leaderboard to the existing demo script:

```
> Add a leaderboard section to the demo at the bottom of the file that
> ranks all sample users by mean score and prints the formatted leaderboard.
```

The AI should add something like:

```ts
console.log("\n=== Leaderboard ===\n");
const leaderboard = rankUsers(sampleUsers, "mean");
console.log(formatLeaderboard(leaderboard));
```

### Step 7: Verify the Full Feature

Run the project to see your new feature in action:

```bash
npm run dev
```

You should see the existing user reports followed by the new leaderboard. If something does not work, paste the error into Claude Code:

```
> I got this error when running npm run dev: [paste error]
```

The AI can usually diagnose and fix the issue immediately because it has the full context of the code it just generated.

### Step 8: Type-Check the Result

Run the TypeScript compiler to verify there are no type errors:

```bash
npx tsc
```

If there are errors, paste them into Claude Code. Type errors are one of the easiest things for AI to fix because they are precise and mechanical.

## Exercise

1. Follow the steps above to implement the `rankUsers` and `formatLeaderboard` functions using AI assistance
2. Add a third function `getTopPerformers(users: UserData[], n: number): UserData[]` that returns the top N users by mean score. Use AI to generate this function
3. Modify the demo script to show the top 2 performers separately
4. Try asking the AI to add a new ranking criteria: "consistency" (users with the lowest standard deviation rank higher). This requires modifying both the `Stats` interface and the `calculateStats` function
5. Run `npx tsc` after each change to verify type safety

## Summary

- Always plan your feature before prompting the AI: define types, inputs, outputs, and expected behavior
- Build features incrementally, one function at a time, rather than generating everything in a single prompt
- Review AI-generated code systematically: check edge cases, conventions, correctness, and integration
- Iterate with specific feedback ("handle ties using competition ranking") rather than vague requests ("make it better")
- Use `npx tsc` and `npm run dev` to verify each step before moving on
- The workflow of Plan, Prompt, Review, Iterate, Integrate applies to any AI coding tool
