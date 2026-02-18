import { connectDb, closeDb } from './db.js';
import { initCollections } from './collections.js';
import { listStartups } from './crud.js';
import {
  startupsPerCategory,
  startupsByUpvotes,
  recentComments,
  featuredStartups,
} from './aggregations.js';

async function main() {
  const db = await connectDb();
  initCollections(db);

  console.log('LaunchPad - Schema Design with MongoDB\n');

  // ---- Active startups ----
  const active = await listStartups({ status: 'active' });
  console.log(`Active startups: ${active.length}`);
  for (const s of active) {
    console.log(`  - ${s.name} (${s.tagline})`);
  }

  // ---- Featured startups (with founder & category via aggregation) ----
  const featured = await featuredStartups();
  console.log('\nFeatured startups:');
  for (const s of featured) {
    console.log(`  - ${s.name} (${s.category}) by ${s.founder} — ${s.upvoteCount} upvotes`);
  }

  // ---- Startups per category ----
  const perCategory = await startupsPerCategory();
  console.log('\nActive startups per category:');
  for (const row of perCategory) {
    console.log(`  - ${row.category}: ${row.count}`);
  }

  // ---- Upvote leaderboard ----
  const leaderboard = await startupsByUpvotes();
  console.log('\nUpvote leaderboard:');
  for (const row of leaderboard) {
    console.log(`  - ${row.name}: ${row.upvoteCount}`);
  }

  // ---- Recent comments ----
  const comments = await recentComments(5);
  console.log('\nRecent comments:');
  for (const c of comments) {
    console.log(`  - [${c.startup}] ${c.user}: ${c.comment}`);
  }

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
