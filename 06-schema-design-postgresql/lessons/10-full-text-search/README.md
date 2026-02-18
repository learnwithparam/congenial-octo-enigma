# 10 — Full-Text Search

When users type "AI code review" into a search box, they expect to find startups whose names, taglines, or descriptions mention those words -- even if the exact phrase does not appear anywhere. A simple LIKE or ILIKE query cannot handle this well. It does not understand word boundaries, cannot rank results by relevance, and ignores linguistic variations like "reviewing" vs. "review." PostgreSQL has a built-in full-text search engine that solves all of these problems. In this lesson you will learn how tsvector and tsquery work, how to create GIN indexes for fast search, how to rank results by relevance, and how to implement search across the LaunchPad startups table using both raw SQL and Drizzle ORM.

## What You Will Learn

- Why LIKE and ILIKE are insufficient for search
- How PostgreSQL represents searchable text with tsvector
- How PostgreSQL represents search queries with tsquery
- How the @@ match operator connects tsvector and tsquery
- How GIN indexes make full-text search fast
- How ts_rank scores and orders results by relevance
- How search configurations handle language-specific features (stemming, stop words)
- How to add full-text search to the LaunchPad startups table
- How to write search queries in both raw SQL and Drizzle

## Key Concepts

### The Problem with LIKE

The simplest approach to search is the LIKE operator:

```sql
SELECT name, tagline FROM startups WHERE name ILIKE '%code%';
```

This works for trivial cases but has serious limitations:

No word awareness. Searching for "review" matches "code review" but also "preview" because LIKE matches substrings without understanding word boundaries.

No stemming. Searching for "reviewing" will not match "review" or "reviewed." Users expect search to understand that these are the same root word.

No relevance ranking. LIKE returns matching rows in no particular order of relevance. A startup named "CodeReview" should rank higher than one that mentions "review" once in a long description, but LIKE cannot express this.

No stop word handling. Searching for "the best tool" should focus on "best" and "tool", not "the." LIKE treats every character equally.

Poor performance. ILIKE '%code%' cannot use a regular B-tree index because the pattern starts with a wildcard. PostgreSQL must scan every row in the table. On a table with 100,000 startups, this is slow.

### tsvector: The Document Representation

A tsvector is PostgreSQL's internal representation of a searchable document. It breaks text into lexemes (normalized word forms) and records the position of each lexeme in the original text.

Convert a string to a tsvector:

```sql
SELECT to_tsvector('english', 'Collaborative code review for modern teams');
```

Result:

```
'code':2 'collabor':1 'modern':5 'review':3 'team':6
```

Notice what happened:

- "Collaborative" became "collabor" (stemmed to its root)
- "for" was removed (it is a stop word in English)
- "teams" became "team" (singular form)
- Each lexeme has a position number

This normalization is what makes full-text search powerful. When a user searches for "collaborate", it matches "Collaborative" because both stem to "collabor."

### tsquery: The Search Query Representation

A tsquery represents what the user is searching for. It also normalizes words to lexemes and supports boolean operators:

```sql
SELECT to_tsquery('english', 'code & review');
```

Result:

```
'code' & 'review'
```

The & operator means AND -- both words must appear. Other operators:

- `|` means OR: `to_tsquery('english', 'code | review')` matches documents containing either word
- `!` means NOT: `to_tsquery('english', 'code & !review')` matches documents with "code" but not "review"
- `<->` means FOLLOWED BY: `to_tsquery('english', 'code <-> review')` matches "code review" as a phrase

For user input, use plainto_tsquery or websearch_to_tsquery, which handle raw text without requiring the user to know the operator syntax:

```sql
-- plainto_tsquery joins words with AND
SELECT plainto_tsquery('english', 'code review');
-- Result: 'code' & 'review'

-- websearch_to_tsquery supports Google-style syntax
SELECT websearch_to_tsquery('english', '"code review" OR testing');
-- Result: 'code' <-> 'review' | 'test'
```

The websearch_to_tsquery function is the most user-friendly option. It understands quoted phrases, OR, and minus signs for exclusion, which is the syntax most people know from web search engines.

### The @@ Match Operator

The @@ operator checks whether a tsvector matches a tsquery:

```sql
SELECT to_tsvector('english', 'Collaborative code review for modern teams')
       @@ to_tsquery('english', 'code & review');
```

Result: true

```sql
SELECT to_tsvector('english', 'Collaborative code review for modern teams')
       @@ to_tsquery('english', 'code & testing');
```

Result: false (the document does not contain "testing")

In a WHERE clause:

```sql
SELECT name, tagline
FROM startups
WHERE to_tsvector('english', name || ' ' || tagline || ' ' || description)
      @@ websearch_to_tsquery('english', 'code review');
```

This searches across name, tagline, and description simultaneously by concatenating them into a single text value before converting to tsvector.

### GIN Indexes for Full-Text Search

Without an index, the query above calls to_tsvector() on every row. A GIN (Generalized Inverted Index) index precomputes the tsvector and stores a mapping from each lexeme to the rows that contain it. This is like the index at the back of a book: look up "code" and get a list of page numbers (row IDs) instantly.

Create a GIN index:

```sql
CREATE INDEX idx_startups_search ON startups
USING gin(to_tsvector('english', name || ' ' || tagline || ' ' || description));
```

With this index in place, the @@ query uses the index instead of scanning every row. On a table with 100,000 rows, this is the difference between milliseconds and seconds.

There is an important requirement: the expression in the WHERE clause must match the expression in the index exactly. If the index uses `to_tsvector('english', name || ' ' || tagline || ' ' || description)`, your query must use the same expression. Changing the order or adding a space will cause PostgreSQL to ignore the index.

### Alternative: A Stored tsvector Column

To avoid repeating the expression, you can add a dedicated column that stores the precomputed tsvector:

```sql
ALTER TABLE startups ADD COLUMN search_vector tsvector;

UPDATE startups SET search_vector =
  to_tsvector('english', name || ' ' || tagline || ' ' || description);

CREATE INDEX idx_startups_search_vector ON startups USING gin(search_vector);
```

Now queries are simpler:

```sql
SELECT name, tagline
FROM startups
WHERE search_vector @@ websearch_to_tsquery('english', 'code review');
```

The downside is that you must keep search_vector in sync when name, tagline, or description changes. A trigger handles this automatically:

```sql
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english', NEW.name || ' ' || NEW.tagline || ' ' || NEW.description);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER startups_search_vector_update
  BEFORE INSERT OR UPDATE ON startups
  FOR EACH ROW
  EXECUTE FUNCTION update_search_vector();
```

With this trigger, the search_vector column is always up to date.

### Ranking Results with ts_rank

Finding matches is not enough -- you need to show the most relevant results first. ts_rank calculates a relevance score based on how frequently and where the search terms appear:

```sql
SELECT
  name,
  tagline,
  ts_rank(
    to_tsvector('english', name || ' ' || tagline || ' ' || description),
    websearch_to_tsquery('english', 'code review')
  ) AS rank
FROM startups
WHERE to_tsvector('english', name || ' ' || tagline || ' ' || description)
      @@ websearch_to_tsquery('english', 'code review')
ORDER BY rank DESC;
```

The rank value is a float. Higher values mean more relevant matches. A startup called "CodeFlow" with "code review" in both its tagline and description will rank higher than one that mentions "code" once in a long description.

### Weighting Fields

Not all fields are equally important. A match in the startup name should count more than a match in the description. PostgreSQL supports four weight classes: A (highest), B, C, and D (lowest).

Use setweight() to assign weights to different fields:

```sql
SELECT
  name,
  ts_rank(
    setweight(to_tsvector('english', name), 'A') ||
    setweight(to_tsvector('english', tagline), 'B') ||
    setweight(to_tsvector('english', description), 'C'),
    websearch_to_tsquery('english', 'code review')
  ) AS rank
FROM startups
WHERE
  setweight(to_tsvector('english', name), 'A') ||
  setweight(to_tsvector('english', tagline), 'B') ||
  setweight(to_tsvector('english', description), 'C')
  @@ websearch_to_tsquery('english', 'code review')
ORDER BY rank DESC;
```

Matches in the name (weight A) contribute more to the rank score than matches in the description (weight C). If a startup is called "CodeReview Pro" and another merely mentions "code review" in its description, the first will rank higher.

For the stored column approach, you would compute the weighted vector in the trigger:

```sql
NEW.search_vector :=
  setweight(to_tsvector('english', NEW.name), 'A') ||
  setweight(to_tsvector('english', NEW.tagline), 'B') ||
  setweight(to_tsvector('english', NEW.description), 'C');
```

### Search Configurations

The first argument to to_tsvector and to_tsquery is the search configuration. The 'english' configuration:

- Removes English stop words (the, is, at, on, ...)
- Applies English stemming (running -> run, reviews -> review)
- Handles English-specific rules

PostgreSQL ships with configurations for many languages. You can see the available ones:

```sql
SELECT cfgname FROM pg_ts_config;
```

The 'simple' configuration does no stemming and no stop word removal. It is useful for searching identifiers, product names, or data where you want exact lexeme matching:

```sql
SELECT to_tsvector('simple', 'CodeFlow');
-- Result: 'codeflow':1
```

For LaunchPad, 'english' is the right choice because startup descriptions are written in English prose.

### Highlighting Search Results

ts_headline generates a text snippet with the matching terms highlighted:

```sql
SELECT
  name,
  ts_headline(
    'english',
    description,
    websearch_to_tsquery('english', 'code review'),
    'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, FragmentDelimiter= ... '
  ) AS snippet
FROM startups
WHERE to_tsvector('english', name || ' ' || tagline || ' ' || description)
      @@ websearch_to_tsquery('english', 'code review');
```

The result wraps matching words in the specified tags. This is useful for displaying search results in a UI where matched terms are highlighted.

## Step by Step

### Step 1: Experiment in psql

Connect to the database:

```bash
docker compose exec postgres psql -U postgres -d launchpad
```

Try basic full-text functions:

```sql
-- See how tsvector represents text
SELECT to_tsvector('english', 'Collaborative code review for modern teams');

-- See how tsquery represents a search
SELECT websearch_to_tsquery('english', 'code review collaboration');

-- Test a match
SELECT to_tsvector('english', 'Collaborative code review for modern teams')
       @@ websearch_to_tsquery('english', 'code review');
```

### Step 2: Search the Startups Table

Run a full-text search across name, tagline, and description:

```sql
SELECT name, tagline
FROM startups
WHERE to_tsvector('english', name || ' ' || tagline || ' ' || description)
      @@ websearch_to_tsquery('english', 'code review');
```

This should return CodeFlow ("Collaborative code review for modern teams").

Try other searches:

```sql
-- Search for AI-related startups
SELECT name, tagline
FROM startups
WHERE to_tsvector('english', name || ' ' || tagline || ' ' || description)
      @@ websearch_to_tsquery('english', 'AI machine learning');

-- Search for productivity tools
SELECT name, tagline
FROM startups
WHERE to_tsvector('english', name || ' ' || tagline || ' ' || description)
      @@ websearch_to_tsquery('english', 'productivity focus');
```

### Step 3: Check the Query Plan

See how PostgreSQL executes the search without an index:

```sql
EXPLAIN ANALYZE
SELECT name, tagline
FROM startups
WHERE to_tsvector('english', name || ' ' || tagline || ' ' || description)
      @@ websearch_to_tsquery('english', 'code review');
```

You will see a Seq Scan because there is no full-text index. With only 8 rows, this is fast, but the plan shows what would happen at scale.

### Step 4: Add a GIN Index

Create the index:

```sql
CREATE INDEX idx_startups_fts ON startups
USING gin(to_tsvector('english', name || ' ' || tagline || ' ' || description));
```

Run the same EXPLAIN ANALYZE:

```sql
EXPLAIN ANALYZE
SELECT name, tagline
FROM startups
WHERE to_tsvector('english', name || ' ' || tagline || ' ' || description)
      @@ websearch_to_tsquery('english', 'code review');
```

With more data, this would show a Bitmap Index Scan using idx_startups_fts. With 8 rows, PostgreSQL might still choose a Seq Scan because the table is tiny.

Drop the index so we can recreate it properly in the Drizzle schema:

```sql
DROP INDEX idx_startups_fts;
```

### Step 5: Add a Stored tsvector Column

Add the search_vector column, the update trigger, and the GIN index:

```sql
ALTER TABLE startups ADD COLUMN search_vector tsvector;

CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.tagline, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER startups_search_vector_update
  BEFORE INSERT OR UPDATE ON startups
  FOR EACH ROW
  EXECUTE FUNCTION update_search_vector();

-- Populate existing rows
UPDATE startups SET name = name;

-- Create the GIN index
CREATE INDEX idx_startups_search_vector ON startups USING gin(search_vector);
```

The `UPDATE startups SET name = name` trick fires the trigger on every existing row without changing any data, which populates the search_vector column.

Verify:

```sql
SELECT name, search_vector FROM startups LIMIT 3;
```

Each row should have a populated search_vector.

### Step 6: Search with Ranking

Run a ranked search:

```sql
SELECT
  name,
  tagline,
  ts_rank(search_vector, websearch_to_tsquery('english', 'AI')) AS rank
FROM startups
WHERE search_vector @@ websearch_to_tsquery('english', 'AI')
ORDER BY rank DESC;
```

Try a broader search and compare ranks:

```sql
SELECT
  name,
  tagline,
  ts_rank(search_vector, websearch_to_tsquery('english', 'tool teams')) AS rank
FROM startups
WHERE search_vector @@ websearch_to_tsquery('english', 'tool teams')
ORDER BY rank DESC;
```

Startups with "tool" or "teams" in the name or tagline (higher weight) will rank above those with the words only in the description.

### Step 7: Add Search with Highlighting

```sql
SELECT
  name,
  ts_headline(
    'english',
    description,
    websearch_to_tsquery('english', 'review collaboration'),
    'StartSel=>>>, StopSel=<<<, MaxFragments=1'
  ) AS snippet,
  ts_rank(search_vector, websearch_to_tsquery('english', 'review collaboration')) AS rank
FROM startups
WHERE search_vector @@ websearch_to_tsquery('english', 'review collaboration')
ORDER BY rank DESC;
```

The snippet shows the matching part of the description with >>> and <<< markers around the matched terms.

### Step 8: Implement Search in Drizzle

In your application code, you can write the search query using Drizzle's sql template:

```ts
import { sql, desc } from 'drizzle-orm';
import { db } from './db/index.js';
import { startups } from './db/schema.js';

async function searchStartups(query: string) {
  const searchQuery = sql`websearch_to_tsquery('english', ${query})`;

  const results = await db
    .select({
      name: startups.name,
      slug: startups.slug,
      tagline: startups.tagline,
      rank: sql<number>`ts_rank(search_vector, ${searchQuery})`,
    })
    .from(startups)
    .where(sql`search_vector @@ ${searchQuery}`)
    .orderBy(desc(sql`ts_rank(search_vector, ${searchQuery})`))
    .limit(20);

  return results;
}
```

The ${query} placeholder is parameterized, which prevents SQL injection. Drizzle handles the escaping.

For a more complete implementation with highlighting:

```ts
async function searchStartupsWithSnippets(query: string) {
  const searchQuery = sql`websearch_to_tsquery('english', ${query})`;

  const results = await db
    .select({
      name: startups.name,
      slug: startups.slug,
      tagline: startups.tagline,
      snippet: sql<string>`ts_headline(
        'english',
        ${startups.description},
        ${searchQuery},
        'MaxFragments=2, FragmentDelimiter= ... '
      )`,
      rank: sql<number>`ts_rank(search_vector, ${searchQuery})`,
    })
    .from(startups)
    .where(sql`search_vector @@ ${searchQuery}`)
    .orderBy(desc(sql`ts_rank(search_vector, ${searchQuery})`))
    .limit(20);

  return results;
}
```

### Step 9: Handle Edge Cases

Empty search queries should return no results (or all results). Check for this in application code:

```ts
async function searchStartups(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const searchQuery = sql`websearch_to_tsquery('english', ${trimmed})`;

  // ... rest of the query
}
```

Special characters in the search query are handled by websearch_to_tsquery, which ignores characters it does not understand. You do not need to sanitize the input beyond SQL injection protection (which Drizzle's parameterized queries handle).

### Step 10: Add the Column to the Drizzle Schema

To manage the search_vector column through Drizzle and migrations, add it to your schema definition. Since Drizzle does not have a built-in tsvector type, you can use the customType helper or a raw SQL column:

```ts
import { customType } from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const startups = pgTable(
  'startups',
  {
    // ... existing columns ...
    searchVector: tsvector('search_vector'),
  },
  (table) => ({
    // ... existing indexes ...
    searchIdx: index('idx_startups_search_vector')
      .using('gin', table.searchVector),
  })
);
```

The trigger and the function that populates the column would be added in a custom migration file since Drizzle does not manage triggers. Create a migration file manually:

```sql
-- Custom migration: add search vector trigger
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.tagline, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER startups_search_vector_update
  BEFORE INSERT OR UPDATE ON startups
  FOR EACH ROW
  EXECUTE FUNCTION update_search_vector();

-- Populate existing rows
UPDATE startups SET name = name;
```

Clean up the manually created column and index before generating the migration:

```sql
DROP INDEX IF EXISTS idx_startups_search_vector;
DROP TRIGGER IF EXISTS startups_search_vector_update ON startups;
DROP FUNCTION IF EXISTS update_search_vector;
ALTER TABLE startups DROP COLUMN IF EXISTS search_vector;
```

Then generate and apply the migration:

```bash
npm run db:generate
npm run db:migrate
```

## Exercise

1. Add the search_vector column, trigger, and GIN index to the LaunchPad startups table as described in Steps 5 and 10. Verify that the search works by running a few queries in psql.

2. Write a search function in TypeScript using Drizzle that accepts a search string and returns the top 10 matching startups with their name, tagline, rank, and a description snippet. Test it with various search terms.

3. Experiment with different search configurations. Compare the results of to_tsvector('english', ...) with to_tsvector('simple', ...) for the query "reviewing". The English configuration should match "review" and "reviews" through stemming; the simple configuration should not.

4. Test edge cases: search for a single letter, search for a very long string, search for special characters like "&" or quotes. Verify that websearch_to_tsquery handles them gracefully.

5. Insert 1,000 dummy startups and compare the EXPLAIN ANALYZE output for a search query with and without the GIN index. Measure the difference in execution time.

6. Add a search endpoint to the application that accepts a query parameter and returns JSON results. Include the rank and snippet in the response.

## Summary

PostgreSQL's full-text search turns unstructured text into a searchable, rankable index. The tsvector type represents documents as normalized lexemes with position information. The tsquery type represents search queries with boolean operators. The @@ operator matches them together. GIN indexes make the matching fast by precomputing lexeme-to-row mappings. The ts_rank function scores results by relevance, and setweight lets you boost matches in important fields like the name and tagline over the description. Search configurations like 'english' provide stemming and stop word removal for natural language text. A stored tsvector column with a trigger keeps the search index in sync without recomputing on every query. In Drizzle, full-text search queries use the sql template literal for the tsvector and tsquery expressions, with parameterized inputs for SQL injection safety. For most applications, this built-in search engine eliminates the need for an external search service like Elasticsearch or Algolia.
