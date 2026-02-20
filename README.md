# Fullstack Masterclass — LaunchPad Series

Build a real startup directory and discovery platform (think Product Hunt / TrustMRR) from scratch. Every course builds a piece of **LaunchPad**, giving you a portfolio-worthy fullstack project by the end.

## What You'll Build

**LaunchPad** is a startup directory where founders can list their products, users can discover and upvote them, and everyone can search, filter, and explore. Through 13 hands-on courses, you'll build every layer — from system design to frontend, APIs, databases, caching, background jobs, microservices, Docker, CI/CD, and AI-assisted development.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 15, React, Tailwind CSS v4, TypeScript |
| **API** | Express, REST, GraphQL (Apollo Server) |
| **Databases** | SQLite, PostgreSQL (Drizzle ORM), MongoDB (Mongodb driver) |
| **Caching & Queues** | Redis, BullMQ |
| **Infrastructure** | Docker, Docker Compose, Makefile |
| **CI/CD** | Git, GitHub Actions |
| **AI Tools** | Claude Code, Cursor |

## Prerequisites

- Basic JavaScript/TypeScript knowledge
- Node.js 20+ installed
- Docker Desktop installed
- A code editor (VS Code recommended)
- A GitHub account
- Curiosity and willingness to build

## Course Map

| # | Course | Lessons | What You'll Build |
|---|--------|---------|-------------------|
| 01 | [Think in Systems](./01-think-in-systems/) | 8 | Technical spec, data models, API contracts for LaunchPad |
| 02 | [Ship Your First Page](./02-ship-your-first-page/) | 12 | Complete LaunchPad frontend with Next.js and Tailwind |
| 03 | [REST APIs That Don't Suck](./03-rest-apis-that-dont-suck/) | 10 | Full CRUD API with Express, SQLite, validation, tests |
| 04 | [GraphQL From Scratch](./04-graphql-from-scratch/) | 10 | GraphQL API with Apollo Server, DataLoader, subscriptions |
| 05 | [Connect the Dots](./05-connect-the-dots/) | 8 | Wire frontend to real API, auth flow, optimistic updates |
| 06 | [Schema Design PostgreSQL](./06-schema-design-postgresql/) | 10 | Production PostgreSQL schema with Drizzle ORM |
| 07 | [Schema Design MongoDB](./07-schema-design-mongodb/) | 8 | Document database with MongoDB native driver, aggregation pipelines |
| 08 | [Make It Fast with Caching](./08-make-it-fast-with-caching/) | 8 | Redis caching, rate limiting, performance optimization |
| 09 | [Background Jobs and Queues](./09-background-jobs-and-queues/) | 8 | BullMQ job queues, email notifications, scheduled jobs |
| 10 | [Microservices That Make Sense](./10-microservices-that-make-sense/) | 10 | Service extraction, API gateway, distributed logging |
| 11 | [Docker for Humans](./11-docker-for-humans/) | 10 | Dockerfiles, Compose, multi-stage builds for all services |
| 12 | [Git Without Fear](./12-git-without-fear/) | 8 | Git workflows, branching, PRs, GitHub Actions CI |
| 13 | [Build with AI Copilots](./13-build-with-ai-copilots/) | 8 | AI-assisted development with Claude Code |

**Total: 118 lessons across 13 courses**

## Learning Path

Each course is independently completable with its own starter code, but they work best in this recommended order:

```
Phase 1 — Foundations (can be done in parallel)
├── 01 Think in Systems
├── 02 Ship Your First Page
└── 03 REST APIs That Don't Suck

Phase 2 — Integration
├── 04 GraphQL From Scratch          (benefits from 03)
├── 05 Connect the Dots              (requires 02 + 03)
└── 06 Schema Design PostgreSQL      (benefits from 03)

Phase 3 — Data & Performance
├── 07 Schema Design MongoDB         (benefits from 06)
├── 08 Make It Fast with Caching
└── 09 Background Jobs and Queues

Phase 4 — Scale & Ship
├── 10 Microservices That Make Sense  (benefits from 08, 09)
└── 11 Docker for Humans             (containerizes everything)

Phase 5 — Workflow (independent, do anytime)
├── 12 Git Without Fear
└── 13 Build with AI Copilots
```

## Per-Course Structure

Each course follows a consistent structure:

```
NN-course-slug/
├── README.md              # Course overview, lesson table, quick start
├── package.json           # Dependencies (absent for markdown-only courses)
├── Makefile               # make dev, make test, make setup, make clean
├── .env.example           # Environment variables template
├── .gitignore
├── docker-compose.yml     # When external services needed
├── lessons/
│   ├── 01-topic-name/
│   │   └── README.md      # Lesson instructions
│   └── ...
├── frontend/              # Cumulative project code (might also be backend/, app/, or src/)
└── tests/                 # Test files
```

## Quick Start

```bash
# Clone the repo
git clone <repo-url>
cd fullstack-masterclass

# Pick a course and get started
cd 02-ship-your-first-page
make setup
make dev
```

## How Each Course Works

1. **Read the course README** for overview and prerequisites
2. **Follow lessons in order** — each builds cumulatively on the previous one
3. **Read the lesson `README.md`** for instructions and explanations
4. **Write code in the main course directory** (like `frontend/` or `backend/`) following the lesson steps
5. **Run `make help`** in any course to see available commands

## Contributing

Found a typo? Have a suggestion? Want to improve a lesson?
- Open an issue
- Submit a pull request
- Share your feedback

---

**Happy building!**
