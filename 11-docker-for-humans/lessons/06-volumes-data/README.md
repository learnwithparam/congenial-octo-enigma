# Volumes and Data

Containers are ephemeral by design -- when you remove a container, everything inside it disappears. But your database data, uploaded files, and logs need to survive restarts. Docker volumes solve this problem. In this lesson, we will understand the different types of volumes and how our Compose setup uses them.

## What You'll Learn

- Why container data is ephemeral and why that matters
- The difference between named volumes and bind mounts
- How to persist PostgreSQL data across container restarts
- How bind mounts enable live code reloading in development

## Key Concepts

### The Ephemeral Container Problem

Every container has its own writable layer on top of the image's read-only layers. When you write files inside a container, they exist only in that layer. Delete the container, and the data is gone.

For our LaunchPad API, this has two implications:

1. **In-memory data**: The startup listings stored in the `Map` in `app/src/routes/startups.ts` are lost on every restart. This is a code-level concern, not a Docker concern.
2. **Database data**: If we run PostgreSQL in a container without a volume, all tables and rows disappear when the container is removed.

Volumes decouple data storage from the container lifecycle.

### Named Volumes

A named volume is a Docker-managed storage area that exists independently of any container. Docker handles where the data is physically stored on the host file system.

In our extended Compose file, we use a named volume for PostgreSQL:

```yaml
services:
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Here is what happens:
- `pgdata` is the volume name
- `/var/lib/postgresql/data` is the path inside the container where PostgreSQL stores its data files
- Docker creates the `pgdata` volume on first run and mounts it at that path
- When you `docker compose down`, the volume persists. When you `docker compose up` again, the same volume is remounted and all your data is still there

Named volumes are the right choice for production data like databases.

### Bind Mounts

A bind mount maps a specific path on your host machine to a path inside the container. Our Compose file uses this for development:

```yaml
services:
  app:
    volumes:
      - ./app/src:/app/src
```

This maps `./app/src` (on your laptop) to `/app/src` (inside the container). The two directories are synchronized -- changes on either side are immediately visible to the other.

This is what makes hot reloading work: you edit `app/src/routes/startups.ts` in your editor, the change is instantly visible inside the container, and `tsx watch` detects the change and restarts the server.

### Named Volumes vs Bind Mounts

| Feature | Named Volume | Bind Mount |
|---------|-------------|------------|
| Managed by | Docker | You |
| Host path | Docker decides | You specify |
| Use case | Database data, persistent storage | Live code editing, config files |
| Performance | Optimized by Docker | Depends on host OS |
| In Compose | `volumename:/container/path` | `./host/path:/container/path` |

The syntax tells them apart: if the left side starts with `.` or `/`, it is a bind mount. If it is a plain name, it is a named volume.

## Step by Step

### Step 1: See Data Loss Without Volumes

Let us demonstrate the problem. Start the app:

```bash
docker compose up -d
```

Create a startup via the API:

```bash
curl -X POST http://localhost:3000/api/startups \
  -H "Content-Type: application/json" \
  -d '{"name":"DataVault","description":"Encrypted cloud storage","industry":"Security","founded":2024}'
```

Verify it exists:

```bash
curl http://localhost:3000/api/startups
```

You should see three startups: the two seeds (CloudKitchen and GreenRoute) plus DataVault.

Now restart the container:

```bash
docker compose down
docker compose up -d
```

Check the startups again:

```bash
curl http://localhost:3000/api/startups
```

DataVault is gone. Only the two seed startups remain. The in-memory `Map` was reset when the container restarted. This is the ephemeral container problem in action.

### Step 2: Understand the Database Volume

If we had a database service with a named volume, the story would be different. In our extended Compose setup:

```yaml
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: launchpad
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: launchpad

volumes:
  pgdata:
```

The `volumes:` section at the bottom (at the same level as `services:`) declares the named volume. Docker allocates storage for it automatically.

### Step 3: Verify Volume Persistence

Start the full stack with the database:

```bash
docker compose up -d
```

Connect to PostgreSQL and create a table:

```bash
docker compose exec db psql -U launchpad -d launchpad -c "
  CREATE TABLE test_persistence (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL
  );
  INSERT INTO test_persistence (message) VALUES ('I will survive');
"
```

Now tear down the containers (but keep volumes):

```bash
docker compose down
```

Start everything again:

```bash
docker compose up -d
```

Check if the data survived:

```bash
docker compose exec db psql -U launchpad -d launchpad -c "SELECT * FROM test_persistence;"
```

The row is still there. The named volume preserved the data.

### Step 4: Destroy the Volume

To completely reset the database (useful when you want a fresh start):

```bash
docker compose down -v
```

The `-v` flag removes named volumes. Next time you start the stack, PostgreSQL will initialize from scratch.

### Step 5: Verify the Bind Mount for Development

With the stack running, the bind mount `./app/src:/app/src` is active. Edit `app/src/routes/startups.ts` and add a third seed startup:

```typescript
const seeds: CreateStartupInput[] = [
  {
    name: "CloudKitchen",
    description: "AI-powered ghost kitchen platform",
    industry: "FoodTech",
    founded: 2023,
  },
  {
    name: "GreenRoute",
    description: "Carbon-neutral last-mile delivery",
    industry: "Logistics",
    founded: 2022,
  },
  {
    name: "FinLedger",
    description: "Blockchain-based financial auditing",
    industry: "FinTech",
    founded: 2024,
  },
];
```

Save the file and watch the logs:

```bash
docker compose logs -f app
```

You should see `tsx watch` detect the change and restart the server. Curl the endpoint to confirm:

```bash
curl http://localhost:3000/api/startups
```

Three startups appear, and you never had to rebuild the image.

### Step 6: List and Inspect Volumes

See all Docker volumes on your machine:

```bash
docker volume ls
```

Inspect a specific volume for details:

```bash
docker volume inspect 11-docker-for-humans_pgdata
```

This shows the volume's mount point on the host filesystem, driver, and creation date.

### Step 7: Remove Unused Volumes

Over time, orphaned volumes accumulate. Clean them up:

```bash
docker volume prune
```

This removes only volumes not attached to any container.

## Exercise

1. Start the app with `docker compose up -d`. Create a startup via POST, then run `docker compose down && docker compose up -d` and verify the data is lost (because it is in-memory)
2. Add the PostgreSQL service with a named volume to your Compose file. Start the stack, create a table in PostgreSQL, run `docker compose down`, then `docker compose up -d` and verify the data persisted
3. Run `docker compose down -v` and confirm the database is reset on next startup
4. Edit a file in `app/src/` while the stack is running and observe the bind mount and hot reload in action
5. Run `docker volume ls` to see all volumes on your system

## Summary

- Container data is ephemeral -- removing a container removes its writable layer
- Named volumes are Docker-managed persistent storage, ideal for databases
- Bind mounts map host directories to container paths, ideal for development code editing
- Named volume syntax: `volumename:/container/path`; bind mount syntax: `./host/path:/container/path`
- `docker compose down` preserves volumes; `docker compose down -v` removes them
- The bind mount in our Compose file enables hot reloading without rebuilding the image
