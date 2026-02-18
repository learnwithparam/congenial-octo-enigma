# Run PostgreSQL in Docker

Running a database directly on your development machine creates problems. Different projects need different PostgreSQL versions. Settings bleed across projects. Uninstalling is messy. Docker solves all of this by running PostgreSQL inside an isolated container that you can start, stop, and destroy without affecting anything else on your machine. In this lesson, you will learn how to use Docker and Docker Compose to run PostgreSQL for the LaunchPad project, configure it with environment variables, persist data with volumes, and connect to it from both psql and your application code.

## What You Will Learn

- Why Docker is the preferred way to run databases in development
- How to write a docker-compose.yml file for PostgreSQL
- How to configure PostgreSQL with environment variables
- How to persist data across container restarts using volumes
- How to connect to your Dockerized PostgreSQL from psql and pgAdmin
- Essential Docker commands for managing your database container

## Concepts

### Why Docker for Databases

Imagine you are working on three projects. One uses PostgreSQL 14, another uses PostgreSQL 16, and the third needs PostgreSQL 17 with the PostGIS extension. Installing all three versions natively on your machine is a nightmare of conflicting binaries, data directories, and port numbers.

Docker gives each project its own isolated PostgreSQL instance. Each runs in a container, which is a lightweight, isolated environment that shares your operating system's kernel but has its own filesystem, network, and process space. Containers start in seconds, use minimal resources, and can be destroyed without leaving traces on your host system.

Here is what Docker gives you for database development:

Reproducibility: Every team member gets the exact same PostgreSQL version and configuration by sharing a single docker-compose.yml file. No more "it works on my machine" problems.

Isolation: Each project has its own database server, its own port, and its own data directory. No cross-contamination between projects.

Easy reset: Need to start fresh? Delete the container and its volume. A clean database is one command away. This is invaluable during development when your schema changes frequently.

Version pinning: You specify the exact PostgreSQL version in your Docker image tag. Upgrading means changing one number in your configuration file.

### Docker Compose Basics

Docker Compose is a tool for defining and running multi-container applications. You describe your services (database, web server, cache, etc.) in a YAML file called docker-compose.yml, and Docker Compose handles creating the containers, networks, and volumes.

For now, we only need one service: PostgreSQL. But as your application grows, you might add Redis for caching, or a separate container for running migrations. Docker Compose makes adding services trivial.

A Docker Compose file has three main sections:

Services define the containers you want to run. Each service has an image (the base software), environment variables, port mappings, and volume mounts.

Volumes define persistent storage. By default, data inside a container is lost when the container is removed. Volumes store data on your host machine so it survives container restarts and removals.

Networks define how containers communicate. Docker Compose creates a default network for all services in the file, so containers can reach each other by service name.

### Environment Variables for PostgreSQL

The official PostgreSQL Docker image accepts several environment variables to configure the database on first startup:

POSTGRES_USER sets the superuser username. If omitted, it defaults to "postgres". For development, using "postgres" is fine.

POSTGRES_PASSWORD sets the superuser password. This is the only required variable. The container will refuse to start without it.

POSTGRES_DB sets the name of the default database created on first startup. If omitted, it matches the POSTGRES_USER value. We will set this to "launchpad" for our project.

There are additional variables you rarely need in development:

PGDATA sets the data directory path inside the container. The default is /var/lib/postgresql/data.

POSTGRES_INITDB_ARGS passes additional arguments to the initdb command that initializes the database cluster.

### Volumes and Data Persistence

This is a critical concept that trips up many beginners. Containers are ephemeral by default. When you remove a container (docker compose down), all data inside it is deleted. This includes your database tables, rows, and everything else.

Volumes solve this by mapping a directory on your host machine to a directory inside the container. When PostgreSQL writes data inside the container, it actually writes to your host filesystem through the volume mount. When you recreate the container, it picks up the existing data from the volume.

Docker Compose supports two types of volumes:

Named volumes are managed by Docker. You give them a name, and Docker decides where to store the files on your host. This is the recommended approach because it works the same way on macOS, Linux, and Windows.

Bind mounts map a specific directory on your host to a directory in the container. These are useful for sharing source code between your machine and a container, but for database data, named volumes are safer and more portable.

### Ports and Networking

PostgreSQL listens on port 5432 by default. When running in Docker, you need to map a port on your host machine to port 5432 inside the container. The mapping syntax is HOST_PORT:CONTAINER_PORT.

If you only have one PostgreSQL instance, mapping 5432:5432 is straightforward. But if another project already uses port 5432, you can map to a different host port like 5433:5432. Your application connects to localhost:5433, and Docker forwards the traffic to port 5432 inside the container.

## Step by Step

### Step 1: Verify Docker Is Installed

Open your terminal and verify that Docker and Docker Compose are available:

```bash
docker --version
```

You should see something like:

```
Docker version 27.x.x, build xxxxxxx
```

Check Docker Compose:

```bash
docker compose version
```

You should see:

```
Docker Compose version v2.x.x
```

Note: Modern Docker includes Compose as a plugin, so you use "docker compose" (with a space) rather than the older "docker-compose" (with a hyphen). Both work, but the space version is current.

If Docker is not installed, download Docker Desktop from docker.com for macOS or Windows. For Linux, install Docker Engine following the official documentation.

### Step 2: Create the Project Directory Structure

Navigate to the LaunchPad project root and create the necessary files:

```bash
mkdir -p 06-schema-design-postgresql
cd 06-schema-design-postgresql
```

If you are following along in the workshop repository, you are already in the right directory. Create the docker-compose.yml file at the project root.

### Step 3: Write the Docker Compose File

Create a file called docker-compose.yml with the following content:

```yaml
version: '3.8'

services:
  db:
    image: postgres:17-alpine
    container_name: launchpad_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: launchpad
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

Let us break down every line.

image: postgres:17-alpine uses the official PostgreSQL 17 image based on Alpine Linux. Alpine images are smaller (about 80MB vs 400MB for the Debian-based image) and contain fewer unnecessary packages, which reduces the attack surface.

container_name: launchpad_db gives the container a human-readable name. Without this, Docker would generate a random name like "06-schema-design-postgresql-db-1".

restart: unless-stopped means Docker will automatically restart the container if it crashes, unless you explicitly stop it with docker compose stop.

The environment section sets the three key variables. For development, using "postgres" as both the username and password is fine. Never use these credentials in production.

ports maps host port 5432 to container port 5432. If port 5432 is already in use on your machine, change the left number (e.g., '5433:5432').

volumes mounts the named volume pgdata to PostgreSQL's data directory. This is what makes your data persist across container restarts.

The healthcheck section tells Docker how to determine if PostgreSQL is ready to accept connections. The pg_isready command is a PostgreSQL utility that checks if the server is accepting connections. Docker will run this command every 5 seconds and mark the container as healthy once it succeeds. This is especially useful when other services depend on the database being ready.

The top-level volumes section declares the pgdata named volume. Docker manages where this volume is stored on your host filesystem.

### Step 4: Start PostgreSQL

Run the following command from the directory containing your docker-compose.yml:

```bash
docker compose up -d
```

The -d flag runs the container in detached mode (in the background). Without it, the container's logs would stream to your terminal and you would need to open a new terminal to do anything else.

You should see output like:

```
[+] Running 2/2
 ✔ Volume "06-schema-design-postgresql_pgdata"  Created
 ✔ Container launchpad_db                        Started
```

Verify the container is running:

```bash
docker compose ps
```

You should see the launchpad_db container with status "running" and the health status showing "healthy" after a few seconds.

### Step 5: Connect with psql

Now connect to your Dockerized PostgreSQL using psql:

```bash
psql -h localhost -U postgres -d launchpad
```

Enter the password "postgres" when prompted. You should see the psql prompt:

```
launchpad=#
```

You are now connected to the launchpad database running inside the Docker container. Verify the connection:

```sql
SELECT version();
```

You will see the full PostgreSQL version string, confirming you are running PostgreSQL 17.

There is another way to connect: you can run psql directly inside the container:

```bash
docker exec -it launchpad_db psql -U postgres -d launchpad
```

This is useful when psql is not installed on your host machine. The docker exec command runs a command inside a running container, and the -it flags make it interactive.

### Step 6: Verify Data Persistence

Let us prove that volumes work. Create a test table and insert data:

```sql
CREATE TABLE persistence_test (
  id serial PRIMARY KEY,
  message text NOT NULL
);

INSERT INTO persistence_test (message) VALUES ('This data survives container restarts');
```

Now exit psql and stop the container:

```sql
\q
```

```bash
docker compose down
```

The container is now removed. But the volume still exists. Start it again:

```bash
docker compose up -d
```

Connect and check:

```bash
psql -h localhost -U postgres -d launchpad
```

```sql
SELECT * FROM persistence_test;
```

You should see your row. The data survived because it was stored in the pgdata volume, not inside the container itself.

Clean up the test table:

```sql
DROP TABLE persistence_test;
```

### Step 7: Use a .env File for Configuration

Hardcoding credentials in docker-compose.yml works for tutorials, but a better practice is to use an .env file. Docker Compose automatically reads variables from a .env file in the same directory.

Create a .env file:

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=launchpad
POSTGRES_PORT=5432
```

Update your docker-compose.yml to reference these variables:

```yaml
version: '3.8'

services:
  db:
    image: postgres:17-alpine
    container_name: launchpad_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - '${POSTGRES_PORT}:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER}']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

Add .env to your .gitignore file so credentials are never committed to version control:

```
.env
```

Create a .env.example file that documents the required variables without containing real values:

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here
POSTGRES_DB=launchpad
POSTGRES_PORT=5432
```

This .env.example file gets committed to the repository so other developers know what variables they need to set up.

### Step 8: Learn Essential Docker Commands

Here are the Docker Compose commands you will use daily:

Start the database:

```bash
docker compose up -d
```

Stop the database (keeps the volume):

```bash
docker compose down
```

Stop and remove the volume (deletes all data):

```bash
docker compose down -v
```

Use this when you want a completely fresh start. The -v flag removes named volumes.

View container logs:

```bash
docker compose logs db
```

Add -f to follow the logs in real time:

```bash
docker compose logs -f db
```

This is invaluable for debugging connection issues or seeing PostgreSQL error messages.

Check container status:

```bash
docker compose ps
```

Restart the database:

```bash
docker compose restart db
```

Execute a command inside the running container:

```bash
docker exec -it launchpad_db psql -U postgres -d launchpad
```

View volume information:

```bash
docker volume ls
```

### Step 9: Build the Connection String

Your application code needs a connection string (also called a database URL) to connect to PostgreSQL. The format is:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

For our LaunchPad setup:

```
postgresql://postgres:postgres@localhost:5432/launchpad
```

This connection string will be used in your application's environment variables. When we integrate Drizzle ORM later in the course, this is the value you will set for DATABASE_URL.

Add it to your .env file:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/launchpad
```

You can verify the connection string works with psql:

```bash
psql postgresql://postgres:postgres@localhost:5432/launchpad
```

This connects using the URL format instead of individual flags.

### Step 10: Optional pgAdmin Setup

pgAdmin is a graphical administration tool for PostgreSQL. If you prefer a visual interface over the command line, you can add it to your Docker Compose file:

```yaml
version: '3.8'

services:
  db:
    image: postgres:17-alpine
    container_name: launchpad_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - '${POSTGRES_PORT}:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER}']
      interval: 5s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: launchpad_pgadmin
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@launchpad.dev
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - '5050:80'
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
```

After running docker compose up -d, open http://localhost:5050 in your browser. Log in with the email and password from the environment variables. Then add a new server connection with host "db" (the service name, not localhost, because pgAdmin is inside the Docker network), port 5432, and the PostgreSQL credentials.

pgAdmin is entirely optional. Many developers prefer psql or a lighter tool like TablePlus or DBeaver. Use whatever makes you productive.

## Exercise

Complete these tasks to solidify your understanding:

1. Create a new directory called docker-practice. Inside it, create a docker-compose.yml that runs PostgreSQL 16 (not 17) on port 5433 with a database called "testdb", username "devuser", and password "devpass".
2. Start the container and verify you can connect with psql using the connection string: postgresql://devuser:devpass@localhost:5433/testdb
3. Create a table, insert some data, then run docker compose down and docker compose up -d to prove the data persists.
4. Run docker compose down -v to remove the volume. Start the container again and verify the data is gone (the table should not exist).
5. Add a .env file to your LaunchPad docker-compose.yml and verify the container starts correctly using the environment variables.
6. Practice reading container logs with docker compose logs db. Intentionally cause an error (like using a wrong password in psql) and find the error message in the logs.

## Key Takeaways

- Docker provides isolated, reproducible database environments that are easy to create, share, and destroy.
- The official postgres Docker image is configured through environment variables: POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB.
- Named volumes persist data across container restarts and removals. Without a volume, all data is lost when the container is removed.
- The docker compose down -v command removes volumes along with containers, giving you a clean slate.
- The postgres:17-alpine image is preferred for development because it is smaller and starts faster.
- A healthcheck using pg_isready ensures dependent services wait until PostgreSQL is ready.
- Store credentials in a .env file (gitignored) and document required variables in a .env.example file that gets committed.
- The connection string format postgresql://USER:PASSWORD@HOST:PORT/DATABASE is used by application code and ORMs to connect.
- You can connect to the containerized database either from your host (using mapped ports) or from inside the container (using docker exec).

## Summary

In this lesson, you set up a production-ready Docker Compose configuration for PostgreSQL. You learned why Docker is the preferred way to run databases in development, how to configure PostgreSQL with environment variables, and how volumes ensure your data survives container lifecycle events. You practiced essential Docker commands, built a proper connection string, and optionally added pgAdmin for visual database management. Your LaunchPad project now has a solid database infrastructure that every team member can reproduce with a single command.

## Next Lesson

In the next lesson, you will start designing the actual database tables for LaunchPad. You will learn the CREATE TABLE syntax in depth, choose the right column types for each field, and apply constraints to enforce data integrity. By the end, you will have created all five core tables: users, startups, categories, comments, and upvotes.
