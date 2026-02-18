# Claude Code Setup

Before you can use an AI coding assistant effectively, you need to set it up properly. A well-configured tool with the right project context will give you dramatically better results than a tool you just point at code and hope for the best. In this lesson, we will install Claude Code, configure it for our project, and write a CLAUDE.md file that gives the AI deep understanding of our codebase.

## What You Will Learn

- How to install and configure Claude Code
- What CLAUDE.md is and why it matters
- How to write effective project context for AI tools
- How to verify your setup with a test interaction
- How configuration applies to other AI tools as well

## Key Concepts

### The CLAUDE.md File

Every codebase has conventions, patterns, and decisions that are not obvious from the code alone. The CLAUDE.md file is a plain markdown file you place at the root of your project that tells Claude Code about your project. Think of it as onboarding documentation for your AI assistant.

When Claude Code starts a session, it reads CLAUDE.md automatically. This means every prompt you write benefits from that context without you having to repeat it. The difference between working with and without a CLAUDE.md file is like the difference between explaining your project to a new hire who has read the docs versus one who has not.

### Project Context

AI tools generate better code when they understand your project's conventions. If your project uses a specific naming convention, a particular error handling pattern, or has architectural constraints, the AI needs to know about these. Without this context, the AI will generate code that works but does not fit your project's style.

This concept applies beyond Claude Code. Cursor has `.cursorrules`, GitHub Copilot has custom instructions, and most tools have some way to provide persistent project context. The principles you learn here for writing good context transfer to any tool.

## Step by Step

### Step 1: Installing Claude Code

Claude Code runs in your terminal. Install it globally using npm:

```bash
npm install -g @anthropic-ai/claude-code
```

Verify the installation:

```bash
claude --version
```

You will need an Anthropic API key. If you do not have one, create an account at console.anthropic.com and generate a key. Set it as an environment variable:

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

For persistence, add this line to your shell profile (`~/.zshrc` or `~/.bashrc`).

### Step 2: First Run

Navigate to the project directory and start Claude Code:

```bash
cd app
claude
```

Claude Code will scan the project structure and show you a prompt. Try a simple interaction to verify everything works:

```
> What files are in this project?
```

Claude Code should respond by listing the files it found, including `src/index.ts`, `package.json`, and `tsconfig.json`. If it does, your setup is working.

### Step 3: Understanding the CLAUDE.md File

Our project already has a CLAUDE.md at the root. Let us examine its structure:

```markdown
# Build with AI Copilots

## Project Overview
This is a TypeScript learning project for practicing AI-assisted
development workflows. The codebase contains utility functions that
students will refactor, debug, and extend using AI tools.

## Tech Stack
- TypeScript 5.x with ESM modules
- Node.js 20+
- tsx for development

## Commands
- `npm run dev` — Run the demo script with hot reload
- `npx tsc` — Type-check the project
- `npm test` — Run tests (when added)

## Project Structure
- `src/index.ts` — Main demo script with utility functions
- `lessons/` — Course lesson materials

## Coding Conventions
- Use explicit TypeScript types (no `any`)
- Prefer `const` over `let`
- Use ESM imports with `.js` extensions for relative paths
- Functions should be pure when possible
- Add JSDoc comments to exported functions
```

This file communicates five critical things: what the project is, what technology it uses, how to run it, how the files are organized, and what coding style to follow.

### Step 4: Writing Effective Project Context

A good CLAUDE.md answers the questions an AI would need answered to write code that fits your project. Here are the categories to cover.

**Project overview**: One or two sentences about what the project does. The AI uses this to understand the domain and make appropriate naming choices.

**Tech stack**: List the major technologies and their versions. This prevents the AI from suggesting incompatible APIs or deprecated patterns.

**Commands**: How to build, run, test, and lint the project. The AI can use these to verify its changes work.

**Project structure**: Where different types of code live. This helps the AI put new code in the right place and find existing code to reference.

**Coding conventions**: Your team's style rules. Naming conventions, preferred patterns, things to avoid. This is where you prevent the AI from generating code that clashes with your codebase.

### Step 5: Extending the CLAUDE.md

Let us add more detail to our CLAUDE.md to make the AI even more effective. We will add sections for common patterns and things to avoid.

Consider adding a section like this:

```markdown
## Patterns
- Error messages should be descriptive and include the function name
- Use early returns for validation (guard clauses)
- Prefer array methods (map, filter, reduce) over for loops
- Type function parameters and return values explicitly

## Avoid
- Using `any` type - use `unknown` if the type is truly unknown
- Mutation of function parameters
- Console.log in library functions (only in demo/script code)
- Default exports for utility functions (use named exports)
```

This is extremely valuable. Now when you ask the AI to write a new function, it will follow these patterns without you having to specify them each time.

### Step 6: Testing Your Configuration

Let us verify that Claude Code is reading our project context correctly. Start a session and ask:

```
> What are the coding conventions for this project?
```

Claude Code should reference the conventions from CLAUDE.md: explicit types, const over let, ESM imports, pure functions, and JSDoc comments. If it does, your CLAUDE.md is being read properly.

Now try a practical test:

```
> Write a function that finds the user with the highest average score
```

Review the output. Does it use TypeScript types? Does it use `const`? Does it include a JSDoc comment? Does it follow the patterns described in CLAUDE.md? If so, your configuration is working well.

### Step 7: Configuration for Other Tools

The same principles apply to other AI tools.

For **Cursor**, create a `.cursorrules` file at your project root with similar content. Cursor reads this file to understand your project conventions.

For **GitHub Copilot**, use the custom instructions feature in VS Code settings. You can specify language-specific instructions and general coding guidelines.

For **Codeium/Windsurf**, use the context settings in the extension to specify project-level instructions.

The content is the same across tools. Only the file name and format differ. If you maintain a good CLAUDE.md, adapting it for other tools takes minutes.

### Step 8: Session Management

Claude Code sessions are conversational. Within a session, the AI remembers everything you have discussed. This means you can build on previous interactions:

```
> Read src/index.ts and understand the codebase

> Now add input validation to calculateStats

> Good, now do the same for filterActiveUsers
```

Each prompt builds on the previous context. The AI knows what `calculateStats` is from the first interaction and applies the same validation pattern from the second interaction.

When you start a new session, the conversation context is fresh, but CLAUDE.md is still loaded. This is why putting important conventions in CLAUDE.md rather than explaining them in conversation is so valuable.

## Exercise

1. Install Claude Code and verify it runs in the project directory
2. Read the existing CLAUDE.md file in the project root
3. Add a "Patterns" and "Avoid" section to the CLAUDE.md with at least three items each, based on your review of `src/index.ts`
4. Start a Claude Code session and ask it to describe the project. Verify it references your CLAUDE.md content
5. Ask Claude Code to write a new utility function (for example, `getUserById`) and check whether the output follows the conventions you specified

## Summary

- Claude Code is installed globally via npm and runs in your terminal
- The CLAUDE.md file provides persistent project context that improves every AI interaction
- Good project context includes the overview, tech stack, commands, structure, and coding conventions
- The same principles apply to all AI tools: Cursor uses `.cursorrules`, Copilot uses custom instructions
- Session context builds on conversation history, while CLAUDE.md provides baseline project knowledge
- Testing your configuration by asking the AI about conventions verifies that your context file is being read
