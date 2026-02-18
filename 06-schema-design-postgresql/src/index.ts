import { eq, desc, count, sql } from 'drizzle-orm';
import { db, pool } from './db/index.js';
import { startups, users, categories, comments, upvotes } from './db/schema.js';

async function main() {
  console.log('LaunchPad - Schema Design with PostgreSQL\n');

  // Fetch all active startups with their founder and category
  const activeStartups = await db.query.startups.findMany({
    where: eq(startups.status, 'active'),
    with: {
      founder: true,
      category: true,
    },
    orderBy: [desc(startups.createdAt)],
  });

  console.log(`Active startups: ${activeStartups.length}`);
  for (const startup of activeStartups) {
    console.log(
      `  - ${startup.name} (${startup.category.name}) by ${startup.founder.name}`
    );
  }

  // Count startups per category
  const categoryCounts = await db
    .select({
      category: categories.name,
      count: count(startups.id),
    })
    .from(categories)
    .leftJoin(startups, eq(startups.categoryId, categories.id))
    .groupBy(categories.name)
    .orderBy(desc(count(startups.id)));

  console.log('\nStartups per category:');
  for (const row of categoryCounts) {
    console.log(`  - ${row.category}: ${row.count}`);
  }

  // Count upvotes per startup
  const upvoteCounts = await db
    .select({
      startup: startups.name,
      upvotes: count(upvotes.id),
    })
    .from(startups)
    .leftJoin(upvotes, eq(upvotes.startupId, startups.id))
    .groupBy(startups.name)
    .orderBy(desc(count(upvotes.id)));

  console.log('\nUpvotes per startup:');
  for (const row of upvoteCounts) {
    console.log(`  - ${row.startup}: ${row.upvotes}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
