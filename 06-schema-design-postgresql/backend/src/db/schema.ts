import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  uniqueIndex,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// Users
// ============================================================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================
// Categories
// ============================================================
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// Startups
// ============================================================
export const startups = pgTable(
  'startups',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    tagline: varchar('tagline', { length: 500 }).notNull(),
    description: text('description').notNull(),
    websiteUrl: text('website_url'),
    logoUrl: text('logo_url'),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id),
    founderId: integer('founder_id')
      .notNull()
      .references(() => users.id),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    featured: boolean('featured').notNull().default(false),
    featuredAt: timestamp('featured_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    categoryIdx: index('idx_startups_category_id').on(table.categoryId),
    founderIdx: index('idx_startups_founder_id').on(table.founderId),
    statusIdx: index('idx_startups_status').on(table.status),
    createdAtIdx: index('idx_startups_created_at').on(table.createdAt),
  })
);

// ============================================================
// Comments
// ============================================================
export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    content: text('content').notNull(),
    startupId: integer('startup_id')
      .notNull()
      .references(() => startups.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    startupIdx: index('idx_comments_startup_id').on(table.startupId),
    userIdx: index('idx_comments_user_id').on(table.userId),
  })
);

// ============================================================
// Upvotes
// ============================================================
export const upvotes = pgTable(
  'upvotes',
  {
    id: serial('id').primaryKey(),
    startupId: integer('startup_id')
      .notNull()
      .references(() => startups.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueUpvote: uniqueIndex('unique_upvote').on(table.startupId, table.userId),
    startupIdx: index('idx_upvotes_startup_id').on(table.startupId),
  })
);

// ============================================================
// Relations
// ============================================================
export const usersRelations = relations(users, ({ many }) => ({
  startups: many(startups),
  comments: many(comments),
  upvotes: many(upvotes),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  startups: many(startups),
}));

export const startupsRelations = relations(startups, ({ one, many }) => ({
  category: one(categories, {
    fields: [startups.categoryId],
    references: [categories.id],
  }),
  founder: one(users, {
    fields: [startups.founderId],
    references: [users.id],
  }),
  comments: many(comments),
  upvotes: many(upvotes),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  startup: one(startups, {
    fields: [comments.startupId],
    references: [startups.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const upvotesRelations = relations(upvotes, ({ one }) => ({
  startup: one(startups, {
    fields: [upvotes.startupId],
    references: [startups.id],
  }),
  user: one(users, {
    fields: [upvotes.userId],
    references: [users.id],
  }),
}));

// ============================================================
// Inferred Types
// ============================================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Startup = typeof startups.$inferSelect;
export type NewStartup = typeof startups.$inferInsert;

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

export type Upvote = typeof upvotes.$inferSelect;
export type NewUpvote = typeof upvotes.$inferInsert;
