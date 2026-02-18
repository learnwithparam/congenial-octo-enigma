import { getCategoriesServer } from '@/lib/api-server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const categories = await getCategoriesServer();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Browse Categories</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={'/startups?category=' + category.slug}
            className="block p-6 rounded-lg border border-gray-200 hover:border-blue-500 transition-colors dark:border-gray-800 dark:hover:border-blue-600"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {category.name}
            </h2>
            {category.description && (
              <p className="text-gray-600 mt-2 dark:text-gray-400">
                {category.description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
