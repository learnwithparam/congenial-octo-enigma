# 11 — Docker for Humans

Containers, Compose, and Makefiles That Actually Help.

## What You'll Learn

How to containerize applications with Docker, orchestrate multi-service setups with Docker Compose, use volumes for persistent data, build optimized multi-stage images, and create Makefiles that make Docker workflows painless.

## Prerequisites

- Docker Desktop installed
- Comfortable with the command line
- Basic understanding of web servers and databases

## Lessons

| # | Lesson | Topic |
|---|--------|-------|
| 01 | [why-docker](./lessons/01-why-docker/) | The problem Docker solves |
| 02 | [first-dockerfile](./lessons/02-first-dockerfile/) | Writing your first Dockerfile |
| 03 | [docker-commands](./lessons/03-docker-commands/) | Essential Docker CLI commands |
| 04 | [compose-basics](./lessons/04-compose-basics/) | Introduction to Docker Compose |
| 05 | [compose-full-stack](./lessons/05-compose-full-stack/) | Running a full stack with Compose |
| 06 | [volumes-data](./lessons/06-volumes-data/) | Volumes and persistent data |
| 07 | [multi-stage-builds](./lessons/07-multi-stage-builds/) | Optimizing images with multi-stage builds |
| 08 | [environment-variables](./lessons/08-environment-variables/) | Managing environment variables in containers |
| 09 | [makefile-magic](./lessons/09-makefile-magic/) | Makefiles that tame Docker workflows |
| 10 | [debugging-containers](./lessons/10-debugging-containers/) | Debugging containers when things go wrong |

## Quick Start

```bash
make setup
make build
make up
```

## Commands

Run `make help` to see all available commands.
