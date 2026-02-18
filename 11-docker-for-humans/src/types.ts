export interface Startup {
  id: string;
  name: string;
  description: string;
  industry: string;
  founded: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateStartupInput = Pick<Startup, "name" | "description" | "industry" | "founded">;

export type UpdateStartupInput = Partial<CreateStartupInput>;

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
