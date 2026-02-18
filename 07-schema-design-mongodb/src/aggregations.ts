import { ObjectId } from 'mongodb';
import { getStartupsCol, getCategoriesCol } from './collections.js';

/**
 * Count active startups per category.
 * Uses $lookup to join startups with categories.
 */
export async function startupsPerCategory() {
  return getStartupsCol()
    .aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      { $project: { _id: 0, category: '$category.name', count: 1 } },
      { $sort: { count: -1 } },
    ])
    .toArray();
}

/**
 * Rank startups by upvote count (descending).
 */
export async function startupsByUpvotes() {
  return getStartupsCol()
    .aggregate([
      { $match: { status: 'active' } },
      { $project: { name: 1, upvoteCount: { $size: '$upvotes' } } },
      { $sort: { upvoteCount: -1 } },
    ])
    .toArray();
}

/**
 * Get the most recent comments across all startups.
 */
export async function recentComments(limit = 10) {
  return getStartupsCol()
    .aggregate([
      { $unwind: '$comments' },
      { $sort: { 'comments.createdAt': -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'comments.userId',
          foreignField: '_id',
          as: 'commentUser',
        },
      },
      { $unwind: '$commentUser' },
      {
        $project: {
          _id: 0,
          startup: '$name',
          comment: '$comments.content',
          user: '$commentUser.name',
          createdAt: '$comments.createdAt',
        },
      },
    ])
    .toArray();
}

/**
 * Featured startups with founder details ($lookup).
 */
export async function featuredStartups() {
  return getStartupsCol()
    .aggregate([
      { $match: { featured: true, status: 'active' } },
      {
        $lookup: {
          from: 'users',
          localField: 'founderId',
          foreignField: '_id',
          as: 'founder',
        },
      },
      { $unwind: '$founder' },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $project: {
          name: 1,
          tagline: 1,
          founder: '$founder.name',
          category: '$category.name',
          upvoteCount: { $size: '$upvotes' },
        },
      },
      { $sort: { upvoteCount: -1 } },
    ])
    .toArray();
}
