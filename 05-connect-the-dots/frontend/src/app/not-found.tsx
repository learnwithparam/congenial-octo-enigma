import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100">
        404
      </h1>
      <div className="mt-4 mb-2">
        <svg
          className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Page not found
      </h2>
      <p className="mb-8 max-w-md text-gray-600 dark:text-gray-400">
        The page you are looking for does not exist or has been moved. Let us
        get you back on track.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          Go Home
        </Link>
        <Link
          href="/startups"
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
        >
          Browse Startups
        </Link>
      </div>
    </div>
  );
}
