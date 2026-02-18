# 04 — Relationships

Tables on their own store isolated pieces of data. A users table knows about users. A startups table knows about startups. But the interesting questions -- "Who founded this startup?", "Which startups are in the Developer Tools category?", "What comments does this startup have?" -- require connecting tables together. Relationships are how relational databases earn their name. In this lesson you will learn how foreign keys enforce referential integrity, how to model one-to-many and many-to-many relationships, and how Drizzle ORM's relations() helper lets you query related data without writing raw SQL joins.

## What You Will Learn

- What foreign keys are and how they enforce referential integrity
- How to model one-to-many relationships (users to startups, categories to startups)
- How to model many-to-many relationships using a join table (startups to tags)
- How ON DELETE behaviors (CASCADE, SET NULL, RESTRICT) protect your data
- How Drizzle's relations() helper describes relationships in TypeScript
- How to query related data using Drizzle's relational query API and explicit joins

## Key Concepts

### What Is a Foreign Key?

A foreign key is a column in one table that references the primary key of another table. It creates a link between the two tables and tells the database: "the value in this column must exist as a primary key in that other table."

In raw SQL, you define a foreign key like this:

```sql
CREATE TABLE startups (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  category_id integer NOT NULL REFERENCES categories(id),
  founder_id integer NOT NULL REFERENCES users(id)
);
```

The REFERENCES keyword creates the foreign key constraint. If you try to insert a startup with a category_id of 999 and no category with id 999 exists, PostgreSQL rejects the insert with an error:

```
ERROR: insert or update on table "startups" violates foreign key constraint
```

This is referential integrity -- the database guarantees that every reference points to an actual record.

### One-to-Many Relationships

A one-to-many relationship means one record in table A can be associated with many records in table B, but each record in table B belongs to exactly one record in table A.

The LaunchPad schema has several one-to-many relationships:

One user has many startups. Each startup has exactly one founder. The startups table stores this link in the founder_id column:

```ts
// From backend/src/db/schema.ts
export const startups = pgTable(
  'startups',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    // ...
    founderId: integer('founder_id')
      .notNull()
      .references(() => users.id),
    // ...
  },
  // ...
);
```

The `.references(() => users.id)` call tells Drizzle to create a foreign key constraint pointing to the users table. The arrow function (lazy reference) is necessary because the users table might be defined later in the file.

One category has many startups. Each startup belongs to exactly one category:

```ts
categoryId: integer('category_id')
  .notNull()
  .references(() => categories.id),
```

One startup has many comments. Each comment belongs to one startup:

```ts
export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    content: text('content').notNull(),
    startupId: integer('startup_id')
      .notNull()
      .references(() => startups.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  // ...
);
```

Notice the `{ onDelete: 'cascade' }` option on the startup reference. We will cover ON DELETE behaviors shortly.

One startup has many upvotes. Each upvote links one user to one startup:

```ts
export const upvotes = pgTable(
  'upvotes',
  {
    id: serial('id').primaryKey(),
    startupId: integer('startup_id')
      .notNull()
      .references(() => startups.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueUpvote: uniqueIndex('unique_upvote').on(table.startupId, table.userId),
    startupIdx: index('idx_upvotes_startup_id').on(table.startupId),
  })
);
```

The unique index on (startupId, userId) prevents a user from upvoting the same startup twice. This is a common pattern for "like" or "favorite" features: use a join table with a unique constraint on the pair.

### The "Many" Side Holds the Foreign Key

A fundamental rule of relational design: the foreign key column always lives on the "many" side of a one-to-many relationship. Users do not store an array of startup IDs. Instead, each startup stores a single founder_id pointing back to the user. This keeps the data normalized and avoids the complications of storing arrays of references.

Think of it this way: if one user has 50 startups, it is far simpler to have 50 rows each pointing to the same user than to maintain a list of 50 IDs inside the user row.

### ON DELETE Behaviors

When you delete a record that other records reference, PostgreSQL needs to know what to do with the orphaned references. The ON DELETE clause controls this behavior.

RESTRICT (the default): Prevents the delete entirely. If you try to delete a category that has startups, PostgreSQL raises an error. You must delete or reassign the startups first. This is the safest option.

CASCADE: Automatically deletes the referencing records. When a startup is deleted, all its comments and upvotes are deleted too. In the LaunchPad schema, comments and upvotes use CASCADE because they have no meaning without their parent startup:

```ts
startupId: integer('startup_id')
  .notNull()
  .references(() => startups.id, { onDelete: 'cascade' }),
```

SET NULL: Sets the foreign key column to null. This only works if the column allows nulls. Useful when the relationship is optional -- for example, if a user deletes their account, you might want to keep their comments but set the user_id to null to show "[deleted user]".

SET DEFAULT: Sets the foreign key to its default value. Rarely used but available.

Choose the ON DELETE behavior based on the business logic:

- Does the child record make sense without the parent? If no, use CASCADE.
- Should deleting the parent be blocked if children exist? Use RESTRICT.
- Should the child survive but lose the link? Use SET NULL.

### Many-to-Many Relationships

Some relationships do not fit the one-to-many pattern. Consider startups and tags: a startup can have many tags (e.g., "open-source", "AI", "productivity"), and a tag can be applied to many startups. This is a many-to-many relationship.

You cannot model many-to-many with a single foreign key column. Instead, you create a join table (also called a junction table or association table) that sits between the two tables:

```sql
CREATE TABLE tags (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL UNIQUE,
  slug varchar(100) NOT NULL UNIQUE,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE startup_tags (
  startup_id integer NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  tag_id integer NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY (startup_id, tag_id)
);
```

The startup_tags table has two foreign keys: one pointing to startups and one pointing to tags. The composite primary key on (startup_id, tag_id) ensures a tag can only be applied to a startup once.

In Drizzle, you would define this as:

```ts
export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const startupTags = pgTable(
  'startup_tags',
  {
    startupId: integer('startup_id')
      .notNull()
      .references(() => startups.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: uniqueIndex('startup_tags_pk').on(table.startupId, table.tagId),
  })
);
```

Each row in startup_tags represents one link. If CodeFlow has three tags, there are three rows in startup_tags all sharing the same startup_id but with different tag_ids.

### Drizzle's relations() Helper

Drizzle provides a relations() function that describes how tables relate to each other. These relations do not create database constraints -- the foreign keys in your table definitions handle that. Instead, relations() enables Drizzle's relational query API, which lets you fetch related data without writing explicit JOIN syntax.

Here is how the LaunchPad schema defines its relations:

```ts
import { relations } from 'drizzle-orm';

export const usersRelations = relations(users, ({ many }) => ({
  startups: many(startups),
  comments: many(comments),
  upvotes: many(upvotes),
}));
```

This tells Drizzle that a user has many startups, many comments, and many upvotes. The `many()` function describes the "one" side of a one-to-many relationship.

On the "many" side, you use the `one()` function and specify which columns form the link:

```ts
export const startupsRelations = relations(startups, ({ one, many }) => ({
  category: one(categories, {
    fields: [startups.categoryId],
    references: [categories.id],
  }),
  founder: one(users, {
    fields: [startups.founderId],
    references: [users.id],
  }),
  comments: many(comments),
  upvotes: many(upvotes),
}));
```

The `one()` call takes two arguments: the related table and an object mapping the foreign key column (fields) to the referenced column (references). This is how Drizzle knows that startups.categoryId corresponds to categories.id.

The comments and upvotes relations also define their links:

```ts
export const commentsRelations = relations(comments, ({ one }) => ({
  startup: one(startups, {
    fields: [comments.startupId],
    references: [startups.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const upvotesRelations = relations(upvotes, ({ one }) => ({
  startup: one(startups, {
    fields: [upvotes.startupId],
    references: [startups.id],
  }),
  user: one(users, {
    fields: [upvotes.userId],
    references: [users.id],
  }),
}));
```

Every relationship is declared from both sides. The users table says it has many startups, and the startups table says each startup has one founder (user). This bidirectional declaration is required for the relational query API to work in both directions.

### Querying Related Data with the Relational API

Once relations are defined, you can use `db.query` to fetch related data with the `with` option. From the LaunchPad index.ts:

```ts
const activeStartups = await db.query.startups.findMany({
  where: eq(startups.status, 'active'),
  with: {
    founder: true,
    category: true,
  },
  orderBy: [desc(startups.createdAt)],
});
```

The `with: { founder: true, category: true }` tells Drizzle to include the related user and category for each startup. Behind the scenes, Drizzle generates efficient queries (typically using subqueries or lateral joins) to load all the data in minimal round trips.

You can access the related data directly on the result objects:

```ts
for (const startup of activeStartups) {
  console.log(
    `${startup.name} (${startup.category.name}) by ${startup.founder.name}`
  );
}
```

You can also nest the `with` option to load deeper relationships:

```ts
const startupsWithComments = await db.query.startups.findMany({
  with: {
    founder: true,
    category: true,
    comments: {
      with: {
        user: true,
      },
    },
  },
});
```

This fetches startups with their comments, and for each comment, the user who wrote it. The relational API handles the complexity of joining multiple tables.

### Querying with Explicit Joins

Sometimes you need more control than the relational API provides -- for aggregations, for instance. Drizzle also supports explicit JOIN syntax using the select-from-join builder. From index.ts:

```ts
const categoryCounts = await db
  .select({
    category: categories.name,
    count: count(startups.id),
  })
  .from(categories)
  .leftJoin(startups, eq(startups.categoryId, categories.id))
  .groupBy(categories.name)
  .orderBy(desc(count(startups.id)));
```

This is a LEFT JOIN: it returns every category even if it has zero startups. The `eq(startups.categoryId, categories.id)` expression specifies the join condition -- it connects the foreign key to the primary key.

For upvote counts:

```ts
const upvoteCounts = await db
  .select({
    startup: startups.name,
    upvotes: count(upvotes.id),
  })
  .from(startups)
  .leftJoin(upvotes, eq(upvotes.startupId, startups.id))
  .groupBy(startups.name)
  .orderBy(desc(count(upvotes.id)));
```

The pattern is always the same: select the columns you want, specify the join, provide the condition, and group/order as needed.

### Entity-Relationship Diagram

Here is the full relationship map for the LaunchPad database:

```
users (1) ──── (many) startups
users (1) ──── (many) comments
users (1) ──── (many) upvotes

categories (1) ──── (many) startups

startups (1) ──── (many) comments
startups (1) ──── (many) upvotes

tags (many) ──── startup_tags ──── (many) startups
```

Every arrow represents a foreign key. The "one" side is the table whose primary key is referenced. The "many" side is the table that holds the foreign key column.

## Step by Step

### Step 1: Review the Existing Schema

Open `backend/src/db/schema.ts` and identify every foreign key. You should find four:

- startups.categoryId references categories.id
- startups.founderId references users.id
- comments.startupId references startups.id (with ON DELETE CASCADE)
- comments.userId references users.id
- upvotes.startupId references startups.id (with ON DELETE CASCADE)
- upvotes.userId references users.id

That is six foreign keys total across three tables. Each one creates a one-to-many relationship.

### Step 2: Test Referential Integrity

Start the database if it is not running:

```bash
docker compose up -d
```

Connect to psql:

```bash
docker compose exec postgres psql -U postgres -d launchpad
```

Try inserting a startup with a nonexistent category:

```sql
INSERT INTO startups (name, slug, tagline, description, category_id, founder_id, status)
VALUES ('Ghost Startup', 'ghost', 'Does not exist', 'Test', 9999, 1, 'pending');
```

PostgreSQL will reject this with a foreign key violation because category_id 9999 does not exist. This is referential integrity in action.

### Step 3: Test CASCADE Behavior

Find a startup ID from the seed data:

```sql
SELECT id, name FROM startups LIMIT 3;
```

Check how many comments it has:

```sql
SELECT count(*) FROM comments WHERE startup_id = 1;
```

Delete the startup:

```sql
DELETE FROM startups WHERE id = 1;
```

Check the comments again:

```sql
SELECT count(*) FROM comments WHERE startup_id = 1;
```

The count is zero. The CASCADE on the foreign key automatically deleted all comments for that startup. Upvotes for that startup were also removed. Re-run the seed script to restore the data:

```bash
npm run db:seed
```

### Step 4: Explore the Relational Query API

Open `backend/src/index.ts` and study the first query:

```ts
const activeStartups = await db.query.startups.findMany({
  where: eq(startups.status, 'active'),
  with: {
    founder: true,
    category: true,
  },
  orderBy: [desc(startups.createdAt)],
});
```

Try modifying this to also load comments for each startup. Add `comments: true` to the `with` object:

```ts
const activeStartups = await db.query.startups.findMany({
  where: eq(startups.status, 'active'),
  with: {
    founder: true,
    category: true,
    comments: true,
  },
  orderBy: [desc(startups.createdAt)],
});
```

Run the application:

```bash
npm run dev
```

Each startup in the result now includes a `comments` array with the full comment objects.

### Step 5: Add a Many-to-Many Relationship

To add tags to the schema, you would create two new tables in `schema.ts`. First, the tags table:

```ts
export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

Then the join table:

```ts
export const startupTags = pgTable(
  'startup_tags',
  {
    startupId: integer('startup_id')
      .notNull()
      .references(() => startups.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: uniqueIndex('startup_tags_pk').on(table.startupId, table.tagId),
  })
);
```

Define relations for both:

```ts
export const tagsRelations = relations(tags, ({ many }) => ({
  startupTags: many(startupTags),
}));

export const startupTagsRelations = relations(startupTags, ({ one }) => ({
  startup: one(startups, {
    fields: [startupTags.startupId],
    references: [startups.id],
  }),
  tag: one(tags, {
    fields: [startupTags.tagId],
    references: [tags.id],
  }),
}));
```

You would also update startupsRelations to include `startupTags: many(startupTags)`.

Then generate and apply a migration:

```bash
npm run db:generate
npm run db:migrate
```

### Step 6: Query a Many-to-Many Relationship

With the tags tables in place, you can query startups with their tags using nested `with`:

```ts
const startupsWithTags = await db.query.startups.findMany({
  with: {
    startupTags: {
      with: {
        tag: true,
      },
    },
  },
});

for (const startup of startupsWithTags) {
  const tagNames = startup.startupTags.map((st) => st.tag.name);
  console.log(`${startup.name}: ${tagNames.join(', ')}`);
}
```

The many-to-many query goes through the join table: startups -> startupTags -> tags. Each startupTags entry has a nested tag object.

You can also use an explicit join to get startups with a specific tag:

```ts
const aiStartups = await db
  .select({
    startupName: startups.name,
    tagName: tags.name,
  })
  .from(startups)
  .innerJoin(startupTags, eq(startupTags.startupId, startups.id))
  .innerJoin(tags, eq(tags.id, startupTags.tagId))
  .where(eq(tags.slug, 'ai'));
```

This INNER JOIN returns only startups that have the "ai" tag. Startups without that tag are excluded.

## Exercise

1. Add a tags table and a startup_tags join table to the schema as described in Step 5. Generate and apply the migration.

2. Add seed data for five tags (e.g., "open-source", "ai", "developer-tools", "productivity", "saas") and link each startup to two or three tags using the startup_tags table.

3. Write a query using the relational API to fetch all startups with their tags and print the results.

4. Write a query that finds all startups tagged with "ai", including the founder name and category name.

5. Test the CASCADE behavior: delete a tag and verify that the corresponding rows in startup_tags are removed, but the startups themselves remain.

6. Try inserting a duplicate entry into startup_tags (same startup_id and tag_id twice). Observe the unique constraint error.

## Summary

Relationships connect isolated tables into a coherent data model. Foreign keys enforce referential integrity, ensuring every reference points to a real record. One-to-many relationships (users to startups, categories to startups, startups to comments) use a foreign key column on the "many" side. Many-to-many relationships (startups to tags) use a join table with two foreign keys and a unique constraint on the pair. ON DELETE CASCADE automatically cleans up child records when a parent is deleted. Drizzle's relations() helper describes these connections in TypeScript, enabling the relational query API that lets you fetch related data with `with` clauses instead of manual joins. For aggregations and more complex queries, Drizzle's explicit join builder gives you full control over how tables are connected.
