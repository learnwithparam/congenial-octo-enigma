import StartupCardSkeleton from "@/components/StartupCardSkeleton";
import Skeleton from "@/components/Skeleton";

export default function StartupsLoading() {
  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page title skeleton */}
        <Skeleton className="mb-2 h-9 w-64" />
        <Skeleton className="mb-8 h-5 w-96" />

        {/* Search bar skeleton */}
        <Skeleton className="mb-6 h-10 w-full rounded-lg" />

        {/* Filter pills skeleton */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>

        {/* Results count skeleton */}
        <Skeleton className="mb-6 h-4 w-32" />

        {/* Card grid skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StartupCardSkeleton />
          <StartupCardSkeleton />
          <StartupCardSkeleton />
          <StartupCardSkeleton />
          <StartupCardSkeleton />
          <StartupCardSkeleton />
        </div>
      </div>
    </div>
  );
}
