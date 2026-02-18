import Link from "next/link";
import { getFeaturedStartups, getStartups } from "@/lib/api";
import { HeroSection } from "@/components/HeroSection";
import { StartupList } from "@/components/StartupList";

export default function HomePage() {
  const featured = getFeaturedStartups(3);
  const recent = getStartups().slice(0, 6);

  return (
    <div>
      <HeroSection />

      <div className="bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Featured Section */}
          <section>
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Trending Now
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  The most upvoted startups this month
                </p>
              </div>
              <Link
                href="/startups"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="mt-6">
              <StartupList startups={featured} />
            </div>
          </section>

          {/* Recent Section */}
          <section className="mt-16">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Recently Added
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  The newest startups on LaunchPad
                </p>
              </div>
              <Link
                href="/startups"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="mt-6">
              <StartupList startups={recent} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
