# Debugging with AI

Debugging is where developers spend a disproportionate amount of their time. Finding the root cause of a bug often requires understanding how multiple parts of a system interact, tracing data flow through functions, and reasoning about edge cases. AI tools are powerful debugging assistants because they can hold the entire context in memory and reason about code paths methodically. In this lesson, you will learn how to use AI to analyze errors, interpret stack traces, isolate bugs, and generate fixes.

## What You Will Learn

- How to present bugs to AI for effective diagnosis
- Techniques for using AI to trace data flow and find root causes
- How to interpret TypeScript compiler errors with AI assistance
- How to generate and validate fixes
- A systematic approach to debugging that combines your reasoning with AI

## Key Concepts

### The Bug Report Prompt

When you encounter a bug, the quality of your "bug report" to the AI determines how quickly it can help. A good bug report includes: what you expected to happen, what actually happened, the relevant code, and any error messages or stack traces. This is the same information you would put in a GitHub issue, and for good reason.

### Hypothesis-Driven Debugging

Even with AI, debugging works best when you form a hypothesis first. Instead of saying "this code is broken, fix it," say "I think the bug is in the median calculation when the array has duplicate values. Can you verify this and suggest a fix?" This focuses the AI and also exercises your own debugging skills.

### Reproducing the Issue

AI can help you write minimal reproduction cases. A clear reproduction is often half the solution, because once you can reproduce the bug reliably, the cause usually becomes obvious.

## Step by Step

### Step 1: Debugging a Type Error

Let us start with a common scenario: a TypeScript compiler error. Suppose you accidentally modify `calculateStats` to have a type error:

```ts
export function calculateStats(scores: number[]): Stats {
  if (scores.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0 }; // missing 'total'
  }
  // ...
}
```

Running `npx tsc` produces:

```
src/index.ts(31,5): error TS2741: Property 'total' is missing in type
'{ mean: number; median: number; min: number; max: number; }' but
required in type 'Stats'.
```

Paste this error into Claude Code:

```
> I got this TypeScript error:
>
> src/index.ts(31,5): error TS2741: Property 'total' is missing in type
> '{ mean: number; median: number; min: number; max: number; }' but
> required in type 'Stats'.
>
> What does this mean and how do I fix it?
```

The AI will explain that the return object is missing the `total` field that the `Stats` interface requires, and show you the exact fix. This is a simple example, but the same pattern works for complex generic type errors that are hard to parse.

### Step 2: Debugging a Logic Bug

Logic bugs are harder because there is no error message, the code runs but produces wrong results. Introduce a subtle bug into `calculateStats`:

```ts
// Bug: using scores.length instead of sorted.length
const mean = total / scores.length;
```

In this case both variables have the same value, so the bug is invisible. But suppose you introduced a different logic bug. The key technique is to describe the symptoms:

```
> The calculateStats function returns incorrect median values for
> arrays with an even number of elements. For example:
>
> Input: [1, 3, 5, 7]
> Expected median: 4 (average of 3 and 5)
> Actual median: 5
>
> Here is the function: [paste the code]
> What is causing this?
```

By providing a concrete failing example with expected and actual values, you give the AI everything it needs to trace through the logic and find the bug.

### Step 3: Using AI to Build a Reproduction

Sometimes you know something is wrong but cannot pinpoint the failing input. Ask the AI to help:

```
> I suspect calculateStats might have issues with certain inputs but
> I am not sure which ones. Write a test harness that runs calculateStats
> with a variety of edge case inputs and prints the results so I can
> inspect them manually. Include:
> - Empty array
> - Single element
> - Two elements
> - Duplicate values
> - Negative numbers
> - Very large numbers
> - Array with NaN
> - Array with Infinity
```

The AI will generate a test script:

```ts
const testCases: { name: string; input: number[] }[] = [
  { name: "empty array", input: [] },
  { name: "single element", input: [42] },
  { name: "two elements", input: [10, 20] },
  { name: "duplicates", input: [5, 5, 5] },
  { name: "negative numbers", input: [-3, -1, -7] },
  { name: "very large numbers", input: [Number.MAX_SAFE_INTEGER, 1] },
  { name: "NaN in array", input: [1, NaN, 3] },
  { name: "Infinity in array", input: [1, Infinity, 3] },
];

for (const { name, input } of testCases) {
  console.log(`\n--- ${name}: [${input}] ---`);
  const result = calculateStats(input);
  console.log(result);
}
```

Running this quickly reveals which inputs produce unexpected results, turning a vague suspicion into a concrete bug report.

### Step 4: Analyzing Stack Traces

When your code throws a runtime error, you get a stack trace. These can be intimidating, especially in larger applications. Here is how to get AI help:

```
> I got this runtime error when running the program:
>
> TypeError: Cannot read properties of undefined (reading 'scores')
>     at formatUserReport (src/index.ts:56:38)
>     at Object.<anonymous> (src/index.ts:98:15)
>
> The relevant code is in src/index.ts. What is causing this and how
> do I fix it?
```

The AI will explain:

1. The error occurs in `formatUserReport` at line 56, where it tries to access `user.scores`
2. This means `user` is `undefined`
3. Looking at line 98, this is in the loop that iterates over `activeUsers`
4. The likely cause is that the array contains an `undefined` element, or the user data is malformed

This step-by-step trace is what you would do mentally, but the AI does it faster and can cross-reference line numbers with actual code.

### Step 5: Debugging with Data Flow Analysis

For bugs that involve data passing through multiple functions, ask the AI to trace the data flow:

```
> Trace what happens when this specific user is processed through the
> system:
>
> { id: 4, name: "Dave", email: "dave@test.com", scores: [], active: true }
>
> Walk through filterActiveUsers, then formatUserReport, then
> calculateStats. What value does each function receive and return?
> Is there any point where the data could cause unexpected behavior?
```

The AI will trace:

1. `filterActiveUsers`: Dave is active, so he passes through. Return value includes Dave.
2. `formatUserReport(dave)`: Calls `calculateStats([])` with Dave's empty scores array.
3. `calculateStats([])`: Hits the empty check, returns `{ mean: 0, median: 0, min: 0, max: 0, total: 0 }`.
4. Back in `formatUserReport`: Formats the report with "Average: 0.00", "Range: 0 - 0".

The AI might flag that while this does not crash, showing "Range: 0 - 0" for a user with no scores is misleading. This is not a crash bug but a UX bug that the data flow analysis reveals.

### Step 6: Fixing the Bug

Once the AI identifies the root cause, ask for a fix:

```
> Fix formatUserReport to handle users with no scores. Instead of
> showing misleading zeros, it should show "No scores recorded" for
> the stats section.
```

The AI generates:

```ts
export function formatUserReport(user: UserData): string {
  if (user.scores.length === 0) {
    return [
      `User: ${user.name} (${user.email})`,
      `Status: ${user.active ? "Active" : "Inactive"}`,
      `Scores: No scores recorded`,
    ].join("\n");
  }

  const stats = calculateStats(user.scores);
  return [
    `User: ${user.name} (${user.email})`,
    `Status: ${user.active ? "Active" : "Inactive"}`,
    `Scores: ${user.scores.join(", ")}`,
    `Average: ${stats.mean.toFixed(2)}`,
    `Median: ${stats.median}`,
    `Range: ${stats.min} - ${stats.max}`,
  ].join("\n");
}
```

Review the fix. Does it handle the edge case correctly? Does it maintain the existing behavior for users with scores? Run `npm run dev` and `npx tsc` to verify.

### Step 7: Preventing Future Bugs

After fixing a bug, ask the AI to help prevent similar bugs:

```
> We just found that formatUserReport did not handle empty scores
> arrays well. Review the other functions in the codebase for similar
> issues where empty or missing data is not handled gracefully.
> For each issue found, suggest a specific fix.
```

This turns a single bug fix into a systematic improvement. The AI will check every function for similar patterns and suggest preventive fixes.

### Step 8: The Debugging Workflow

Here is the complete debugging workflow with AI:

1. **Reproduce**: Get a specific input that triggers the bug. If you do not have one, ask AI to generate edge case inputs (Step 3).
2. **Report**: Describe the expected vs actual behavior to the AI, including any error messages or stack traces.
3. **Hypothesize**: Form your own theory about the cause. Share it with the AI: "I think the issue is in X because Y."
4. **Trace**: Ask the AI to trace the data flow through the relevant functions with your failing input.
5. **Fix**: Once the root cause is confirmed, ask for a targeted fix.
6. **Verify**: Run the code to confirm the fix works and the original test cases still pass.
7. **Prevent**: Ask the AI to find similar issues elsewhere in the codebase.

## Exercise

1. Deliberately introduce a bug into `calculateStats`: change `(a, b) => a - b` to `(a, b) => b - a` in the sort. This reverses the sort order. Ask the AI to figure out what went wrong when the min and max values are swapped.

2. Add a user with `scores: [NaN, 85, 90]` to the sample data and run the program. Paste the output into Claude Code and ask it to explain why the results are wrong and how to fix `calculateStats` to handle NaN values.

3. Ask the AI to write a validation function called `validateUserData` that checks a `UserData` object for common issues (empty name, invalid email format, NaN in scores, negative ID) and returns an array of error messages. Use this to catch data problems before they reach the utility functions.

4. Use the data flow tracing technique (Step 5) to trace what happens when a user with scores `[100]` is processed. Is there anything unexpected about a single-element array?

5. Ask the AI to add error handling to all three exported functions that throws descriptive errors when invalid input is detected, rather than producing silently wrong results.

## Summary

- Present bugs to AI with concrete details: expected behavior, actual behavior, error messages, and relevant code
- Use AI to generate edge case test inputs that systematically reveal hidden bugs
- Stack trace analysis is a strength of AI tools; paste the full trace and let the AI map it to your code
- Data flow tracing through multiple functions helps find bugs that occur at function boundaries
- Always verify fixes with `npx tsc` and `npm run dev` before considering the bug closed
- After fixing a bug, use AI to scan the rest of the codebase for similar issues
- Combine your own hypotheses with AI analysis for the most effective debugging
