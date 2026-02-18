import Link from "next/link";

export default function StartupNotFound() {
  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-6xl font-bold text-gray-200 dark:text-gray-700">
            404
          </p>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
            Startup not found
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            The startup you are looking for does not exist or may have been
            removed.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/startups"
              className="rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
            >
              Browse all startups
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
