export function StartupGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="p-6 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse dark:bg-gray-700" />
          <div className="h-4 w-full bg-gray-100 rounded animate-pulse mt-3 dark:bg-gray-800" />
          <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse mt-2 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  );
}
