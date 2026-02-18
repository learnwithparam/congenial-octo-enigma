# Why PostgreSQL

Every application needs a place to store data. Choosing the right database is one of the most consequential decisions you will make early in a project because migrating later is painful and expensive. In this lesson, you will learn why PostgreSQL has become the default choice for modern fullstack applications, how it compares to alternatives, and what makes its type system so powerful. By the end, you will have a running PostgreSQL instance and will have executed your first queries against it.

## What You Will Learn

- The history and philosophy behind PostgreSQL
- What ACID properties are and why they matter
- How PostgreSQL compares to MySQL, SQLite, and MongoDB
- The most important PostgreSQL data types for web applications
- When PostgreSQL is the right choice (and when it is not)
- How to connect with psql and run basic queries

## Concepts

### A Brief History of PostgreSQL

PostgreSQL traces its roots back to 1986 at the University of California, Berkeley. Professor Michael Stonebraker led a project called POSTGRES (Post-Ingres) as a successor to the Ingres relational database. The project explored ideas that were ahead of its time: user-defined types, table inheritance, and a sophisticated rule system.

In 1996, the project was renamed to PostgreSQL to reflect its support for the SQL query language. A global community of contributors took over development, and the project has been releasing major versions annually ever since. As of 2025, PostgreSQL 17 is the latest stable release.

What sets PostgreSQL apart from commercial databases is its community-driven development model. There is no single company that owns PostgreSQL. It is released under a permissive open-source license (the PostgreSQL License, similar to MIT/BSD). This means you can use it in commercial products, modify it, and distribute it without paying license fees.

### ACID Properties

Before we compare databases, you need to understand ACID, the four properties that guarantee reliable transaction processing.

Atomicity means a transaction either completes entirely or not at all. If you are transferring money between two bank accounts, both the debit and credit must succeed. If one fails, neither happens. PostgreSQL guarantees this.

Consistency means the database moves from one valid state to another. Constraints you define (like "every order must reference an existing customer") are enforced at all times. PostgreSQL never lets a transaction leave the database in an inconsistent state.

Isolation means concurrent transactions do not interfere with each other. If two users update the same row simultaneously, PostgreSQL ensures the result is the same as if the updates happened one after the other. PostgreSQL supports multiple isolation levels (Read Committed, Repeatable Read, Serializable) so you can tune the trade-off between safety and performance.

Durability means once a transaction is committed, it stays committed even if the server crashes immediately after. PostgreSQL uses write-ahead logging (WAL) to ensure committed data survives power failures and system crashes.

These properties might sound theoretical, but they are the reason you can trust a relational database with your application's most critical data. Every time a user signs up, places an order, or submits a payment, ACID properties are what prevent data corruption.

### PostgreSQL vs. Other Databases

Let us compare PostgreSQL against three popular alternatives. Each has its strengths, but understanding the trade-offs will help you make informed decisions.

PostgreSQL vs. MySQL

MySQL is probably the most widely deployed open-source database in the world, largely because of its association with the LAMP stack (Linux, Apache, MySQL, PHP). Here are the key differences:

Standards compliance: PostgreSQL follows the SQL standard more closely than MySQL. Features like window functions, CTEs (Common Table Expressions), and lateral joins arrived in PostgreSQL years before MySQL added them.

Data integrity: PostgreSQL enforces constraints strictly by default. MySQL historically had lenient behavior (silently truncating data, accepting invalid dates) though recent versions have improved.

Advanced types: PostgreSQL natively supports JSONB, arrays, ranges, geometric types, full-text search vectors, and user-defined types. MySQL has JSON support but it is less mature.

Extensibility: PostgreSQL has a powerful extension system. PostGIS (geographic data), pg_trgm (fuzzy text search), and pgvector (AI embeddings) are just a few examples. MySQL's plugin system is more limited.

When to choose MySQL: If you are working with an existing LAMP/LEMP stack, or your hosting provider only offers MySQL, it remains a solid choice. WordPress and many legacy PHP applications depend on it.

PostgreSQL vs. SQLite

SQLite is an embedded database that stores everything in a single file. It is included in every smartphone, every web browser, and many desktop applications.

Architecture: SQLite runs in-process (no separate server). PostgreSQL runs as a standalone server process that clients connect to over a network.

Concurrency: SQLite allows only one writer at a time. PostgreSQL handles thousands of concurrent read and write connections.

Features: SQLite intentionally keeps its feature set small. PostgreSQL offers stored procedures, triggers, materialized views, partitioning, logical replication, and much more.

When to choose SQLite: For mobile apps, desktop applications, prototyping, or situations where you need a database without running a server. It is fantastic for single-user or read-heavy workloads. Frameworks like Turso and LiteFS are pushing SQLite into multi-user territory, but PostgreSQL remains the safer bet for production web applications.

PostgreSQL vs. MongoDB

MongoDB is a document database that stores data as JSON-like documents (BSON) instead of rows in tables.

Schema: MongoDB is schemaless by default. You can insert documents with different structures into the same collection. PostgreSQL requires you to define a schema, but its JSONB type gives you document-like flexibility when you need it.

Queries: PostgreSQL uses SQL, one of the most well-known query languages in computing. MongoDB uses its own query language with JavaScript-like syntax. SQL skills transfer across many databases; MongoDB query skills are MongoDB-specific.

Transactions: MongoDB added multi-document transactions in version 4.0 (2018), but they come with performance overhead and limitations. PostgreSQL has had robust transaction support for decades.

Joins: PostgreSQL excels at joining data across tables. MongoDB requires you to either embed related data inside documents (denormalization) or use the $lookup aggregation stage, which is slower and less flexible than SQL joins.

When to choose MongoDB: If your data is truly unstructured and varies wildly between records, or if you are building a prototype and want to iterate on the data model without migrations. However, most applications have more structure than developers initially think, and PostgreSQL with JSONB columns handles the "some fields are flexible" use case well.

### PostgreSQL Data Types

One of PostgreSQL's greatest strengths is its rich type system. Here are the types you will use most often when building web applications.

Text types:

- text stores strings of any length. This is the go-to type for most string data in PostgreSQL. Unlike varchar, there is no performance penalty for using text.
- varchar(n) stores strings up to n characters. Use this when you want the database to enforce a maximum length (like a username limited to 50 characters).
- char(n) stores fixed-length strings, padding with spaces. Rarely used in modern applications.

For our LaunchPad project, startup names, descriptions, user bios, and URLs will all use text or varchar.

Numeric types:

- integer (or int) stores whole numbers from -2,147,483,648 to 2,147,483,647. Good for counts, ages, and IDs.
- bigint stores larger whole numbers. Use this for auto-incrementing primary keys on tables that might exceed 2 billion rows (unlikely for most apps, but a good habit).
- serial and bigserial are auto-incrementing integer types. They create a sequence behind the scenes. However, modern PostgreSQL projects often use UUIDs instead.
- numeric(precision, scale) stores exact decimal numbers. Essential for financial data where floating-point rounding errors are unacceptable.
- real and double precision store floating-point numbers. Fine for scientific data or coordinates, but never use them for money.

Boolean type:

- boolean stores true or false. PostgreSQL also accepts yes/no, on/off, and 1/0 as input values.

In LaunchPad, we will use booleans for flags like is_featured or is_active on startups.

Date and time types:

- timestamp stores a date and time without timezone information.
- timestamptz (timestamp with time zone) stores a date and time with timezone awareness. Always prefer this for web applications. PostgreSQL converts the value to UTC for storage and converts it back to the client's timezone on retrieval.
- date stores just a date (year, month, day).
- interval stores a duration of time (e.g., "3 days" or "2 hours 30 minutes").

Every table in LaunchPad will have created_at and updated_at columns using timestamptz.

JSON types:

- json stores JSON data as text, validating the syntax on input.
- jsonb stores JSON data in a decomposed binary format. It is slightly slower to insert but significantly faster to query. You can index JSONB fields and use operators to query nested values.

In LaunchPad, we might use a JSONB column for storing flexible metadata about startups, like social media links or launch details that vary between entries.

UUID type:

- uuid stores a 128-bit universally unique identifier. UUIDs are ideal for primary keys in distributed systems because they can be generated anywhere without coordination. PostgreSQL has the gen_random_uuid() function built in (since version 13).

We will use UUIDs as primary keys throughout LaunchPad. They are more secure than sequential integers (users cannot guess the next ID) and work well with ORMs like Drizzle.

Array type:

- PostgreSQL supports arrays of any type. For example, text[] stores an array of text values. You can store tags like ARRAY['saas', 'ai', 'developer-tools'] directly in a column.

Arrays are useful for simple lists that do not need their own table. In LaunchPad, we could use a text array for startup tags as a simpler alternative to a many-to-many relationship (though we will explore both approaches).

### When to Choose PostgreSQL

Choose PostgreSQL when:

- You are building a web application with structured, relational data
- You need strong data integrity guarantees (ACID compliance)
- You want a rich type system with JSON, arrays, and UUIDs
- You plan to use complex queries with joins, CTEs, and window functions
- You need full-text search without adding another service like Elasticsearch
- You want an active ecosystem of extensions (PostGIS, pgvector, etc.)
- Your team knows SQL or wants to invest in learning it

Consider alternatives when:

- You are building a mobile app that needs an embedded database (use SQLite)
- You need a simple key-value store for caching (use Redis)
- Your data is genuinely unstructured and schema-free (consider MongoDB, but test JSONB first)
- You are building a prototype with no server infrastructure (SQLite is simpler)

For our LaunchPad project, PostgreSQL is the clear choice. We have structured data (users, startups, categories, comments, upvotes), relationships between entities, and we need reliable transactions for operations like "create a startup and assign it to categories."

## Step by Step

### Step 1: Verify PostgreSQL Is Available

If you followed the Docker setup in your development environment, you likely already have PostgreSQL accessible. If not, do not worry; the next lesson covers Docker setup in detail. For now, we will use psql to connect.

Open your terminal and check if the psql client is installed:

```bash
psql --version
```

You should see output like:

```
psql (PostgreSQL) 16.x or 17.x
```

If psql is not installed, you can install it without installing the full PostgreSQL server:

On macOS with Homebrew:

```bash
brew install libpq
brew link --force libpq
```

On Ubuntu/Debian:

```bash
sudo apt-get install postgresql-client
```

### Step 2: Connect to PostgreSQL

If you have a PostgreSQL server running locally (via Docker or a native install), connect with:

```bash
psql -h localhost -U postgres -d postgres
```

The flags mean:
- -h localhost: connect to the server on this machine
- -U postgres: connect as the user named postgres
- -d postgres: connect to the default database named postgres

You will be prompted for a password. If you are using Docker with the default setup, the password is whatever you set in the POSTGRES_PASSWORD environment variable.

Once connected, you will see the psql prompt:

```
postgres=#
```

The # symbol indicates you are connected as a superuser. A regular user sees > instead.

### Step 3: Explore Basic psql Commands

psql has two kinds of commands: SQL statements (which end with a semicolon) and backslash commands (which are psql-specific shortcuts).

List all databases:

```sql
\l
```

You will see a table showing the default databases: postgres, template0, and template1.

Create a new database for experimentation:

```sql
CREATE DATABASE launchpad_dev;
```

Connect to it:

```sql
\c launchpad_dev
```

You should see:

```
You are now connected to database "launchpad_dev" as user "postgres".
```

List all tables in the current database:

```sql
\dt
```

Since we just created this database, it will say "Did not find any relations."

### Step 4: Explore PostgreSQL Data Types

Let us create a simple table to explore the data types we discussed:

```sql
CREATE TABLE type_examples (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  short_name varchar(50),
  age integer,
  is_active boolean DEFAULT true,
  score numeric(5, 2),
  tags text[],
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
```

This single table demonstrates most of the types we covered. Let us insert a row:

```sql
INSERT INTO type_examples (name, short_name, age, is_active, score, tags, metadata)
VALUES (
  'LaunchPad Demo',
  'LP',
  2,
  true,
  98.50,
  ARRAY['startup', 'directory', 'postgresql'],
  '{"version": 1, "features": ["search", "upvotes"]}'
);
```

Now query the data:

```sql
SELECT * FROM type_examples;
```

You will see all the columns populated, including the auto-generated UUID and timestamp.

### Step 5: Query JSON and Array Data

One of PostgreSQL's superpowers is querying inside JSON and array columns.

Query a specific JSON field:

```sql
SELECT name, metadata->>'version' AS version
FROM type_examples;
```

The ->> operator extracts a JSON field as text. The -> operator extracts it as a JSON value (keeping the type).

Query nested JSON arrays:

```sql
SELECT name, metadata->'features' AS features
FROM type_examples;
```

Check if an array contains a value:

```sql
SELECT name, tags
FROM type_examples
WHERE 'startup' = ANY(tags);
```

The ANY operator checks if the value appears anywhere in the array.

### Step 6: Experiment with Constraints

Constraints are rules the database enforces on your data. Let us see them in action:

```sql
-- This will fail because name is NOT NULL
INSERT INTO type_examples (short_name) VALUES ('Test');
```

You will see an error:

```
ERROR: null value in column "name" violates not-null constraint
```

Try inserting a string that is too long for varchar(50):

```sql
INSERT INTO type_examples (name, short_name)
VALUES ('Test', 'This string is definitely longer than fifty characters and will be rejected');
```

You will see:

```
ERROR: value too long for type character varying(50)
```

These errors are exactly what you want. The database is protecting your data integrity. Instead of silently truncating data or accepting invalid values, PostgreSQL tells you exactly what went wrong.

### Step 7: Clean Up

When you are done experimenting, you can drop the test table:

```sql
DROP TABLE type_examples;
```

And disconnect from psql:

```sql
\q
```

We will keep the launchpad_dev database for the upcoming lessons.

## Exercise

Complete these tasks to reinforce what you learned:

1. Connect to PostgreSQL using psql and create a database called playground.
2. Create a table called products with the following columns: id (uuid, primary key, auto-generated), name (text, not null), description (text), price (numeric with 2 decimal places), in_stock (boolean, default true), tags (text array), specs (jsonb), created_at (timestamptz, default now).
3. Insert three products with different tags and specs. For example, a laptop, a keyboard, and a monitor.
4. Write a query that finds all products where the price is greater than 100.
5. Write a query that finds all products that have the tag "electronics" in their tags array.
6. Write a query that extracts the "brand" field from the specs JSONB column.
7. Drop the products table and disconnect.

## Key Takeaways

- PostgreSQL is a mature, community-driven open-source database with over 35 years of development history.
- ACID properties (Atomicity, Consistency, Isolation, Durability) guarantee reliable data storage. PostgreSQL implements all four.
- PostgreSQL offers a richer type system than MySQL, stronger concurrency than SQLite, and better relational modeling than MongoDB.
- The most important types for web applications are text, integer, boolean, timestamptz, uuid, jsonb, and arrays.
- Constraints like NOT NULL, UNIQUE, CHECK, and DEFAULT let the database enforce data integrity rules so your application code does not have to.
- psql is the standard command-line client for PostgreSQL. Learning its backslash commands (\l, \dt, \d, \c) will make you productive quickly.
- UUIDs are preferred over serial integers for primary keys in modern applications because they are globally unique and harder to guess.

## Summary

In this lesson, you learned why PostgreSQL is the database of choice for modern fullstack applications. You explored its history, understood ACID properties, compared it against MySQL, SQLite, and MongoDB, and surveyed its rich data type system. You connected to PostgreSQL using psql, created a database, built a table with various column types, inserted data, and queried JSON and array columns. Most importantly, you saw how PostgreSQL enforces data integrity through constraints, catching errors before they corrupt your data.

## Next Lesson

In the next lesson, you will set up PostgreSQL using Docker and Docker Compose. This gives you a reproducible, isolated database environment that you can create and destroy in seconds, which is exactly what you want for development. You will write a docker-compose.yml file specifically for the LaunchPad project.
