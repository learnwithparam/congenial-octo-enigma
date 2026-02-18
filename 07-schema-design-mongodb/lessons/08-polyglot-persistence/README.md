# Polyglot Persistence

Most real-world applications do not use just one database. Polyglot persistence means choosing the right database for each part of your system. This lesson explores when MongoDB and PostgreSQL each shine, and how to use them together in a single application.

## What You'll Learn

- What polyglot persistence is and why it matters
- The strengths and weaknesses of MongoDB vs PostgreSQL
- How to decide which database fits each part of your application
- Practical patterns for using multiple databases together
- How the LaunchPad data model maps to each approach

## Key Concepts

### What Is Polyglot Persistence?

Polyglot persistence is the practice of using different database technologies for different parts of an application, based on the data access patterns and requirements of each part.

Instead of asking "should I use MongoDB or PostgreSQL?", you ask "which database is the best fit for this specific data and these specific queries?"

### MongoDB Strengths

MongoDB excels when:

- Your data has a hierarchical, document-like structure
- You need flexible schemas that evolve without migrations
- Read patterns align with the document shape (fetch a startup with all its comments)
- You embed related data to avoid joins
- You need horizontal scaling (sharding across multiple servers)
- You work with semi-structured data (logs, events, content)

In our LaunchPad application, MongoDB is a natural fit because startups are self-contained documents with embedded comments and upvotes. A single `findOne` call returns everything you need for a startup detail page.

### PostgreSQL Strengths

PostgreSQL excels when:

- You need ACID transactions across multiple tables (e.g., transferring money between accounts)
- Your data is highly relational with many cross-references
- You need complex queries with multiple joins
- You need strict schema enforcement with constraints and foreign keys
- You use advanced SQL features (window functions, CTEs, full-text search)
- You need strong consistency guarantees

### The LaunchPad Example: Where Each Fits

Consider the different parts of a startup directory application:

| Data | Best Fit | Why |
|------|----------|-----|
| Startup listings with comments and upvotes | MongoDB | Hierarchical, read-heavy, embedded subdocuments |
| User accounts with authentication | PostgreSQL | Transactional, relational (sessions, passwords, roles) |
| Payment processing and billing | PostgreSQL | ACID transactions, financial integrity |
| Activity feed / event log | MongoDB | Append-heavy, flexible schema, time-series |
| Categories and tags | Either | Simple key-value, low write frequency |
| Search index | Neither (use Elasticsearch) | Full-text search at scale |

### How They Would Work Together

In a production version of LaunchPad, you might structure the architecture like this:

```
┌─────────────────────────────┐
│        Application          │
├──────────┬──────────────────┤
│          │                  │
│  PostgreSQL            MongoDB
│  - users (auth)        - startups
│  - sessions            - comments (embedded)
│  - payments            - upvotes (embedded)
│  - billing             - activity_log
│                        - categories
└──────────┴──────────────────┘
```

PostgreSQL handles everything that needs transactions and strict integrity. MongoDB handles the content that benefits from document flexibility and embedded data.

## Step by Step

### Step 1: Identify Data Access Patterns

Before choosing a database, map out how your application reads and writes data:

- Startup detail page: read one document with all embedded data (document-oriented)
- User login: check email/password, create session token (transactional)
- Payment checkout: charge card, create invoice, update subscription (multi-step transaction)
- Browse by category: list startups filtered by a field (document-oriented)
- Admin dashboard: complex reports joining users, payments, and startups (relational)

Each pattern has a natural fit. The startup detail page screams document database. The payment flow demands ACID transactions.

### Step 2: Draw the Boundary

The key question is: where do you draw the line between the two databases?

A good boundary follows these rules:

- Data that is transactional and relational goes to PostgreSQL
- Data that is hierarchical and read-heavy goes to MongoDB
- Shared references (like user IDs) cross the boundary

In our LaunchPad code, the `founderId` on a startup document could point to a user stored in PostgreSQL. The application would query MongoDB for the startup and PostgreSQL for the founder's details. The `$lookup` approach we used in the aggregations lesson works within MongoDB, but in a polyglot setup you would handle the join in your application code.

### Step 3: Handle Cross-Database References

When the same entity (like a user) exists in both databases, you need a shared identifier:

```typescript
// MongoDB startup document
{
  name: "CodeFlow",
  founderId: "user_abc123",  // String ID matching PostgreSQL
  // ...
}

// PostgreSQL users table
// id: "user_abc123", name: "Alice", email: "alice@example.com"
```

Using a string identifier (like a UUID) instead of MongoDB's `ObjectId` makes cross-database references cleaner. Both databases can store and query string IDs efficiently.

### Step 4: Application-Level Joins

With two databases, joins happen in your application code:

```typescript
async function getStartupWithFounder(slug: string) {
  // Query MongoDB for the startup
  const startup = await getStartupsCol().findOne({ slug });
  if (!startup) return null;

  // Query PostgreSQL for the founder
  const founder = await pgPool.query(
    'SELECT id, name, email FROM users WHERE id = $1',
    [startup.founderId]
  );

  return {
    ...startup,
    founder: founder.rows[0],
  };
}
```

This is more code than a single `$lookup`, but it gives you the benefit of each database doing what it does best.

### Step 5: Keep Connections Separate

Each database gets its own connection module. Our MongoDB connection is in `backend/src/db.ts`:

```typescript
import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/launchpad';
const client = new MongoClient(MONGODB_URI);

export async function connectDb(): Promise<Db> {
  if (db) return db;
  await client.connect();
  db = client.db();
  return db;
}
```

A PostgreSQL connection would be similar but separate:

```typescript
import { Pool } from 'pg';

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export { pgPool };
```

Both connections are initialized at application startup. Each module manages its own lifecycle.

### Step 6: Docker Compose for Multiple Databases

Extending our `docker-compose.yml` to include PostgreSQL alongside MongoDB:

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db

  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: launchpad
      POSTGRES_USER: launchpad
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/launchpad
      - DATABASE_URL=postgres://launchpad:secret@postgres:5432/launchpad
    depends_on:
      - mongo
      - postgres

volumes:
  mongodata:
  pgdata:
```

Each database runs in its own container with its own volume. The API service connects to both.

### Step 7: When Not to Go Polyglot

Using multiple databases adds complexity:

- Two connections to manage and monitor
- Cross-database joins happen in application code
- Data consistency across databases is your responsibility
- Deployment and backup procedures are more complex

Start with one database. Only add a second when you have a clear reason -- a data access pattern that does not fit the first database well. For many applications, MongoDB or PostgreSQL alone is sufficient.

## Exercise

Think about an application you have worked on (or want to build) and answer these questions:

1. List the main entities in the application (users, products, orders, etc.)
2. For each entity, describe the most common read and write patterns
3. Which entities are transactional (need ACID guarantees)?
4. Which entities are hierarchical or document-like?
5. Draw a boundary: which entities go to PostgreSQL and which go to MongoDB?
6. Identify any cross-database references and decide how you would handle them

Write your analysis as a brief design document with a table showing each entity, its database, and the reasoning.

## Summary

- Polyglot persistence means using the right database for each part of your application
- MongoDB is ideal for hierarchical, read-heavy data with embedded subdocuments
- PostgreSQL is ideal for transactional, highly relational data with strict integrity needs
- Shared identifiers (UUIDs or string IDs) bridge references across databases
- Application-level joins replace database-level joins when data spans two databases
- Docker Compose makes it straightforward to run multiple databases locally
- Start with one database and add a second only when a clear access pattern demands it
- The overhead of managing multiple databases (connections, consistency, deployment) is real -- weigh it against the benefits
