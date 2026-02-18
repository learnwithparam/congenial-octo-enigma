# Workflows and Process

You now have the skills to use AI for feature building, prompt engineering, code review, refactoring, and debugging. The final piece is knowing how to integrate these skills into a sustainable daily workflow. In this lesson, we will cover when to use AI and when to work without it, how to structure your development process around AI assistance, and the habits that separate developers who use AI effectively from those who become dependent on it.

## What You Will Learn

- How to structure your daily development workflow with AI tools
- When AI assistance helps and when it hurts
- How to maintain and grow your own skills while using AI
- Team workflows for AI-assisted development
- Practical habits for getting the most value from AI tools

## Key Concepts

### The Augmentation Mindset

AI tools augment your capabilities, they do not replace your thinking. The most effective developers use AI to handle the mechanical parts of coding (boilerplate, repetitive patterns, formatting) while reserving their own attention for the creative and architectural decisions that AI handles poorly.

Think of it like using a calculator in a math class. The calculator handles arithmetic so you can focus on understanding the problem and choosing the right approach. But if you never learn arithmetic, you cannot tell when the calculator gives a wrong answer.

### The 70/30 Rule

A useful guideline: use AI for roughly 70% of your typing but 100% of your thinking. Let the AI generate the code, but you decide what to generate, review every line, and make the architectural choices. The developer who types less but thinks more produces better software than the developer who accepts every AI suggestion without review.

### Knowing When to Stop

One of the hardest skills with AI tools is knowing when to stop iterating. If you have asked the AI to rewrite a function four times and it still does not match what you want, it is often faster to write it yourself. The AI has given you a starting point and clarified your own thinking about what you want. Use that clarity and finish it by hand.

## Step by Step

### Step 1: The AI-First Development Workflow

Here is a daily workflow that integrates AI effectively:

**Morning planning**: Review your tasks for the day. For each task, decide whether AI will help significantly. Bug fixes, new utility functions, tests, and documentation are strong AI candidates. Architecture decisions, complex state management, and UI design are better done with your own thinking first.

**Feature implementation**:
1. Design the types and interfaces yourself (or with AI brainstorming)
2. Use AI to generate the implementation
3. Review and adjust the output
4. Use AI to generate tests
5. Use AI to review the final code

**Code review**:
1. Run AI review on your own changes before pushing
2. Use AI to review incoming PRs for issues you might miss
3. Add your own judgment on architecture and design decisions

**End of day**: Use AI to generate commit messages, update documentation, and clean up any rough edges.

### Step 2: Tasks Where AI Excels

These are the tasks where AI assistance provides the most value. Reach for your AI tool here without hesitation.

**Boilerplate and repetitive code**: Creating interfaces, writing CRUD functions, adding error handling to multiple functions. If you are about to write similar code for the third time, let the AI do it.

**Test generation**: Given a function, AI reliably produces comprehensive test cases covering edge cases you might forget. This is one of the highest-value uses of AI.

```
> Write tests for all three exported functions in src/index.ts.
> Cover normal cases, edge cases (empty arrays, single elements,
> all inactive users), and verify the exact output format of
> formatUserReport.
```

**Documentation and JSDoc**: AI generates thorough documentation from code. This is mechanical work that AI handles well.

**Type definitions**: Converting loosely typed code to strict TypeScript types. AI can infer types from usage patterns across your codebase.

**Regular expressions**: Writing and explaining regex patterns is something AI does far better than most developers. Instead of spending 20 minutes on a regex, describe the pattern you need.

**Data transformation**: Functions that transform data from one shape to another. Describe the input and output shapes, and the AI writes the mapping.

### Step 3: Tasks Where AI Struggles

These are the tasks where you should lead and use AI sparingly, if at all.

**Architecture decisions**: Should this be a class or a set of functions? Should you use a state machine or a simple boolean? AI can discuss trade-offs, but the decision should be yours because you understand the context of your team, timeline, and future requirements.

**Business logic nuances**: The AI does not know that your company has a special discount rule for customers in certain regions, or that the "active" flag in your database means something different than what the word implies. Domain-specific logic requires your expertise.

**Performance-critical code**: AI produces correct code but rarely produces optimal code. If you are working on a hot path that processes millions of records, you need to apply performance engineering principles yourself.

**Security-sensitive code**: Authentication, authorization, encryption, and input sanitization are areas where a subtle mistake can be catastrophic. Use AI as a reviewer, but write the initial implementation carefully yourself and have it reviewed by a security-knowledgeable human.

**UI/UX design**: AI can generate UI code, but it does not understand your users. Design decisions about layout, interaction patterns, and user flows need human judgment and user research.

### Step 4: The Review Habit

The single most important habit: always review AI-generated code. Every line. Not just a glance, but a genuine read where you verify the logic. Here is a practical approach:

```
After generating code with AI, before accepting it:
1. Read each line and verify you understand it
2. Check that variable names are meaningful in your context
3. Verify edge cases are handled
4. Run the type checker (npx tsc)
5. Run the code (npm run dev)
6. If anything is unclear, ask the AI to explain that specific part
```

If you cannot explain what a line does, do not keep it. Ask the AI to explain it or rewrite it more clearly. Code you do not understand is code you cannot debug later.

### Step 5: Maintaining Your Skills

A common concern: will using AI make your programming skills atrophy? The answer depends on how you use it. Here are practices that keep your skills sharp.

**Understand before you accept**: When the AI generates a solution you would not have thought of, study it. Learn the technique. Add it to your mental toolkit. The AI is a teacher as well as a tool.

**Write from scratch regularly**: Pick one task per day and write it without AI. This maintains your ability to think through problems independently and keeps your typing speed up.

**Review critically**: Do not rubber-stamp AI output. Finding bugs in AI code exercises the same skills as finding bugs in any code.

**Learn from corrections**: When you correct the AI's output, note what it got wrong and why. This builds your understanding of the AI's common failure modes and makes your future prompts better.

### Step 6: Team Workflows

When a team uses AI tools, some coordination helps.

**Shared project context**: Maintain a team CLAUDE.md (or equivalent) that all team members use. This ensures everyone's AI interactions produce consistent code. Add new conventions as the team agrees on them.

**AI in code review**: Establish a norm that developers run AI review on their own code before requesting human review. This respects human reviewers' time by catching easy issues automatically.

**Prompt sharing**: When someone discovers an effective prompt for a common task (like generating migration scripts or writing API documentation), share it with the team. Build a collection of proven prompts.

**Disclosure norms**: Some teams prefer to know when code was AI-generated. Others do not care as long as it passes review. Decide as a team and establish a norm.

### Step 7: Building Your Prompt Library

Over the course of this workshop, you have used many effective prompts. Collect the ones that work well into a personal reference.

Here is a starter library based on what we have covered:

**New function**:
```
Write a function called [name] that takes [params] and returns [type].
It should [behavior]. Handle these edge cases: [list].
Follow the style in src/index.ts.
```

**Code review**:
```
Review [function/file] for: correctness, edge cases, type safety,
performance, naming, and consistency. Be specific about each issue
and suggest a fix.
```

**Refactoring**:
```
Refactor [function] by [extracting/renaming/restructuring].
The behavior must not change. Show me the plan before making changes.
```

**Debugging**:
```
I expected [expected behavior] but got [actual behavior].
The error is: [error message].
Here is the code: [code].
Trace the execution and find the root cause.
```

**Test generation**:
```
Write tests for [function] covering: [list of scenarios].
Use plain assertions with console.log("PASS"/"FAIL", description).
```

### Step 8: A Complete Feature Workflow Example

Let us tie everything together with a complete example using our codebase. Suppose the task is: "Add a function that exports user data as CSV."

1. **Plan** (you, no AI): The function takes `UserData[]` and returns a CSV string. Columns: id, name, email, average score, active status.

2. **Generate types** (with AI):
```
> Add a type for CSV export options: { includeHeaders: boolean, delimiter: string }
```

3. **Generate implementation** (with AI):
```
> Write exportUsersAsCsv(users: UserData[], options?: CsvExportOptions): string
> that creates a CSV with columns for id, name, email, average score, and
> active status. Use calculateStats for the average. Default to comma
> delimiter with headers.
```

4. **Review** (you): Check the output. Does it handle commas in names? Does it quote fields properly? Does it handle empty user arrays?

5. **Iterate** (with AI):
```
> The CSV export does not handle commas or quotes within field values.
> Add proper CSV escaping: wrap fields in double quotes if they contain
> commas, quotes, or newlines. Escape internal quotes by doubling them.
```

6. **Generate tests** (with AI):
```
> Write tests for exportUsersAsCsv covering: empty array, single user,
> user with comma in name, user with no scores, custom delimiter.
```

7. **Final review** (with AI then you):
```
> Review exportUsersAsCsv for edge cases and correctness.
```
Then do your own final read-through.

8. **Integrate**: Add the function to the demo script, run `npx tsc`, run `npm run dev`.

This workflow took minutes, not hours, and produced well-tested, reviewed code.

## Exercise

1. Implement the CSV export feature described in Step 8, following the complete workflow. Time yourself and note how long each phase takes.

2. Create a personal prompt library document with at least five reusable prompts based on techniques from this course. Test each prompt against the codebase.

3. Take one of the functions from earlier lessons and rewrite it from scratch without AI. Then compare your version with the AI-generated version. Note the differences and what you can learn from each.

4. Ask the AI to generate a comprehensive test suite for the entire `src/index.ts` file. Review the tests critically. Did the AI miss any scenarios? Did it test things that do not need testing?

5. Write a `CLAUDE.md` section called "Common Tasks" that includes prompt templates your future self (or teammates) can use when working on this project.

## Summary

- Use AI for roughly 70% of typing but 100% of thinking: let it generate code while you make the decisions
- AI excels at boilerplate, tests, documentation, types, regex, and data transformations
- AI struggles with architecture decisions, business logic nuances, performance optimization, and security-critical code
- Always review every line of AI-generated code; never accept what you cannot explain
- Maintain your skills by writing code without AI regularly and studying AI output to learn new techniques
- Teams benefit from shared project context files, prompt libraries, and agreed-upon AI usage norms
- The complete workflow is Plan, Generate, Review, Iterate, Test, Integrate, applied consistently to every feature
