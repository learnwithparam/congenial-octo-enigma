# Create Tables with Proper Column Types

Designing database tables is where your application's data model becomes real. Every decision you make here, from column types to constraints, affects data integrity, query performance, and how easy the schema is to evolve over time. In this lesson, you will learn the CREATE TABLE syntax in depth, choose appropriate column types for each field, and apply constraints that protect your data from invalid states. By the end, you will have built all five core tables for the LaunchPad startup directory: users, startups, categories, comments, and upvotes.

## What You Will Learn

- The full CREATE TABLE syntax in PostgreSQL
- How to choose the right column type for each piece of data
- How to use constraints (NOT NULL, UNIQUE, CHECK, DEFAULT) to enforce data integrity
- The difference between serial/bigserial and UUID primary keys
- How to design tables that are easy to query and maintain
- How to build the complete LaunchPad schema from scratch

## Concepts

### The CREATE TABLE Statement

The CREATE TABLE statement defines a new table in your database. At its simplest:

```sql
CREATE TABLE table_name (
  column_name data_type constraints,
  column_name data_type constraints,
  ...
  table_level_constraints
);
```

Every column has three parts: a name, a data type, and zero or more constraints. Table-level constraints (like multi-column unique constraints) go after all column definitions.

Naming conventions matter for readability and consistency. PostgreSQL converts unquoted identifiers to lowercase, so use snake_case for table and column names. Use plural nouns for table names (users, not user) because a table holds many rows. Use singular, descriptive names for columns (email, not emails or user_email).

### Choosing Column Types

PostgreSQL has dozens of data types, but for web applications you will use about ten of them regularly. Here is a decision framework.

For identifiers (primary keys), use uuid. UUIDs are globally unique, unguessable, and work well in distributed systems. PostgreSQL's built-in gen_random_uuid() function generates them without any extensions.

For short strings with a known maximum length, use varchar(n). Examples: username (50 characters), email (255 characters), URL slug (100 characters). The length limit acts as a data integrity constraint.

For long strings with no practical limit, use text. Examples: descriptions, bios, comment bodies, URLs. There is no performance difference between text and varchar without a length limit in PostgreSQL.

For whole numbers, use integer for typical counts and values. Use bigint if the value could exceed 2 billion (rare for application data, but common for auto-incrementing IDs on high-traffic tables).

For decimal numbers requiring precision, use numeric(precision, scale). The precision is the total number of digits, and scale is the number of digits after the decimal point. numeric(10, 2) stores values up to 99,999,999.99. Use this for money, ratings, or any value where floating-point rounding errors are unacceptable.

For true/false flags, use boolean. Examples: is_published, is_featured, is_verified.

For dates and times, use timestamptz (timestamp with time zone). Always prefer this over plain timestamp. When PostgreSQL stores a timestamptz value, it converts it to UTC. When it retrieves it, it converts it to the client's configured timezone. This prevents timezone bugs that are notoriously difficult to debug.

For flexible or semi-structured data, use jsonb. Examples: social media links, configuration objects, metadata that varies between rows. JSONB is stored in a binary format that supports indexing and fast lookups.

For simple lists, use array types like text[]. Examples: tags, features. Arrays are great when the list elements do not need their own IDs or additional columns. If each element needs metadata (like a tag with a description and color), use a separate table instead.

### Constraints in Depth

Constraints are rules the database enforces automatically. They are your strongest defense against bad data.

NOT NULL prevents a column from containing null values. Use this on any column that must always have a value. In practice, most columns should be NOT NULL. Only allow nulls when the absence of a value is meaningful (like a deleted_at timestamp that is null for active records).

UNIQUE ensures no two rows have the same value in that column. Use this for email addresses, usernames, slugs, and any value that must be distinct. PostgreSQL creates an index automatically for unique columns, which also speeds up lookups.

CHECK enforces a condition on column values. For example, CHECK (rating >= 1 AND rating <= 5) ensures ratings are in a valid range. CHECK constraints can reference multiple columns: CHECK (end_date > start_date).

DEFAULT provides a value when a row is inserted without specifying that column. Common defaults include gen_random_uuid() for UUIDs, now() for timestamps, true or false for booleans, and 0 for counters.

PRIMARY KEY is a combination of NOT NULL and UNIQUE. It identifies each row uniquely. Every table should have a primary key. In our schema, that will be a uuid column named id.

REFERENCES (foreign keys) links a column to the primary key of another table. We will cover this in depth in the next lesson on relationships.

### Serial vs. UUID Primary Keys

Older PostgreSQL tutorials often use serial or bigserial for primary keys. These auto-incrementing integers are simple and compact:

```sql
CREATE TABLE old_style (
  id serial PRIMARY KEY,
  name text
);
```

However, serial IDs have drawbacks for modern web applications:

Guessability: If a user's profile URL is /users/42, anyone can try /users/43 to see the next user. This is an information disclosure risk.

Distributed generation: Serial IDs require the database to assign the next value. In distributed systems or when pre-generating IDs on the client, this creates a bottleneck.

Data exposure: The ID reveals how many records exist and when they were created relative to each other.

UUIDs solve these problems:

```sql
CREATE TABLE modern_style (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text
);
```

UUIDs are 128 bits (displayed as 32 hex characters with dashes, like 550e8400-e29b-41d4-a716-446655440000). They are practically impossible to guess, can be generated anywhere (client or server), and reveal nothing about record count or ordering.

The trade-off is that UUIDs are larger (16 bytes vs. 4 bytes for integer) and slightly slower for joins. For the vast majority of web applications, this difference is negligible. We will use UUIDs throughout LaunchPad.

### Planning the LaunchPad Schema

Before writing SQL, let us think about what data LaunchPad needs to store.

Users are people who sign up on the platform. They can submit startups, comment on them, and upvote them. We need their name, email, password-related fields, and profile information.

Startups are the core entity. Each startup has a name, description, URL, logo, and metadata like launch date and featured status. Each startup belongs to one user (the founder who submitted it).

Categories organize startups into groups like "Developer Tools", "AI/ML", "SaaS", and "FinTech". A startup can belong to multiple categories, and a category contains many startups. This is a many-to-many relationship that requires a junction table, which we will address in the next lesson.

Comments are text responses left by users on startups. Each comment belongs to one user and one startup.

Upvotes track which users have upvoted which startups. Each upvote links a user to a startup, and a user can only upvote a startup once.

## Step by Step

### Step 1: Connect to the Database

Start your Docker container if it is not already running:

```bash
docker compose up -d
```

Connect to the launchpad database:

```bash
psql -h localhost -U postgres -d launchpad
```

Verify the connection:

```sql
SELECT current_database();
```

You should see "launchpad".

### Step 2: Create the Users Table

The users table is the foundation of our schema. Many other tables will reference it.

```sql
CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(100) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

Let us examine each column.

id is a UUID primary key with an auto-generated default. When you insert a user without specifying an id, PostgreSQL generates a random UUID.

name uses varchar(100) because usernames longer than 100 characters are almost certainly errors. The NOT NULL constraint ensures every user has a name.

email uses varchar(255) because the email specification limits addresses to 254 characters. The UNIQUE constraint prevents duplicate accounts. Combined with NOT NULL, every user must have a unique email.

avatar_url uses text because URLs can be long and we do not need a strict limit. It allows nulls because not every user will upload an avatar.

bio uses text for the same reason. It allows nulls because bios are optional.

created_at and updated_at both use timestamptz with a default of now(). They are NOT NULL because every row should always have these timestamps. The updated_at column will need a trigger to automatically update on row changes (we will add that shortly).

Verify the table was created:

```sql
\d users
```

This shows the table structure with all columns, types, and constraints.

### Step 3: Create the Categories Table

Categories are simple: a name and a slug for URL-friendly identifiers.

```sql
CREATE TABLE categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(100) NOT NULL UNIQUE,
  slug varchar(100) NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

Both name and slug have UNIQUE constraints. The name is what users see ("Developer Tools"), and the slug is the URL-friendly version ("developer-tools"). Making both unique prevents confusing situations where two categories have the same display name or the same URL path.

description allows nulls because a short category name is often self-explanatory.

We do not need updated_at here because categories rarely change after creation. If you prefer consistency across all tables, feel free to add it.

### Step 4: Create the Startups Table

The startups table is the most detailed table in our schema:

```sql
CREATE TABLE startups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name varchar(200) NOT NULL,
  slug varchar(200) NOT NULL UNIQUE,
  tagline varchar(300) NOT NULL,
  description text NOT NULL,
  url text NOT NULL,
  logo_url text,
  launch_date date,
  is_published boolean DEFAULT false NOT NULL,
  is_featured boolean DEFAULT false NOT NULL,
  upvote_count integer DEFAULT 0 NOT NULL,
  metadata jsonb DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

Let us walk through the columns.

user_id is a UUID that will reference the users table (we will add the foreign key constraint in the next lesson). NOT NULL means every startup must have an owner.

name and slug identify the startup. The slug is unique because it will be used in URLs like /startups/launchpad-ai.

tagline is a short pitch (varchar 300). Think of it as the startup's elevator pitch: "The startup directory for the modern web." It is NOT NULL because every startup needs a tagline.

description is a longer explanation using text. Also NOT NULL because a description is essential.

url is the startup's website. NOT NULL because the whole point of the directory is to link to startups.

logo_url allows nulls because a logo is optional during initial submission.

launch_date uses the date type (no time component needed). It allows nulls because a startup might be submitted before it officially launches.

is_published defaults to false. New submissions are drafts until approved or published by the user. The NOT NULL constraint ensures this is always explicitly true or false, never null (which would be a confusing third state).

is_featured defaults to false. Admins can feature exceptional startups.

upvote_count is a denormalized counter. We could always calculate this by counting rows in the upvotes table, but keeping a counter on the startups table makes sorting by popularity much faster. We will keep it in sync with triggers or application logic. The DEFAULT 0 ensures new startups start with zero upvotes.

metadata is a JSONB column for flexible, semi-structured data. It defaults to an empty JSON object. This is where we can store things like social media links, funding information, or team size without adding columns for every possible field:

```json
{
  "twitter": "https://twitter.com/launchpad",
  "github": "https://github.com/launchpad",
  "funding_stage": "seed",
  "team_size": 5
}
```

### Step 5: Create the Comments Table

Comments are straightforward: a user writes text about a startup.

```sql
CREATE TABLE comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

user_id and startup_id will become foreign keys in the next lesson. Both are NOT NULL because a comment must belong to both a user and a startup.

body uses text because comment length varies widely. NOT NULL prevents empty comments from being stored.

### Step 6: Create the Upvotes Table

Upvotes represent a user expressing support for a startup. Each user can upvote a startup only once.

```sql
CREATE TABLE upvotes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

We will add a unique constraint on the combination of user_id and startup_id in the next lesson to prevent duplicate upvotes. There is no updated_at because upvotes are not edited; they are either created or deleted.

### Step 7: Add a CHECK Constraint Example

Let us enhance the startups table with a CHECK constraint. Suppose we want to ensure the upvote count never goes negative:

```sql
ALTER TABLE startups
ADD CONSTRAINT startups_upvote_count_non_negative
CHECK (upvote_count >= 0);
```

The ALTER TABLE ... ADD CONSTRAINT syntax lets you add constraints to existing tables. The constraint name (startups_upvote_count_non_negative) helps identify the constraint in error messages.

Test the constraint:

```sql
UPDATE startups SET upvote_count = -1 WHERE slug = 'anything';
```

Even though no rows match, if you insert a row and try to set upvote_count to -1, you will get:

```
ERROR: new row for relation "startups" violates check constraint "startups_upvote_count_non_negative"
```

### Step 8: Create an Auto-Update Trigger for updated_at

PostgreSQL does not automatically update the updated_at column when a row changes. You need a trigger function and a trigger.

First, create the function:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

This function sets the updated_at column to the current time whenever a row is updated. NEW refers to the row being modified.

Now create triggers for each table that has an updated_at column:

```sql
CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_startups
  BEFORE UPDATE ON startups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_comments
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

The trigger fires BEFORE UPDATE, meaning it modifies the row before it is written to disk. FOR EACH ROW means it fires once per row in a multi-row update.

Test it by inserting a user and then updating them:

```sql
INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');

SELECT name, created_at, updated_at FROM users WHERE email = 'alice@example.com';
```

Both timestamps should be identical. Now update the user:

```sql
UPDATE users SET bio = 'Building cool things' WHERE email = 'alice@example.com';

SELECT name, created_at, updated_at FROM users WHERE email = 'alice@example.com';
```

The updated_at timestamp should now be later than created_at.

### Step 9: Insert Sample Data

Let us populate the tables with sample data to verify everything works. Start with categories:

```sql
INSERT INTO categories (name, slug, description) VALUES
  ('Developer Tools', 'developer-tools', 'Tools and services for software developers'),
  ('AI and Machine Learning', 'ai-ml', 'Artificial intelligence and ML products'),
  ('SaaS', 'saas', 'Software as a Service products'),
  ('FinTech', 'fintech', 'Financial technology solutions'),
  ('Health Tech', 'health-tech', 'Healthcare technology products');
```

Insert a couple of users:

```sql
INSERT INTO users (name, email, bio) VALUES
  ('Alice Johnson', 'alice@example.com', 'Full-stack developer and startup enthusiast'),
  ('Bob Smith', 'bob@example.com', 'Product designer turned founder');
```

Note: If Alice already exists from Step 8, you will get a unique constraint violation on the email. That is the constraint doing its job. Either skip this insert or use a different email.

Insert some startups (we will need user IDs, so let us fetch them):

```sql
INSERT INTO startups (user_id, name, slug, tagline, description, url, is_published, metadata)
SELECT
  id,
  'CodeReview Pro',
  'codereview-pro',
  'AI-powered code review for modern teams',
  'CodeReview Pro uses large language models to review pull requests, catch bugs, and suggest improvements. It integrates with GitHub, GitLab, and Bitbucket.',
  'https://codereview.pro',
  true,
  '{"twitter": "https://twitter.com/codereviewpro", "team_size": 4}'
FROM users WHERE email = 'alice@example.com';

INSERT INTO startups (user_id, name, slug, tagline, description, url, is_published)
SELECT
  id,
  'DesignFlow',
  'designflow',
  'Collaborative design tool for remote teams',
  'DesignFlow brings real-time collaboration to the design process. Share mockups, gather feedback, and iterate faster than ever.',
  'https://designflow.io',
  true
FROM users WHERE email = 'bob@example.com';
```

We use a SELECT subquery instead of hardcoding UUIDs because UUIDs are randomly generated and different every time.

### Step 10: Verify the Schema

Let us confirm everything is in place. List all tables:

```sql
\dt
```

You should see: categories, comments, startups, upvotes, users.

Inspect the startups table structure:

```sql
\d startups
```

This shows all columns, types, constraints, and indexes. You should see the check constraint on upvote_count and the trigger.

Run a query that joins data:

```sql
SELECT s.name AS startup, s.tagline, u.name AS founder
FROM startups s
JOIN users u ON s.user_id = u.id
WHERE s.is_published = true;
```

You should see CodeReview Pro by Alice Johnson and DesignFlow by Bob Smith.

Query the JSONB metadata:

```sql
SELECT name, metadata->>'twitter' AS twitter, metadata->>'team_size' AS team_size
FROM startups
WHERE metadata ? 'twitter';
```

The ? operator checks if a key exists in the JSONB object.

## Exercise

Complete these tasks to reinforce your understanding:

1. Add a column called website_status to the startups table of type varchar(20) with a CHECK constraint that only allows the values 'active', 'inactive', or 'coming_soon'. Use ALTER TABLE to add it.
2. Try inserting a startup with website_status set to 'broken' and observe the error message.
3. Create a table called tags with columns: id (uuid, primary key), name (varchar 50, unique, not null), color (varchar 7, for hex color codes like #FF5733). Add a CHECK constraint on color that ensures it starts with # and is exactly 7 characters.
4. Insert five tags and then query them.
5. Update a user's name and verify that the updated_at trigger fires correctly.
6. Try inserting a user with a duplicate email address and observe the unique constraint error.
7. Drop the tags table when you are done experimenting.

## Key Takeaways

- Every column decision (type, constraints, defaults) is a data integrity decision. Choose types that reject invalid data as early as possible.
- Use uuid with gen_random_uuid() for primary keys. They are secure, globally unique, and work well with ORMs.
- Use varchar(n) when you want to enforce a maximum length. Use text when there is no practical limit.
- Always use timestamptz instead of timestamp for date-time columns to avoid timezone bugs.
- Use JSONB for flexible, semi-structured data. It supports indexing and rich query operators.
- NOT NULL should be the default mindset. Only allow nulls when the absence of a value has clear meaning.
- CHECK constraints enforce business rules at the database level, providing a safety net that application code alone cannot guarantee.
- Triggers automate repetitive tasks like updating the updated_at column, reducing the risk of human error.
- Denormalized counters (like upvote_count) improve read performance at the cost of write complexity. Use them when a count is queried frequently.

## Summary

In this lesson, you designed and built all five core tables for the LaunchPad startup directory. You learned how to choose appropriate column types, apply constraints that protect data integrity, and use triggers to automate timestamp updates. The users table stores account information, the startups table holds the directory listings, the categories table organizes content, the comments table enables discussion, and the upvotes table tracks popularity. Each table uses UUID primary keys, timestamptz for time tracking, and appropriate constraints to prevent invalid data from entering the system.

## Next Lesson

In the next lesson, you will connect these tables together with relationships. You will learn about foreign keys, one-to-many and many-to-many relationships, ON DELETE behaviors, and referential integrity. You will build a junction table to connect startups and categories, add all the foreign key constraints, and draw the full entity-relationship diagram for LaunchPad.
