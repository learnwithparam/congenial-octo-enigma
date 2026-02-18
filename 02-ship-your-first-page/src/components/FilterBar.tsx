"use client";

import { Category } from "@/types";

interface FilterBarProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function FilterBar({
  categories,
  activeCategory,
  onCategoryChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onCategoryChange("")}
        className={
          activeCategory === ""
            ? "rounded-full bg-primary-600 px-4 py-1.5 text-sm font-medium text-white"
            : "rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        }
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => onCategoryChange(cat.slug)}
          className={
            activeCategory === cat.slug
              ? "rounded-full bg-primary-600 px-4 py-1.5 text-sm font-medium text-white"
              : "rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
