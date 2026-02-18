// tests/helpers/reset-data.ts
import { startups, users, categories, comments } from '../../src/data/store.js';

// Store the initial state so we can reset between tests
const initialStartups = [...startups];
const initialUsers = [...users];
const initialCategories = [...categories];
const initialComments = [...comments];

export function resetData(): void {
  startups.length = 0;
  startups.push(...initialStartups.map((s) => ({ ...s })));

  users.length = 0;
  users.push(...initialUsers.map((u) => ({ ...u })));

  categories.length = 0;
  categories.push(...initialCategories.map((c) => ({ ...c })));

  comments.length = 0;
  comments.push(...initialComments.map((c) => ({ ...c })));
}
