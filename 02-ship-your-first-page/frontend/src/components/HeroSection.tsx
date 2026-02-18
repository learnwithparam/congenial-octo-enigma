import Link from "next/link";

export function HeroSection() {
  return (
    <section className="border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl dark:text-gray-100">
            Discover the Next
            <span className="block text-primary-500">Big Thing</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-gray-600 sm:text-lg lg:text-xl dark:text-gray-400">
            LaunchPad is where founders showcase their startups and the
            community decides what rises to the top. Browse, upvote, and find
            your next favorite product.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <Link
              href="/startups"
              className="rounded-lg bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
            >
              Browse Startups
            </Link>
            <Link
              href="/submit"
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Submit Yours
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
