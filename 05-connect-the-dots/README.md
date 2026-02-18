# 05 -- Connect the Dots

Wire Your Frontend to a Real API.

## What You'll Learn

How to connect a Next.js frontend to a real backend API -- replacing mock data with actual HTTP calls, handling authentication, managing errors gracefully, and implementing optimistic updates for a snappy user experience. This course includes its own backend API so you can work with both sides of the stack.

## Prerequisites

- Familiar with REST APIs and React/Next.js basics
- Node.js 20+ installed

## Lessons

| # | Lesson | Topic |
|---|--------|-------|
| 01 | [fetch-vs-axios](./lessons/01-fetch-vs-axios/) | Compare fetch and axios for HTTP requests |
| 02 | [replace-mock-data](./lessons/02-replace-mock-data/) | Swap hardcoded data for real API calls |
| 03 | [server-components](./lessons/03-server-components/) | Fetch data in React Server Components |
| 04 | [client-mutations](./lessons/04-client-mutations/) | Handle form submissions and mutations |
| 05 | [auth-flow](./lessons/05-auth-flow/) | Implement login, signup, and token management |
| 06 | [error-handling-ux](./lessons/06-error-handling-ux/) | Build user-friendly error states |
| 07 | [optimistic-updates](./lessons/07-optimistic-updates/) | Update the UI before the server responds |
| 08 | [environment-config](./lessons/08-environment-config/) | Manage env variables across environments |

### Quick Start

```bash
make setup         # Install all dependencies
make dev-backend   # Start backend API at http://localhost:3001
make dev-frontend  # Start Next.js frontend at http://localhost:3000

# Or with Docker:
make docker-up     # Start both services
```

## Commands

Run `make help` to see all available commands.
