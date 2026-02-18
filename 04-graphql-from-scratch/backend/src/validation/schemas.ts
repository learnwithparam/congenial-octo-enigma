// src/validation/schemas.ts
import { z } from 'zod';

// --- CreateStartupInput ---
export const CreateStartupInputSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),

  tagline: z
    .string()
    .min(3, 'Tagline must be at least 3 characters')
    .max(200, 'Tagline must be at most 200 characters')
    .trim(),

  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be at most 5000 characters')
    .trim(),

  url: z
    .string()
    .url('Must be a valid URL')
    .startsWith('https', 'URL must use HTTPS'),

  categoryId: z
    .string()
    .min(1, 'Category ID is required'),

  founderId: z
    .string()
    .min(1, 'Founder ID is required'),
});

// --- UpdateStartupInput ---
export const UpdateStartupInputSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim()
    .optional(),

  tagline: z
    .string()
    .min(3, 'Tagline must be at least 3 characters')
    .max(200, 'Tagline must be at most 200 characters')
    .trim()
    .optional(),

  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be at most 5000 characters')
    .trim()
    .optional(),

  url: z
    .string()
    .url('Must be a valid URL')
    .startsWith('https', 'URL must use HTTPS')
    .optional(),

  categoryId: z
    .string()
    .min(1, 'Category ID is required')
    .optional(),
});

// --- CreateCommentInput ---
export const CreateCommentInputSchema = z.object({
  startupId: z
    .string()
    .min(1, 'Startup ID is required'),

  authorId: z
    .string()
    .min(1, 'Author ID is required'),

  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be at most 2000 characters')
    .trim(),
});

// Export inferred types so resolvers can use them
export type ValidatedCreateStartupInput = z.infer<typeof CreateStartupInputSchema>;
export type ValidatedUpdateStartupInput = z.infer<typeof UpdateStartupInputSchema>;
export type ValidatedCreateCommentInput = z.infer<typeof CreateCommentInputSchema>;
