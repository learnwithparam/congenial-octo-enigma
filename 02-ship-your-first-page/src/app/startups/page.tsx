import { Suspense } from "react";
import type { Metadata } from "next";
import { getStartups, getCategories } from "@/lib/api";
import StartupSearch from "@/components/StartupSearch";
import StartupCardSkeleton from "@/components/StartupCardSkeleton";

export const metadata: Metadata = {
  title: "Browse Startups | LaunchPad",
  description: "Discover and explore the latest startups on LaunchPad.",
};

export default function StartupsPage() {
  const startups = getStartups();
  const categories = getCategories();

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Browse Startups
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Discover the latest startups and vote for your favorites
          </p>
        </div>

        <Suspense
          fallback={
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <StartupCardSkeleton />
              <StartupCardSkeleton />
              <StartupCardSkeleton />
              <StartupCardSkeleton />
              <StartupCardSkeleton />
              <StartupCardSkeleton />
            </div>
          }
        >
          <StartupSearch
            categories={categories}
            initialStartups={startups}
          />
        </Suspense>
      </div>
    </div>
  );
}
