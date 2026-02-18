# 03 -- REST APIs That Don't Suck

Build and Test Production APIs with Express and SQLite.

## What You'll Learn

How to design, build, and test RESTful APIs using Express and SQLite --
covering CRUD operations, validation, pagination, testing, and documentation.

## Prerequisites

- JavaScript/TypeScript fundamentals
- Node.js installed (v18+)
- Comfortable with JavaScript/TypeScript and Node.js

## Lessons

| # | Lesson | Topic |
|---|--------|-------|
| 01 | [hello-express](./lessons/01-hello-express/) | Set up an Express server from scratch |
| 02 | [rest-principles](./lessons/02-rest-principles/) | Understand REST conventions and HTTP methods |
| 03 | [crud-in-memory](./lessons/03-crud-in-memory/) | Build CRUD endpoints with in-memory storage |
| 04 | [sqlite-setup](./lessons/04-sqlite-setup/) | Set up SQLite with better-sqlite3 |
| 05 | [crud-with-database](./lessons/05-crud-with-database/) | Move CRUD operations to the database |
| 06 | [validation-errors](./lessons/06-validation-errors/) | Add input validation and error handling |
| 07 | [pagination-filtering](./lessons/07-pagination-filtering/) | Implement pagination and filtering |
| 08 | [postman-pro](./lessons/08-postman-pro/) | Test APIs effectively with Postman |
| 09 | [automated-tests](./lessons/09-automated-tests/) | Write automated tests with Vitest and Supertest |
| 10 | [api-documentation](./lessons/10-api-documentation/) | Document your API for consumers |

### Quick Start

```bash
make setup    # Install dependencies
make dev      # Start API at http://localhost:3001

# Or with Docker:
make docker-up   # Start everything in containers
```

## Commands

Run `make help` to see all available commands.
