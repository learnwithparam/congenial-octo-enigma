// src/resolvers/queries.ts
import { startups, users, categories } from '../data/store.js';
import type { StartupRecord } from '../data/store.js';
import type { StartupsArgs, StartupCountArgs } from '../types.js';

function filterStartups(
  items: StartupRecord[],
  categoryId?: string,
  search?: string
): StartupRecord[] {
  let result = items;

  if (categoryId) {
    result = result.filter((s) => s.categoryId === categoryId);
  }

  if (search) {
    const term = search.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.tagline.toLowerCase().includes(term)
    );
  }

  return result;
}

function sortStartups(
  items: StartupRecord[],
  sortBy?: string
): StartupRecord[] {
  const sorted = [...items];

  switch (sortBy) {
    case 'NEWEST':
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case 'OLDEST':
      return sorted.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    case 'UPVOTES_DESC':
      return sorted.sort((a, b) => b.upvotes - a.upvotes);
    case 'UPVOTES_ASC':
      return sorted.sort((a, b) => a.upvotes - b.upvotes);
    case 'NAME_ASC':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'NAME_DESC':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    default:
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}

export const queryResolvers = {
  Query: {
    startups: (_parent: unknown, args: StartupsArgs) => {
      // 1. Filter
      let result = filterStartups(startups, args.categoryId, args.search);

      // 2. Sort
      result = sortStartups(result, args.sortBy);

      // 3. Paginate
      const offset = args.offset ?? 0;
      if (args.limit !== undefined) {
        result = result.slice(offset, offset + args.limit);
      } else if (offset > 0) {
        result = result.slice(offset);
      }

      return result;
    },

    startup: (_parent: unknown, args: { id: string }) => {
      return startups.find((s) => s.id === args.id) || null;
    },

    startupCount: (_parent: unknown, args: StartupCountArgs) => {
      const filtered = filterStartups(startups, args.categoryId, args.search);
      return filtered.length;
    },

    categories: () => {
      return categories;
    },

    category: (_parent: unknown, args: { id: string }) => {
      return categories.find((c) => c.id === args.id) || null;
    },

    user: (_parent: unknown, args: { id: string }) => {
      return users.find((u) => u.id === args.id) || null;
    },
  },
};
