# Code Review with AI

Code review is one of the highest-leverage activities in software development. It catches bugs, spreads knowledge, and improves code quality. AI tools are remarkably effective reviewers because they never get tired, never rush through a review, and can analyze code against multiple dimensions simultaneously. In this lesson, you will learn how to use AI to review code, find bugs, suggest improvements, and catch issues that human reviewers commonly miss.

## What You Will Learn

- How to use AI for systematic code review
- Specific prompts that uncover bugs, performance issues, and style violations
- How to review your own code with AI before submitting a pull request
- How AI can check for security vulnerabilities and edge cases
- The limitations of AI code review and what still requires human judgment

## Key Concepts

### Multi-Dimensional Review

When a human reviews code, they tend to focus on one or two aspects: does the logic look right, and does the style match? AI can check many dimensions at once: correctness, edge cases, type safety, performance, readability, naming, documentation, security, and consistency with the rest of the codebase.

The key is asking for each dimension explicitly. A prompt that says "review this code" gets a shallow response. A prompt that says "check this code for edge cases that would cause runtime errors" gets a targeted, useful response.

### Pre-Submission Self-Review

The most impactful use of AI code review is reviewing your own code before anyone else sees it. This catches the easy mistakes that waste human reviewers' time and lets the human review focus on architecture, design decisions, and business logic, the things AI is less good at.

## Step by Step

### Step 1: Basic Code Review

Start by asking the AI to review the existing `calculateStats` function. Open Claude Code in the project directory:

```
> Review the calculateStats function in src/index.ts for bugs,
> edge cases, and potential improvements. Be specific about each
> issue and suggest a fix.
```

The AI should identify several things:

1. The function returns `{ mean: 0, median: 0, min: 0, max: 0, total: 0 }` for empty arrays. Is zero the right value for min and max when there are no scores? `Infinity` and `-Infinity` or `NaN` might be more mathematically correct.

2. There is no validation that the input contains only numbers. Passing `[1, "two", 3]` would produce unexpected results since TypeScript types are erased at runtime.

3. The `sorted[0]` and `sorted[sorted.length - 1]` access is safe only because of the early return for empty arrays. If that guard were removed, these would throw.

These are real issues that a human reviewer might miss, especially in a codebase they have seen many times.

### Step 2: Edge Case Analysis

Ask the AI specifically about edge cases:

```
> What inputs to calculateStats would produce incorrect or unexpected
> results? For each case, show the input and what the function would
> return versus what it should return.
```

The AI should enumerate cases like:

```ts
// NaN in the array
calculateStats([1, 2, NaN, 4]);
// sort with NaN produces unpredictable ordering
// mean becomes NaN, min/max may be wrong

// Infinity in the array
calculateStats([1, Infinity, 3]);
// total is Infinity, mean is Infinity

// Very large arrays (performance, not correctness)
calculateStats(Array(1_000_000).fill(1));
// The sort + reduce + spread creates multiple copies of the array

// Non-integer numbers and floating point precision
calculateStats([0.1, 0.2]);
// mean: 0.15000000000000002 (floating point artifact)
```

This kind of analysis is extremely valuable. It takes a human time to think through all these cases, but the AI generates them quickly and systematically.

### Step 3: Review for Type Safety

Ask the AI to check for type-related issues:

```
> Review the type definitions in src/index.ts. Are the interfaces
> complete and correct? Are there places where stricter types would
> prevent bugs? Are there any type assertions or implicit any types?
```

The AI might point out:

- The `UserData` interface allows `scores` to be an empty array, which `calculateStats` handles but `formatUserReport` does not communicate clearly (it shows "Average: 0.00" which could be misleading).

- The `id` field on `UserData` is typed as `number`, but if these come from a database, `string` (for UUIDs) might be more appropriate. This is a design question worth considering.

- There is no `readonly` modifier on the `scores` array, which means functions could accidentally mutate the user's scores. Adding `readonly number[]` to the interface would prevent this.

### Step 4: Performance Review

Ask the AI to evaluate performance:

```
> Review calculateStats for performance. Identify any unnecessary
> operations, redundant iterations, or opportunities to reduce
> time or space complexity.
```

The AI should note:

- The spread operator `[...scores]` creates a copy of the array, which is correct (avoids mutating the input) but adds O(n) space.
- The `sort()` call is O(n log n).
- The `reduce()` call for the total is another O(n) pass.
- The function makes three passes through the data (copy, sort, reduce). For most use cases this is fine, but if called on very large arrays in a hot loop, it could be optimized to a single pass that tracks min, max, and sum simultaneously. The median still requires sorting.

This analysis helps you make informed decisions about whether to optimize.

### Step 5: Reviewing for Consistency

Ask the AI to check the entire file for consistency:

```
> Review all three functions in src/index.ts for consistency. Do they
> follow the same patterns for error handling, naming, documentation,
> and return types? Point out any inconsistencies.
```

The AI might flag:

- `calculateStats` handles the empty input case with a return value, but `filterActiveUsers` does not (it would return an empty array, which is fine, but the approach is inconsistent in terms of whether edge cases are documented).
- `formatUserReport` uses template literals while the overall style could benefit from a consistent approach to string building.
- Only `calculateStats` has implicit documentation through its clear return type. Adding JSDoc comments to all three functions would improve consistency.

### Step 6: Security Review

Even in utility code, security awareness matters. Ask:

```
> Review src/index.ts for any security concerns. Consider:
> input injection, prototype pollution, denial of service through
> crafted inputs, and information leakage.
```

For this small utility codebase, the AI might note:

- The `formatUserReport` function includes the user's email in its output. If this output is displayed in a web page without sanitization, it could be an XSS vector if the email field contains malicious content.
- There is no upper bound on the `scores` array length. An attacker could pass millions of scores, causing the sort to consume excessive CPU.
- The `name` field is used directly in string interpolation, which is safe in Node.js console output but would need escaping in HTML context.

These may seem minor for a utility script, but learning to think about security at the code review stage is a habit worth building.

### Step 7: Writing a Review Checklist Prompt

Create a comprehensive review prompt that you can reuse:

```
> Review the following code against this checklist:
>
> 1. Correctness: Does the logic produce correct results for all valid inputs?
> 2. Edge cases: What happens with empty, null, undefined, very large, or
>    very small inputs?
> 3. Types: Are the TypeScript types accurate and strict enough?
> 4. Error handling: Are errors handled or documented?
> 5. Performance: Any unnecessary work or O(n^2+) operations?
> 6. Naming: Are function, variable, and parameter names clear?
> 7. Consistency: Does the code match the style of surrounding code?
> 8. Documentation: Are complex parts explained?
>
> [paste or reference the code]
```

This checklist prompt consistently produces thorough reviews. Save it as a template.

### Step 8: Reviewing AI-Generated Code

Here is an important meta-skill: use AI to review code that AI generated. If you used AI to build the leaderboard feature in the previous lesson, now review it:

```
> Review the rankUsers and formatLeaderboard functions I added.
> Check for bugs, edge cases, and improvements. Be critical.
```

AI tools are surprisingly good at finding issues in their own output when asked to review it separately from the generation step. This is because generation and review are different tasks that activate different reasoning patterns.

## Exercise

1. Use Claude Code to perform a full review of `src/index.ts` using the checklist from Step 7. Document all issues found.

2. Ask the AI to review `calculateStats` specifically for numerical precision issues. How does it handle floating point arithmetic? What would you change?

3. Write a new function (or use one from a previous lesson) and review it with AI before finalizing it. Note how many issues the review catches that you would have missed.

4. Ask the AI to generate a "review summary" for `src/index.ts` that lists all issues categorized by severity (critical, moderate, minor). This is the format a team lead would want for a PR review.

5. Try the same review with a different AI tool (Copilot Chat, Cursor) if available, and compare the depth and quality of the review feedback.

## Summary

- AI code review is most effective when you ask for specific dimensions: correctness, edge cases, types, performance, security, consistency
- The biggest value is in pre-submission self-review, catching easy issues before human reviewers spend time on them
- Edge case analysis is where AI particularly excels, systematically enumerating inputs that cause problems
- A reusable review checklist prompt produces consistent, thorough reviews across any codebase
- Use AI to review AI-generated code, the review step often catches issues the generation step missed
- AI review complements but does not replace human review; architectural decisions, business logic, and team conventions still need human judgment
