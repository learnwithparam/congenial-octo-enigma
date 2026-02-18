"use client";

export default function StartupsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            Failed to load startups
          </h2>
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            We could not load the startups list. This might be a temporary
            issue. Please try again or come back later.
          </p>
          <button
            onClick={reset}
            className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            Try Again
          </button>
        </div>
        {process.env.NODE_ENV === "development" && (
          <details className="mx-auto mt-4 max-w-md">
            <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400">
              Error details (development only)
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-gray-100 p-4 text-xs text-red-800 dark:bg-gray-800 dark:text-red-400">
              {error.message}
              {"\n"}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
