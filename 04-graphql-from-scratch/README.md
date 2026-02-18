# 04 -- GraphQL From Scratch

Queries, Mutations, and Subscriptions with Apollo Server.

## What You'll Learn

How to build a GraphQL API from the ground up using Apollo Server --
covering schema design, resolvers, DataLoaders, subscriptions, and testing.

## Prerequisites

- JavaScript/TypeScript fundamentals
- Node.js installed (v18+)
- Familiar with REST APIs and Express (or equivalent API experience)

## Lessons

| # | Lesson | Topic |
|---|--------|-------|
| 01 | [why-graphql](./lessons/01-why-graphql/) | Understand when and why to use GraphQL |
| 02 | [schema-design](./lessons/02-schema-design/) | Design a GraphQL schema with SDL |
| 03 | [resolvers](./lessons/03-resolvers/) | Write resolvers that fetch data |
| 04 | [queries-arguments](./lessons/04-queries-arguments/) | Handle query arguments and variables |
| 05 | [mutations](./lessons/05-mutations/) | Implement mutations for data changes |
| 06 | [input-validation](./lessons/06-input-validation/) | Validate inputs with Zod |
| 07 | [dataloaders](./lessons/07-dataloaders/) | Solve the N+1 problem with DataLoader |
| 08 | [error-handling](./lessons/08-error-handling/) | Handle errors gracefully in GraphQL |
| 09 | [subscriptions](./lessons/09-subscriptions/) | Add real-time subscriptions |
| 10 | [testing-docs](./lessons/10-testing-docs/) | Test and document your GraphQL API |

### Quick Start

```bash
make setup    # Install dependencies
make dev      # Start Apollo Server at http://localhost:4000

# Or with Docker:
make docker-up   # Start everything in containers
```

## Commands

Run `make help` to see all available commands.
