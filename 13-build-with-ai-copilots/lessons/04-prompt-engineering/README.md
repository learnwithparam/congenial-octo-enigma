# Prompt Engineering for Code Generation

The quality of AI-generated code is directly proportional to the quality of your prompt. A vague prompt produces vague code. A specific, well-structured prompt produces code that is ready to use with minimal edits. In this lesson, you will learn the techniques that separate effective AI prompting from the frustrating trial-and-error most developers experience.

We will practice each technique using the functions in our TypeScript codebase so you can see the impact immediately.

## What You Will Learn

- The anatomy of an effective code generation prompt
- Five prompt patterns that consistently produce better results
- How to provide constraints that guide the AI toward your preferred style
- How to iterate on output without starting from scratch
- Common prompting mistakes and how to avoid them

## Key Concepts

### Specificity Over Brevity

The single most impactful improvement you can make to your prompts is being specific. Compare these two prompts:

**Weak**: "Add error handling to calculateStats"

**Strong**: "Add input validation to calculateStats that throws a TypeError if the input is not an array and throws a RangeError if any element in the array is not a finite number. Return early with the zero-stats object if the array is empty."

The weak prompt gives the AI freedom to interpret "error handling" however it wants. The strong prompt tells it exactly what errors to check, what exception types to use, and how to handle the empty case. The strong prompt produces usable code on the first try.

### The Role of Examples

AI models are excellent at pattern matching. When you include an example of the output format you want, the model will follow that pattern closely. This is especially useful for formatting functions, test structures, and documentation.

### Constraints as Guardrails

Constraints prevent the AI from going in directions you do not want. "Do not use any third-party libraries" or "Keep the function under 20 lines" or "Use only features available in ES2020" are all constraints that narrow the solution space and produce more predictable results.

## Step by Step

### Step 1: The Context-Task-Constraints Pattern

The most reliable prompt structure for code generation has three parts:

**Context**: What code exists and what it does.
**Task**: What you want the AI to produce.
**Constraints**: Rules the output must follow.

Here is this pattern applied to our codebase:

```
Context: I have a calculateStats function in src/index.ts that takes
a number[] and returns a Stats object with mean, median, min, max,
and total.

Task: Write a comprehensive set of test cases for calculateStats
using plain assertions (no test framework).

Constraints:
- Test the empty array case
- Test a single-element array
- Test an array with an even number of elements (for median calculation)
- Test an array with an odd number of elements
- Test negative numbers
- Each test should print PASS or FAIL with a description
```

This prompt is unambiguous. The AI knows the existing function signature, what to produce, and exactly which cases to cover.

### Step 2: The Modification Pattern

When you want to change existing code, describe the current behavior and the desired behavior:

```
Currently, formatUserReport returns a plain text string with newlines.
Modify it to return an object with the following shape instead:

{
  header: "User: Alice (alice@example.com)",
  status: "Active",
  scores: "85, 92, 78, 95, 88",
  stats: {
    average: "87.60",
    median: 88,
    range: "78 - 95"
  }
}

Keep the existing function name and add a new interface for the return type.
Do not change the function's parameter type.
```

By describing both the current state and desired state, you eliminate guesswork. The AI does not need to infer what you want changed.

### Step 3: The Example-Driven Pattern

When the output format matters, provide a concrete example:

```
Write a function called describeStats that takes a Stats object and
returns a natural language description. Here is an example:

Input: { mean: 87.6, median: 88, min: 78, max: 95, total: 438 }
Output: "The average score is 87.60 with scores ranging from 78 to 95.
The median score of 88 is close to the mean, suggesting a symmetric
distribution."

The description should adapt based on whether the mean and median
are close (within 5 points) or far apart. When they are far apart,
mention that the distribution may be skewed.
```

The example shows the AI the exact tone, format, and level of detail you expect. The additional instruction about adapting the description shows the AI that this is not just a template but requires conditional logic.

### Step 4: The Incremental Refinement Pattern

Instead of trying to get perfect code in one prompt, use a series of prompts that build on each other:

**Prompt 1**: "Write a function that groups users by score range: 0-59 (low), 60-79 (medium), 80-100 (high). Use the user's mean score from calculateStats."

**Prompt 2**: "Good. Now add a parameter for custom score ranges instead of hardcoding the thresholds."

**Prompt 3**: "Add input validation: throw if any range overlaps with another range, and throw if the ranges do not cover 0-100."

Each prompt adds one layer of complexity. You can review and approve each step. If the AI goes in the wrong direction at step 2, you only lose one small iteration instead of an entire large generation.

### Step 5: The Negative Constraint Pattern

Sometimes it is easier to tell the AI what NOT to do:

```
Add a caching layer to calculateStats so that repeated calls with
the same input array return the cached result.

Do NOT use any external caching libraries.
Do NOT use a Map with the array reference as key (arrays are compared
by reference, not value).
Do NOT cache indefinitely - use a maximum cache size of 100 entries
with LRU eviction.
```

Negative constraints are powerful because they block the most common shortcuts the AI would take. Without the second constraint, the AI would almost certainly use a Map with array references, which would never produce cache hits for equivalent arrays.

### Step 6: Iterating on Output

When the AI produces code that is close but not right, be specific about what to change:

**Weak iteration**: "That's not quite right, try again."

**Strong iteration**: "The function works but has two issues: (1) it mutates the input array on line 5 where you call sort() directly instead of sorting a copy, and (2) the JSDoc comment says it returns a number but the return type is Stats. Fix both."

Point to specific lines, specific problems, and specific fixes. The AI can address targeted feedback far more reliably than vague dissatisfaction.

### Step 7: Prompt Templates for Common Tasks

Here are reusable templates for tasks you will perform frequently.

**Adding a new function**:
```
Write a function called [name] that takes [parameters with types]
and returns [return type]. It should [behavior description].
Handle these edge cases: [list]. Follow the existing code style
in src/index.ts.
```

**Writing tests**:
```
Write tests for the [function name] function. Test these scenarios:
[list of scenarios]. Use this assertion pattern:
console.log(condition ? "PASS" : "FAIL", "description");
```

**Adding types**:
```
The [function/variable] currently uses [current type or any].
Create a proper TypeScript type/interface for it based on how
it is used in the codebase. Name it [preferred name].
```

**Explaining code**:
```
Explain what this function does step by step. For each step,
explain WHY it does it, not just WHAT it does. Identify any
potential bugs or edge cases that are not handled.
```

### Step 8: Common Prompting Mistakes

**Too broad**: "Write a user management system." This produces hundreds of lines of code you cannot review effectively. Break it into individual functions.

**Too vague on types**: "Write a function that processes data." What kind of data? What does processing mean? What is the return type?

**Assuming context**: "Fix the bug." Which bug? The AI does not know what behavior you consider incorrect unless you tell it.

**Not specifying error handling**: If you do not mention error handling, the AI may or may not add it. If you want it, ask for it. If you do not, say "do not add error handling, the caller handles errors."

**Asking for explanations with code**: If you say "write the function and explain how it works," you get a long response that is hard to extract code from. Separate these into two prompts: first generate the code, then ask for an explanation.

## Exercise

1. Using the Context-Task-Constraints pattern, prompt the AI to add a `standardDeviation` field to the `Stats` interface and update `calculateStats` to compute it. Verify the output with `npx tsc`.

2. Using the Example-Driven pattern, prompt the AI to write a `compareUsers` function that takes two `UserData` objects and returns a comparison string. Provide an example of the expected output format.

3. Using the Incremental Refinement pattern, build a function in three prompts:
   - First: a basic `searchUsers` function that filters users whose name contains a search string
   - Second: add case-insensitive matching and email search
   - Third: add a scoring system that ranks matches by relevance (exact name match > partial name > email match)

4. Take any function the AI generated in a previous exercise and use the Negative Constraint pattern to request an improved version with at least three "do not" constraints.

## Summary

- Specific prompts produce usable code; vague prompts produce code you have to rewrite
- The Context-Task-Constraints pattern is the most reliable structure for code generation prompts
- Providing examples of expected output format dramatically improves results
- Incremental refinement (multiple small prompts) beats monolithic generation (one big prompt)
- Negative constraints ("do NOT use...") prevent the AI from taking common shortcuts
- When iterating, point to specific issues with specific fixes rather than saying "try again"
- Separate code generation prompts from explanation prompts for cleaner output
