import { z } from 'zod';

export const createStartupSchema = z.object({
  name: z
    .string({
      required_error: 'Name is required',
    })
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),

  tagline: z
    .string({
      required_error: 'Tagline is required',
    })
    .min(10, 'Tagline must be at least 10 characters')
    .max(200, 'Tagline must be at most 200 characters')
    .trim(),

  description: z
    .string({
      required_error: 'Description is required',
    })
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description must be at most 2000 characters')
    .trim(),

  url: z
    .string({
      required_error: 'URL is required',
    })
    .url('URL must be a valid URL (e.g. https://example.com)'),

  category_id: z
    .number({
      required_error: 'Category is required',
      invalid_type_error: 'Category must be a number',
    })
    .int('Category must be an integer')
    .positive('Category must be a positive number'),
});

export const updateStartupSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim()
    .optional(),

  tagline: z
    .string()
    .min(10, 'Tagline must be at least 10 characters')
    .max(200, 'Tagline must be at most 200 characters')
    .trim()
    .optional(),

  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description must be at most 2000 characters')
    .trim()
    .optional(),

  url: z
    .string()
    .url('URL must be a valid URL (e.g. https://example.com)')
    .optional(),

  category_id: z
    .number({
      invalid_type_error: 'Category must be a number',
    })
    .int('Category must be an integer')
    .positive('Category must be a positive number')
    .optional(),
});

export const listStartupsSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform(Number)
    .pipe(z.number().int().positive('Page must be a positive integer')),

  limit: z
    .string()
    .optional()
    .default('10')
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit must be at most 100')
    ),

  sort: z
    .enum(['created_at', 'name', 'upvotes'], {
      errorMap: () => ({
        message: 'Sort must be one of: created_at, name, upvotes',
      }),
    })
    .optional()
    .default('created_at'),

  order: z
    .enum(['asc', 'desc'], {
      errorMap: () => ({
        message: 'Order must be asc or desc',
      }),
    })
    .optional()
    .default('desc'),

  category: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : undefined))
    .pipe(
      z
        .number()
        .int()
        .positive('Category must be a positive integer')
        .optional()
    ),

  search: z.string().optional(),
});

// Infer TypeScript types from the schemas
export type CreateStartupInput = z.infer<typeof createStartupSchema>;
export type UpdateStartupInput = z.infer<typeof updateStartupSchema>;
export type ListStartupsQuery = z.infer<typeof listStartupsSchema>;
