import Link from 'next/link';
import type { Category } from '@/types';

interface CategoryFilterProps {
  categories: Category[];
  activeCategory?: string;
}

export function CategoryFilter({
  categories,
  activeCategory,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/startups"
        className={
          !activeCategory
            ? 'rounded-full bg-primary-600 px-4 py-1.5 text-sm font-medium text-white'
            : 'rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        }
      >
        All
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.slug}
          href={'/startups?category=' + cat.slug}
          className={
            activeCategory === cat.slug
              ? 'rounded-full bg-primary-600 px-4 py-1.5 text-sm font-medium text-white'
              : 'rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }
        >
          {cat.name}
        </Link>
      ))}
    </div>
  );
}
