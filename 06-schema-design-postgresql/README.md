# 06 -- Schema Design with PostgreSQL

Relational Database Design That Scales.

## What You'll Learn

How to design robust relational database schemas with PostgreSQL -- from tables and relationships to indexes, migrations with Drizzle ORM, complex queries, and full-text search.

## Prerequisites

- Comfortable with SQL basics (SELECT, INSERT, UPDATE, DELETE)
- Docker installed for running PostgreSQL locally
- Node.js 20+ installed

## Lessons

| # | Lesson | Topic |
|---|--------|-------|
| 01 | [why-postgresql](./lessons/01-why-postgresql/) | Why PostgreSQL is the go-to relational database |
| 02 | [docker-postgres](./lessons/02-docker-postgres/) | Run PostgreSQL in Docker |
| 03 | [tables-types](./lessons/03-tables-types/) | Create tables with proper column types |
| 04 | [relationships](./lessons/04-relationships/) | Model one-to-many and many-to-many relationships |
| 05 | [normalization](./lessons/05-normalization/) | Normalize your schema to reduce redundancy |
| 06 | [drizzle-setup](./lessons/06-drizzle-setup/) | Set up Drizzle ORM with TypeScript |
| 07 | [migrations](./lessons/07-migrations/) | Generate and run database migrations |
| 08 | [indexes-performance](./lessons/08-indexes-performance/) | Add indexes to speed up queries |
| 09 | [complex-queries](./lessons/09-complex-queries/) | Write joins, subqueries, and CTEs |
| 10 | [full-text-search](./lessons/10-full-text-search/) | Implement full-text search with PostgreSQL |

## Quick Start

```bash
docker compose up -d   # Start PostgreSQL
make setup             # Install deps and create .env
make dev               # Start the dev server
```

## Commands

Run `make help` to see all available commands.
