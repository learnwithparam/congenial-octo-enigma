import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getStartupsByCategory } from "@/lib/api";
import { Badge } from "@/components/Badge";

export const metadata: Metadata = {
  title: "Categories | LaunchPad",
  description: "Browse startups by category",
};

export default function CategoriesPage() {
  const categories = getCategories();

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Categories
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Browse startups by category
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const categoryStartups = getStartupsByCategory(category.name);
            const topStartup = categoryStartups[0];

            return (
              <div
                key={category.slug}
                className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:shadow-md hover:border-primary-300 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-primary-700"
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors dark:text-gray-100 dark:group-hover:text-primary-400">
                    {category.name}
                  </h2>
                  <Badge variant="gray">{category.count}</Badge>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {category.description}
                </p>
                {topStartup && (
                  <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Top startup
                    </p>
                    <Link
                      href={`/startups/${topStartup.slug}`}
                      className="mt-1 block text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors dark:text-gray-300 dark:hover:text-primary-400"
                    >
                      {topStartup.name}
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
