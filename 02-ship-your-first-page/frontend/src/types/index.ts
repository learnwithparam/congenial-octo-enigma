export type Startup = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  url: string;
  upvotes: number;
  createdAt: string;
  founder: string;
};

export type Category = {
  name: string;
  slug: string;
  description: string;
  count: number;
};

export interface StartupFormData {
  name: string;
  tagline: string;
  description: string;
  url: string;
  category: string;
}

export interface FormErrors {
  name?: string;
  tagline?: string;
  description?: string;
  url?: string;
  category?: string;
}
