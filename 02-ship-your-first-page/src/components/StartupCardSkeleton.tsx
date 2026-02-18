import Skeleton from "@/components/Skeleton";

export default function StartupCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-800 dark:bg-gray-900">
      {/* Image placeholder */}
      <Skeleton className="mb-4 h-40 w-full rounded-lg" />
      {/* Category badge */}
      <Skeleton className="mb-3 h-5 w-20 rounded-full" />
      {/* Title */}
      <Skeleton className="mb-2 h-6 w-3/4" />
      {/* Tagline */}
      <Skeleton className="mb-4 h-4 w-full" />
      <Skeleton className="mb-4 h-4 w-2/3" />
      {/* Footer with upvote button */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}
