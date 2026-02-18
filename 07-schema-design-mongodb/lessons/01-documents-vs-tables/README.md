# Documents vs Tables

Relational databases store data in rigid rows and columns. Document databases like MongoDB store data as flexible JSON-like documents. Understanding when each model shines is the first step to designing effective schemas.

## What You'll Learn

- The mental model behind document databases vs relational tables
- How MongoDB documents map to real-world data structures
- When to choose a document database over a relational one
- Key terminology differences between SQL and MongoDB

## Key Concepts

### SQL vs MongoDB Terminology

If you come from a relational background, here is how the concepts map:

| SQL / Relational | MongoDB |
|------------------|---------|
| Database | Database |
| Table | Collection |
| Row | Document |
| Column | Field |
| Primary Key | `_id` |
| JOIN | `$lookup` (or embedding) |
| Schema (DDL) | Optional validation rules |

### What Is a Document?

A MongoDB document is a BSON (Binary JSON) object. It can contain strings, numbers, booleans, arrays, nested objects, dates, and special types like `ObjectId`.

Here is how a startup listing looks as a document in our LaunchPad application:

```json
{
  "_id": ObjectId("665f..."),
  "name": "CodeFlow",
  "slug": "codeflow",
  "tagline": "Collaborative code review for modern teams",
  "description": "CodeFlow brings real-time collaboration to code review...",
  "categoryId": ObjectId("665f..."),
  "founderId": ObjectId("665f..."),
  "status": "active",
  "featured": true,
  "comments": [
    {
      "_id": ObjectId("665f..."),
      "content": "This is exactly what our team needed.",
      "userId": ObjectId("665f..."),
      "createdAt": ISODate("2026-01-15T00:00:00Z")
    }
  ],
  "upvotes": [
    { "userId": ObjectId("665f..."), "createdAt": ISODate("2026-01-15T00:00:00Z") }
  ],
  "createdAt": ISODate("2026-01-15T00:00:00Z"),
  "updatedAt": ISODate("2026-01-15T00:00:00Z")
}
```

Notice how comments and upvotes live inside the startup document itself. In a relational database, those would be separate tables joined by foreign keys.

### The Relational Equivalent

To represent the same data in SQL you would need at least four tables:

```
startups          (id, name, slug, tagline, ...)
comments          (id, startup_id, user_id, content, created_at)
upvotes           (id, startup_id, user_id, created_at)
startup_categories (startup_id, category_id)
```

Every read that needs a startup with its comments requires a JOIN across tables. MongoDB lets you read the entire startup -- comments, upvotes, and all -- in a single query with no joins.

### When Documents Win

Document databases are a strong fit when:

- Your data has a natural hierarchy (a startup owns its comments and upvotes)
- Read patterns align with your document shape (you almost always fetch comments with the startup)
- Your schema evolves frequently (new fields can be added without migrations)
- You need horizontal scaling across many servers

### When Tables Win

Relational databases are a better choice when:

- You need complex transactions across many entities (bank transfers, inventory)
- Your data is highly normalized with many cross-references
- You need strict schema enforcement at the database level
- You run complex ad-hoc queries with multiple joins regularly

### The LaunchPad Data Model

Throughout this course, we build a startup directory called LaunchPad. The domain has three collections:

- `users` -- people who create startups and leave comments
- `categories` -- groupings like "Developer Tools", "AI & Machine Learning", "SaaS"
- `startups` -- the listings, with embedded comments and upvotes

Users and categories are referenced by ObjectId. Comments and upvotes are embedded directly inside each startup document. This hybrid approach demonstrates the most common pattern in real MongoDB applications.

## Step by Step

### Step 1: Think About Access Patterns

Before designing a schema, list how your application reads and writes data:

1. Show a startup page with its comments and upvote count -- single document read
2. List all startups in a category -- filter by `categoryId`
3. Show a user's profile -- single document read from `users`
4. Add a comment to a startup -- push into the embedded array

When most reads are "give me this entity with all its children," documents are a natural fit.

### Step 2: Identify Entities and Relationships

Draw out your entities and label the relationships:

- A user can found many startups (one-to-many, referenced)
- A startup belongs to one category (many-to-one, referenced)
- A startup has many comments (one-to-many, embedded)
- A startup has many upvotes (one-to-many, embedded)

The rule of thumb: if the child data is always accessed with the parent and is relatively bounded in size, embed it. If the child data is shared across parents or grows without bound, reference it.

### Step 3: Compare the Query Complexity

Fetching a startup with comments in SQL:

```sql
SELECT s.*, c.content, c.created_at, u.name AS commenter
FROM startups s
LEFT JOIN comments c ON c.startup_id = s.id
LEFT JOIN users u ON u.id = c.user_id
WHERE s.slug = 'codeflow';
```

The same query in MongoDB:

```javascript
db.startups.findOne({ slug: 'codeflow' });
```

The document already contains the comments array. No joins needed.

## Exercise

Take a feature you have built before (a blog, a to-do app, an e-commerce store) and sketch out how you would model it as documents instead of tables. Ask yourself:

1. What are the main entities?
2. Which child data is always read with the parent?
3. Which data is shared across multiple parents?
4. Would embedding or referencing be the better choice for each relationship?

Write down at least two collections and describe what each document would look like.

## Summary

- MongoDB stores data as flexible BSON documents inside collections
- Documents can contain nested objects and arrays, reducing the need for joins
- The key question is access patterns: how does your application read and write data?
- Embed data that is read together and bounded in size; reference data that is shared or unbounded
- Our LaunchPad app uses three collections: `users`, `categories`, and `startups` with embedded comments and upvotes
