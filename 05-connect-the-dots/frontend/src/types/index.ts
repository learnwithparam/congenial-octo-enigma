// src/types/index.ts

export interface Startup {
  id: number;
  name: string;
  tagline: string;
  description: string;
  url: string;
  category_id: number;
  logo_url: string | null;
  upvotes: number;
  launch_date: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
}

// For creating new startups
export interface CreateStartupInput {
  name: string;
  tagline: string;
  description: string;
  url: string;
  category_id: number;
  logo_url?: string;
}

// For updating startups
export interface UpdateStartupInput {
  name?: string;
  tagline?: string;
  description?: string;
  url?: string;
  category_id?: number;
  logo_url?: string;
}

// Paginated response wrapper
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
