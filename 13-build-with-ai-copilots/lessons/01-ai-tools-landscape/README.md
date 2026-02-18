# AI Tools Landscape

The landscape of AI-powered development tools has exploded. Every month a new tool promises to write your code faster, review your PRs smarter, or debug your errors instantly. The reality is that each tool has distinct strengths, trade-offs, and ideal use cases. In this lesson, we will survey the major AI coding assistants, understand how they work, and develop a framework for choosing the right tool for the right job.

By the end of this lesson, you will be able to make an informed decision about which tools to integrate into your development workflow.

## What You Will Learn

- The major categories of AI coding tools and how they differ
- How GitHub Copilot, Claude Code, Cursor, and Codeium work under the hood
- The difference between inline completion, chat-based, and agent-based tools
- How to evaluate an AI tool for your specific needs
- The strengths and limitations of each tool category

## Key Concepts

### Inline Completion Tools

Inline completion tools predict what you are about to type and offer suggestions directly in your editor. GitHub Copilot pioneered this approach. As you write code, the tool analyzes the current file, nearby files, and your comments to generate the next few lines.

These tools work best for repetitive patterns. If you are writing a series of similar functions, mapping over an array, or implementing a well-known algorithm, inline completion can save significant keystrokes. The suggestions appear as ghost text that you accept with Tab or dismiss by continuing to type.

The limitation is context. Inline tools typically send a limited window of code to the model, so they may not understand your full project architecture when making suggestions.

### Chat-Based Tools

Chat-based tools give you a conversation interface alongside your editor. Cursor, GitHub Copilot Chat, and Codeium's chat feature all fall into this category. You describe what you want in natural language, and the tool generates code, explains concepts, or helps debug errors.

The key advantage is that you can provide explicit context. Instead of hoping the tool guesses what you need, you tell it directly. You can paste error messages, describe business requirements, or ask it to explain unfamiliar code.

### Agent-Based Tools

Agent-based tools like Claude Code operate in your terminal and can take multi-step actions autonomously. They can read files, write code, run commands, and iterate on errors. Rather than generating a single snippet, an agent can implement an entire feature across multiple files.

This is the newest category and represents a fundamental shift. Instead of assisting you line by line, an agent can execute a plan. You describe the end goal, and the agent figures out the steps.

### The Tools

Here is an overview of the major tools you will encounter.

**GitHub Copilot** is the most widely adopted AI coding tool. It runs as a VS Code extension (and other editors) and provides both inline completions and a chat panel. It is backed by OpenAI models and has deep integration with GitHub for PR reviews and code explanations. Pricing starts at $10/month for individuals.

**Claude Code** is Anthropic's command-line AI assistant. It runs in your terminal, reads your project files, and can make changes directly. It excels at understanding large codebases and performing multi-file operations. It uses a CLAUDE.md file for project-specific context, which we will set up in the next lesson.

**Cursor** is a fork of VS Code that builds AI deeply into the editor experience. It offers inline completions, a chat panel, and a Composer feature that can edit multiple files at once. It supports multiple AI model providers. Pricing starts at $20/month for the pro plan.

**Codeium (Windsurf)** offers a free tier with inline completions and a chat panel. It runs as a VS Code extension and also has a standalone editor called Windsurf. It positions itself as the accessible option with generous free usage.

## Step by Step

### Step 1: Understanding the Completion Spectrum

AI coding tools exist on a spectrum from passive to active assistance.

At the passive end, inline completions suggest code as you type. You remain fully in control and the tool merely accelerates your typing. This is how GitHub Copilot's default mode works.

In the middle, chat-based tools respond to your explicit requests. You ask a question or describe a task, review the output, and decide what to use. Cursor's chat panel and Copilot Chat work this way.

At the active end, agent-based tools can take autonomous actions. You describe a goal and the agent reads files, writes code, and runs commands to achieve it. Claude Code operates in this mode.

Understanding where each tool sits on this spectrum helps you choose the right tool for the right moment. Writing boilerplate? Use inline completion. Stuck on an architecture decision? Use chat. Need to implement a feature across five files? Use an agent.

### Step 2: Evaluating Context Windows

A critical factor in AI tool effectiveness is how much of your codebase the tool can see. This is called the context window.

Inline completion tools typically send the current file and a few related files to the model. This is enough for local suggestions but may miss project-wide patterns.

Chat-based tools usually let you manually add files to the context. Cursor lets you tag files with `@filename`, and Copilot Chat includes open editor tabs.

Agent-based tools like Claude Code can read your entire project. When you point Claude Code at a codebase, it indexes the file structure and can read any file on demand. This makes it particularly strong for tasks that require understanding how multiple modules connect.

### Step 3: Looking at Our Practice Codebase

For the rest of this course, we will use a small TypeScript project as our playground. Open `app/src/index.ts` and review the code.

The file contains three utility functions and some sample data:

```ts
interface UserData {
  id: number;
  name: string;
  email: string;
  scores: number[];
  active: boolean;
}

interface Stats {
  mean: number;
  median: number;
  min: number;
  max: number;
  total: number;
}

export function calculateStats(scores: number[]): Stats {
  // Calculates statistical measures for an array of scores
}

export function filterActiveUsers(users: UserData[]): UserData[] {
  // Filters to only active users
}

export function formatUserReport(user: UserData): string {
  // Generates a formatted text report for a single user
}
```

Throughout this course, you will use AI tools to refactor these functions, add error handling, write tests, and extend the feature set. The codebase is intentionally small so you can focus on learning the AI workflow rather than wrestling with application complexity.

### Step 4: Choosing Your Tools

For this course, we will primarily use Claude Code as our AI assistant. However, the prompting techniques and workflows you learn apply broadly to all AI coding tools. Here is a decision framework:

Use **inline completion** (Copilot, Codeium) when you know exactly what you want to write and just want to type it faster. Good for test cases, boilerplate, repetitive patterns.

Use **chat** (Copilot Chat, Cursor chat) when you need to discuss an approach, understand unfamiliar code, or get a targeted code snippet. Good for learning and exploration.

Use **an agent** (Claude Code) when you need multi-file changes, want to implement a complete feature, or need deep analysis of how code works across your project. Good for refactoring, feature implementation, and debugging complex issues.

### Step 5: Understanding Model Differences

Different tools use different AI models, and this matters.

GitHub Copilot uses OpenAI's models (GPT-4 and newer). These models are strong at code completion and have broad training data across many programming languages.

Claude Code uses Anthropic's Claude models. Claude tends to be thorough in its reasoning, follows complex instructions well, and is strong at understanding large amounts of context.

Cursor lets you choose between multiple providers, including OpenAI, Anthropic, and others. This flexibility lets you pick the best model for each task.

The practical impact: if one tool gives you a poor result for a specific task, trying the same prompt in a different tool with a different model often yields better output. No single model is best at everything.

## Exercise

1. Review the codebase in `app/src/index.ts` and understand all three functions
2. Make a list of improvements you would want to make to this code (better error handling, documentation, tests, new features)
3. For each improvement, decide which category of AI tool (inline completion, chat, or agent) would be most appropriate and write down why
4. If you have access to multiple AI tools, try asking each one to explain the `calculateStats` function. Compare the quality and depth of their explanations

## Summary

- AI coding tools fall into three categories: inline completion, chat-based, and agent-based
- GitHub Copilot dominates inline completion, Cursor leads the integrated editor space, and Claude Code pioneered the agent-based terminal approach
- The key differentiator between tools is how much project context they can access and how autonomously they can act
- No single tool is best for every situation; the most effective developers use different tools for different tasks
- Throughout this course, we will use Claude Code as our primary tool while learning techniques that transfer to any AI assistant
