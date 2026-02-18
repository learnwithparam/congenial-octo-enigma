// src/types.ts

export interface StartupsArgs {
  limit?: number;
  offset?: number;
  categoryId?: string;
  search?: string;
  sortBy?: 'NEWEST' | 'OLDEST' | 'UPVOTES_DESC' | 'UPVOTES_ASC' | 'NAME_ASC' | 'NAME_DESC';
}

export interface StartupCountArgs {
  categoryId?: string;
  search?: string;
}

export interface CreateStartupInput {
  name: string;
  tagline: string;
  description: string;
  url: string;
  categoryId: string;
  founderId: string;
}

export interface UpdateStartupInput {
  name?: string;
  tagline?: string;
  description?: string;
  url?: string;
  categoryId?: string;
}

export interface CreateStartupArgs {
  input: CreateStartupInput;
}

export interface UpdateStartupArgs {
  id: string;
  input: UpdateStartupInput;
}

export interface CreateCommentArgs {
  startupId: string;
  content: string;
  authorId: string;
}
