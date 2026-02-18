import { ObjectId } from 'mongodb';
import { z } from 'zod';

// ============================================================
// Zod Schemas
// ============================================================

export const UserSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  name: z.string().min(1),
  email: z.string().email(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export const CategorySchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
});

/** Embedded comment — stored directly inside the startup document. */
export const EmbeddedCommentSchema = z.object({
  _id: z.instanceof(ObjectId).default(() => new ObjectId()),
  content: z.string().min(1),
  userId: z.instanceof(ObjectId),
  createdAt: z.date().default(() => new Date()),
});

/** Embedded upvote — stored directly inside the startup document. */
export const EmbeddedUpvoteSchema = z.object({
  userId: z.instanceof(ObjectId),
  createdAt: z.date().default(() => new Date()),
});

export const StartupSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  websiteUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  categoryId: z.instanceof(ObjectId),
  founderId: z.instanceof(ObjectId),
  status: z.enum(['pending', 'active', 'inactive']).default('pending'),
  featured: z.boolean().default(false),
  featuredAt: z.date().optional(),
  // Embedded sub-documents
  comments: z.array(EmbeddedCommentSchema).default([]),
  upvotes: z.array(EmbeddedUpvoteSchema).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// ============================================================
// Inferred TypeScript types
// ============================================================

export type User = z.infer<typeof UserSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type EmbeddedComment = z.infer<typeof EmbeddedCommentSchema>;
export type EmbeddedUpvote = z.infer<typeof EmbeddedUpvoteSchema>;
export type Startup = z.infer<typeof StartupSchema>;
