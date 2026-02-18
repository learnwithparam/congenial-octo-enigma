import { Startup, Category } from "@/types";
import startupsData from "@/data/startups.json";
import categoriesData from "@/data/categories.json";

// Type assertion -- ensure imported JSON matches our types
const startups: Startup[] = startupsData as Startup[];
const categories: Category[] = categoriesData.map((cat) => ({
  ...cat,
  count: startups.filter((s) => s.category === cat.name).length,
}));

// ---------------------
// Startup functions
// ---------------------

export function getStartups(): Startup[] {
  return [...startups].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getStartupBySlug(slug: string): Startup | undefined {
  return startups.find((s) => s.slug === slug);
}

export function getStartupsByCategory(categoryName: string): Startup[] {
  return startups
    .filter((s) => s.category === categoryName)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function getFeaturedStartups(limit: number = 3): Startup[] {
  return [...startups].sort((a, b) => b.upvotes - a.upvotes).slice(0, limit);
}

export async function searchStartups(
  query: string = "",
  category: string = ""
): Promise<Startup[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  let results = [...startups];

  if (category) {
    // Match by category name (find the category by slug first)
    const matchedCategory = categories.find((c) => c.slug === category);
    if (matchedCategory) {
      results = results.filter((s) => s.category === matchedCategory.name);
    }
  }

  if (query) {
    const lowerQuery = query.toLowerCase();
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.tagline.toLowerCase().includes(lowerQuery) ||
        s.description.toLowerCase().includes(lowerQuery)
    );
  }

  return results;
}

export function getStartupSlugs(): string[] {
  return startups.map((s) => s.slug);
}

// ---------------------
// Category functions
// ---------------------

export function getCategories(): Category[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
