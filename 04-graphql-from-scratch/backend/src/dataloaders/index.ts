// src/dataloaders/index.ts
import DataLoader from 'dataloader';
import {
  users,
  categories,
  comments,
} from '../data/store.js';
import type {
  UserRecord,
  CategoryRecord,
  CommentRecord,
} from '../data/store.js';

// Batch function for users
// Takes an array of user IDs, returns an array of users in the same order
async function batchUsers(
  ids: readonly string[]
): Promise<(UserRecord | Error)[]> {
  console.log('DataLoader: batch loading users:', [...ids]);

  // In a real app this would be: SELECT * FROM users WHERE id IN (...)
  const userMap = new Map<string, UserRecord>();
  for (const user of users) {
    if (ids.includes(user.id)) {
      userMap.set(user.id, user);
    }
  }

  // CRITICAL: return results in the same order as the input IDs
  return ids.map(
    (id) => userMap.get(id) || new Error('User not found: ' + id)
  );
}

// Batch function for categories
async function batchCategories(
  ids: readonly string[]
): Promise<(CategoryRecord | Error)[]> {
  console.log('DataLoader: batch loading categories:', [...ids]);

  const categoryMap = new Map<string, CategoryRecord>();
  for (const category of categories) {
    if (ids.includes(category.id)) {
      categoryMap.set(category.id, category);
    }
  }

  return ids.map(
    (id) => categoryMap.get(id) || new Error('Category not found: ' + id)
  );
}

// Batch function for comments by startup ID (one-to-many)
async function batchCommentsByStartupId(
  startupIds: readonly string[]
): Promise<CommentRecord[][]> {
  console.log('DataLoader: batch loading comments for startups:', [...startupIds]);

  const commentsByStartup = new Map<string, CommentRecord[]>();
  for (const comment of comments) {
    if (startupIds.includes(comment.startupId)) {
      const existing = commentsByStartup.get(comment.startupId) || [];
      existing.push(comment);
      commentsByStartup.set(comment.startupId, existing);
    }
  }

  // Return arrays in the same order as input IDs
  return startupIds.map(
    (id) => commentsByStartup.get(id) || []
  );
}

// Factory function: creates fresh loaders for each request
export function createDataLoaders() {
  return {
    userLoader: new DataLoader<string, UserRecord>(batchUsers),
    categoryLoader: new DataLoader<string, CategoryRecord>(batchCategories),
    commentsByStartupLoader: new DataLoader<string, CommentRecord[]>(
      batchCommentsByStartupId
    ),
  };
}

export type DataLoaders = ReturnType<typeof createDataLoaders>;
