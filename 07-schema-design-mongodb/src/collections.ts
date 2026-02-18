import { Collection, Db } from 'mongodb';
import type { User, Category, Startup } from './types.js';

let users: Collection<User>;
let categories: Collection<Category>;
let startups: Collection<Startup>;

/** Initialise collection handles from the given Db instance. */
export function initCollections(db: Db) {
  users = db.collection<User>('users');
  categories = db.collection<Category>('categories');
  startups = db.collection<Startup>('startups');
}

export function getUsersCol(): Collection<User> {
  return users;
}

export function getCategoriesCol(): Collection<Category> {
  return categories;
}

export function getStartupsCol(): Collection<Startup> {
  return startups;
}
