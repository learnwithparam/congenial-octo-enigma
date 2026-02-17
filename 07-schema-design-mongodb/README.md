# 07 -- Schema Design with MongoDB

Document Databases for Flexible, Fast Data.

## What You'll Learn

How to design effective document schemas with MongoDB -- from understanding when documents beat tables, to modeling with Mongoose, embedding vs referencing, aggregation pipelines, and knowing when to use multiple databases together.

## Prerequisites

- Completed Course 06 or familiar with database concepts
- Docker installed for running MongoDB locally
- Node.js 20+ installed

## Lessons

| # | Lesson | Topic |
|---|--------|-------|
| 01 | [documents-vs-tables](./lessons/01-documents-vs-tables/) | When to choose documents over relational tables |
| 02 | [docker-mongo](./lessons/02-docker-mongo/) | Run MongoDB in Docker |
| 03 | [mongoose-models](./lessons/03-mongoose-models/) | Define schemas and models with Mongoose |
| 04 | [embedding-referencing](./lessons/04-embedding-referencing/) | Embed nested data vs reference other collections |
| 05 | [crud-operations](./lessons/05-crud-operations/) | Create, read, update, and delete documents |
| 06 | [aggregation-pipelines](./lessons/06-aggregation-pipelines/) | Build multi-stage data processing pipelines |
| 07 | [indexes-performance](./lessons/07-indexes-performance/) | Index strategies for fast queries |
| 08 | [polyglot-persistence](./lessons/08-polyglot-persistence/) | Use the right database for each job |

## Quick Start

```bash
docker compose up -d   # Start MongoDB
make setup             # Install deps and create .env
make dev               # Start the dev server
```

## Commands

Run `make help` to see all available commands.
