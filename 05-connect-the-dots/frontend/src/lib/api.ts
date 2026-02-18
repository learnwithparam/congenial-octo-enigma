// src/lib/api.ts

import apiClient from './api-client';
import type {
  Startup,
  Category,
  CreateStartupInput,
  UpdateStartupInput,
  PaginatedResponse,
} from '@/types';

// ============================================
// Startup endpoints
// ============================================

export async function getStartups(params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}): Promise<PaginatedResponse<Startup>> {
  const response = await apiClient.get('/startups', { params });
  return response.data;
}

export async function getStartup(id: number): Promise<Startup> {
  const response = await apiClient.get('/startups/' + id);
  return response.data;
}

export async function createStartup(
  data: CreateStartupInput
): Promise<Startup> {
  const response = await apiClient.post('/startups', data);
  return response.data;
}

export async function updateStartup(
  id: number,
  data: UpdateStartupInput
): Promise<Startup> {
  const response = await apiClient.put('/startups/' + id, data);
  return response.data;
}

export async function deleteStartup(id: number): Promise<void> {
  await apiClient.delete('/startups/' + id);
}

export async function upvoteStartup(
  id: number
): Promise<{ upvotes: number }> {
  const response = await apiClient.post('/startups/' + id + '/upvote');
  return response.data;
}

// ============================================
// Category endpoints
// ============================================

export async function getCategories(): Promise<Category[]> {
  const response = await apiClient.get('/categories');
  return response.data;
}

export async function getCategory(id: number): Promise<Category> {
  const response = await apiClient.get('/categories/' + id);
  return response.data;
}
