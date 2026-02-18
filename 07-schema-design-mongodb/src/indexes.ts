import { getUsersCol, getCategoriesCol, getStartupsCol } from './collections.js';

/**
 * Create indexes for optimal query performance.
 * Call once at startup or as part of a migration script.
 */
export async function createIndexes() {
  // Users: unique email
  await getUsersCol().createIndex({ email: 1 }, { unique: true });

  // Categories: unique slug, unique name
  await getCategoriesCol().createIndex({ slug: 1 }, { unique: true });
  await getCategoriesCol().createIndex({ name: 1 }, { unique: true });

  // Startups: unique slug
  await getStartupsCol().createIndex({ slug: 1 }, { unique: true });

  // Startups: filter by status + sort by createdAt
  await getStartupsCol().createIndex({ status: 1, createdAt: -1 });

  // Startups: filter by category
  await getStartupsCol().createIndex({ categoryId: 1 });

  // Startups: filter by founder
  await getStartupsCol().createIndex({ founderId: 1 });

  // Startups: featured flag
  await getStartupsCol().createIndex({ featured: 1, status: 1 });

  // Startups: upvote user lookup (for $ne unique upvote check)
  await getStartupsCol().createIndex({ 'upvotes.userId': 1 });

  console.log('Indexes created.');
}
