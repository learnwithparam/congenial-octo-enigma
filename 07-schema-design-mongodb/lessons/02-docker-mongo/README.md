# Docker Mongo

Before writing any code, you need a running MongoDB instance. Docker makes this painless -- one command gives you a fully configured database with no installation headaches.

## What You'll Learn

- How to run MongoDB 7 in Docker using docker-compose
- How to connect to MongoDB with `mongosh`
- How connection strings work and how to configure them
- How to verify your database is running and ready

## Key Concepts

### Why Docker for MongoDB?

Installing MongoDB directly on your machine means dealing with platform-specific packages, version conflicts, and cleanup when you are done. Docker gives you:

- A clean, isolated MongoDB instance
- Easy version pinning (we use MongoDB 7)
- Persistent data via Docker volumes
- One command to start, one command to stop

### The docker-compose File

Our project includes a `docker-compose.yml` at the course root that defines two services:

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db

  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    volumes:
      - ./backend/src:/app/src
    environment:
      - MONGODB_URI=mongodb://mongo:27017/launchpad
      - PORT=3001
    depends_on:
      - mongo

volumes:
  mongodata:
```

Key things to note:

- `mongo:7` pulls the official MongoDB 7 image
- Port `27017` is mapped to your host so you can connect from your machine
- `mongodata` is a named volume that persists your data between container restarts
- The `api` service mounts `./backend/src` so code changes are picked up automatically
- `depends_on` ensures MongoDB starts before the API

### Connection Strings

A MongoDB connection string follows this format:

```
mongodb://<host>:<port>/<database>
```

For local development with Docker, the connection string is:

```
mongodb://localhost:27017/launchpad
```

When the API runs inside Docker alongside the MongoDB container, it uses the Docker service name as the host:

```
mongodb://mongo:27017/launchpad
```

Our codebase reads this from an environment variable. The `.env.example` file contains:

```
MONGODB_URI=mongodb://localhost:27017/launchpad
```

In `backend/src/db.ts`, the connection is established like this:

```typescript
import { MongoClient, Db } from 'mongodb';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/launchpad';

const client = new MongoClient(MONGODB_URI);

let db: Db;

export async function connectDb(): Promise<Db> {
  if (db) return db;
  await client.connect();
  db = client.db();
  console.log(`Connected to MongoDB: ${db.databaseName}`);
  return db;
}

export async function closeDb(): Promise<void> {
  await client.close();
  console.log('MongoDB connection closed.');
}
```

The `connectDb` function caches the database instance so repeated calls do not create new connections. The database name (`launchpad`) comes from the URI.

## Step by Step

### Step 1: Start MongoDB with Docker

From the course root directory, run:

```bash
make docker-up
```

This runs `docker compose up -d`, starting MongoDB in the background. You should see output confirming both containers are running:

```
MongoDB running on port 27017, API on port 3001
```

If you prefer running only MongoDB (and the API on your host), you can start just the mongo service:

```bash
docker compose up -d mongo
```

### Step 2: Verify MongoDB Is Running

Check that the container is up:

```bash
docker compose ps
```

You should see the `mongo` service listed with status `Up` and port `27017` mapped.

### Step 3: Connect with mongosh

`mongosh` is the MongoDB Shell. If you have it installed locally:

```bash
mongosh mongodb://localhost:27017/launchpad
```

If you do not have `mongosh` installed, run it inside the Docker container:

```bash
docker compose exec mongo mongosh launchpad
```

Once connected, you can run commands directly:

```javascript
// Show current database
db.getName()
// "launchpad"

// List collections (empty until we seed data)
show collections

// Check server status
db.serverStatus().version
// "7.x.x"
```

### Step 4: Set Up the Backend

If you want to run the backend outside Docker (recommended for development), set up the environment:

```bash
make setup
```

This copies `.env.example` to `.env` and installs npm dependencies. Then start the dev server:

```bash
make dev
```

The `dev` script uses `tsx watch` to run `src/index.ts` with hot reloading.

### Step 5: Seed the Database

Once MongoDB is running and your backend is set up, seed the database with sample data:

```bash
cd backend && npx tsx src/seed.ts
```

This script connects to MongoDB, clears existing data, inserts sample users, categories, and startups, then creates indexes. You should see:

```
Connected to MongoDB: launchpad
Seeding database...
Inserted 5 users.
Inserted 5 categories.
Inserted 8 startups.
Indexes created.
Seeding complete.
MongoDB connection closed.
```

### Step 6: Verify the Seed Data

Connect with `mongosh` and query the data:

```javascript
mongosh mongodb://localhost:27017/launchpad

db.users.countDocuments()
// 5

db.categories.find().toArray()
// [{name: 'Developer Tools', slug: 'developer-tools', ...}, ...]

db.startups.findOne({ slug: 'codeflow' })
// {name: 'CodeFlow', tagline: 'Collaborative code review...', comments: [...], ...}
```

## Exercise

1. Start MongoDB with `make docker-up`
2. Connect using `mongosh` (either locally or via Docker exec)
3. Run `show dbs` to list all databases
4. Run `use launchpad` and `show collections` to explore the database
5. Run `db.startups.findOne()` to see what a raw document looks like
6. Try inserting a test document: `db.test.insertOne({ hello: "world" })` and then reading it back with `db.test.findOne()`
7. Clean up the test collection: `db.test.drop()`

## Summary

- Docker Compose gives you a reproducible MongoDB 7 setup with one command
- Named volumes persist your data between container restarts
- Connection strings follow the `mongodb://host:port/database` format
- `mongosh` lets you interact with MongoDB directly from the terminal
- The `db.ts` module handles connecting to MongoDB and caching the database instance
- The seed script populates the database with sample users, categories, and startups
