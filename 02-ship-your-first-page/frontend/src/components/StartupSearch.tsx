"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import { StartupList } from "@/components/StartupList";
import { searchStartups } from "@/lib/api";
import { Category, Startup } from "@/types";

interface StartupSearchProps {
  categories: Category[];
  initialStartups: Startup[];
}

export default function StartupSearch({
  categories,
  initialStartups,
}: StartupSearchProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentQuery = searchParams.get("q") || "";
  const currentCategory = searchParams.get("category") || "";

  const [startups, setStartups] = useState<Startup[]>(initialStartups);
  const [isSearching, setIsSearching] = useState(false);
  const [resultsCount, setResultsCount] = useState(initialStartups.length);

  // Update the URL params without a full page reload
  const updateParams = useCallback(
    (query: string, category: string) => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (category) params.set("category", category);

      const paramString = params.toString();
      const newUrl = paramString ? pathname + "?" + paramString : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router]
  );

  // Fetch filtered results whenever URL params change
  useEffect(() => {
    let cancelled = false;

    async function fetchResults() {
      setIsSearching(true);
      const results = await searchStartups(currentQuery, currentCategory);
      if (!cancelled) {
        setStartups(results);
        setResultsCount(results.length);
        setIsSearching(false);
      }
    }

    // Only fetch if there are actual filter params
    if (currentQuery || currentCategory) {
      fetchResults();
    } else {
      setStartups(initialStartups);
      setResultsCount(initialStartups.length);
    }

    return () => {
      cancelled = true;
    };
  }, [currentQuery, currentCategory, initialStartups]);

  const handleSearch = useCallback(
    (query: string) => {
      updateParams(query, currentCategory);
    },
    [currentCategory, updateParams]
  );

  const handleCategoryChange = useCallback(
    (category: string) => {
      updateParams(currentQuery, category);
    },
    [currentQuery, updateParams]
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <SearchBar defaultValue={currentQuery} onSearch={handleSearch} />
      <FilterBar
        categories={categories}
        activeCategory={currentCategory}
        onCategoryChange={handleCategoryChange}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {resultsCount} {resultsCount === 1 ? "startup" : "startups"} found
        </p>
        {isSearching && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Searching...
          </div>
        )}
      </div>

      {startups.length > 0 ? (
        <StartupList startups={startups} />
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center dark:border-gray-700">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            No startups found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your search or filter to find what you are looking for.
          </p>
        </div>
      )}
    </div>
  );
}
