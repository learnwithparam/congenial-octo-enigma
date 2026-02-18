import { ObjectId } from 'mongodb';
import { getUsersCol, getCategoriesCol, getStartupsCol } from './collections.js';
import {
  UserSchema,
  CategorySchema,
  StartupSchema,
  EmbeddedCommentSchema,
  EmbeddedUpvoteSchema,
} from './types.js';
import type { User, Category, Startup, EmbeddedComment } from './types.js';

// ============================================================
// Users
// ============================================================

export async function createUser(data: Omit<User, '_id' | 'createdAt' | 'updatedAt'>) {
  const parsed = UserSchema.parse(data);
  const result = await getUsersCol().insertOne(parsed);
  return { ...parsed, _id: result.insertedId };
}

export async function findUserById(id: ObjectId) {
  return getUsersCol().findOne({ _id: id });
}

export async function findUserByEmail(email: string) {
  return getUsersCol().findOne({ email });
}

export async function updateUser(id: ObjectId, data: Partial<Pick<User, 'name' | 'bio' | 'avatarUrl'>>) {
  return getUsersCol().updateOne(
    { _id: id },
    { $set: { ...data, updatedAt: new Date() } },
  );
}

export async function deleteUser(id: ObjectId) {
  return getUsersCol().deleteOne({ _id: id });
}

// ============================================================
// Categories
// ============================================================

export async function createCategory(data: Omit<Category, '_id' | 'createdAt'>) {
  const parsed = CategorySchema.parse(data);
  const result = await getCategoriesCol().insertOne(parsed);
  return { ...parsed, _id: result.insertedId };
}

export async function findCategoryBySlug(slug: string) {
  return getCategoriesCol().findOne({ slug });
}

export async function listCategories() {
  return getCategoriesCol().find().sort({ name: 1 }).toArray();
}

// ============================================================
// Startups
// ============================================================

export async function createStartup(
  data: Omit<Startup, '_id' | 'comments' | 'upvotes' | 'createdAt' | 'updatedAt'>,
) {
  const parsed = StartupSchema.parse(data);
  const result = await getStartupsCol().insertOne(parsed);
  return { ...parsed, _id: result.insertedId };
}

export async function findStartupBySlug(slug: string) {
  return getStartupsCol().findOne({ slug });
}

export async function listStartups(filter: { status?: string; featured?: boolean } = {}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.featured !== undefined) query.featured = filter.featured;
  return getStartupsCol().find(query).sort({ createdAt: -1 }).toArray();
}

export async function updateStartup(
  id: ObjectId,
  data: Partial<Pick<Startup, 'name' | 'tagline' | 'description' | 'websiteUrl' | 'status' | 'featured' | 'featuredAt'>>,
) {
  return getStartupsCol().updateOne(
    { _id: id },
    { $set: { ...data, updatedAt: new Date() } },
  );
}

export async function deleteStartup(id: ObjectId) {
  return getStartupsCol().deleteOne({ _id: id });
}

// ============================================================
// Embedded Comments
// ============================================================

export async function addComment(startupId: ObjectId, userId: ObjectId, content: string) {
  const comment = EmbeddedCommentSchema.parse({ content, userId });
  await getStartupsCol().updateOne(
    { _id: startupId },
    {
      $push: { comments: comment },
      $set: { updatedAt: new Date() },
    },
  );
  return comment;
}

export async function removeComment(startupId: ObjectId, commentId: ObjectId) {
  return getStartupsCol().updateOne(
    { _id: startupId },
    {
      $pull: { comments: { _id: commentId } as unknown as EmbeddedComment },
      $set: { updatedAt: new Date() },
    },
  );
}

// ============================================================
// Embedded Upvotes
// ============================================================

export async function addUpvote(startupId: ObjectId, userId: ObjectId) {
  // Only add if the user hasn't already upvoted
  return getStartupsCol().updateOne(
    { _id: startupId, 'upvotes.userId': { $ne: userId } },
    {
      $push: { upvotes: EmbeddedUpvoteSchema.parse({ userId }) },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function removeUpvote(startupId: ObjectId, userId: ObjectId) {
  return getStartupsCol().updateOne(
    { _id: startupId },
    {
      $pull: { upvotes: { userId } },
      $set: { updatedAt: new Date() },
    },
  );
}
