// src/context.ts
import { createDataLoaders } from './dataloaders/index.js';
import type { DataLoaders } from './dataloaders/index.js';

export interface GraphQLContext {
  loaders: DataLoaders;
}

export function createContext(): GraphQLContext {
  return {
    loaders: createDataLoaders(),
  };
}
