// src/lib/api-server.ts
// Server-side fetch functions with Next.js caching

const API_BASE_URL =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

import type {
  Startup,
  Category,
  PaginatedResponse,
} from '@/types';

async function fetchFromApi<T>(
  endpoint: string,
  options?: RequestInit & { next?: { revalidate?: number; tags?: string[] } }
): Promise<T> {
  const url = API_BASE_URL + endpoint;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(
      'API request failed: ' + response.status + ' ' + response.statusText
    );
  }

  return response.json();
}

export async function getStartupsServer(params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}): Promise<PaginatedResponse<Startup>> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  const endpoint = '/startups' + (query ? '?' + query : '');

  return fetchFromApi<PaginatedResponse<Startup>>(endpoint, {
    next: {
      revalidate: 60, // Revalidate every 60 seconds
      tags: ['startups'],
    },
  });
}

export async function getStartupServer(id: number): Promise<Startup> {
  return fetchFromApi<Startup>('/startups/' + id, {
    next: {
      revalidate: 60,
      tags: ['startup-' + id],
    },
  });
}

export async function getCategoriesServer(): Promise<Category[]> {
  return fetchFromApi<Category[]>('/categories', {
    next: {
      revalidate: 3600, // Categories change rarely, cache for 1 hour
      tags: ['categories'],
    },
  });
}
