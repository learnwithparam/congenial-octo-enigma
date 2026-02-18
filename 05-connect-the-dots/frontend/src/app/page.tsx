import { Suspense } from 'react';
import { getStartupsServer } from '@/lib/api-server';
import { StartupCard } from '@/components/startup-card';
import { StartupGridSkeleton } from '@/components/startup-grid-skeleton';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function LatestStartups() {
  const result = await getStartupsServer({ limit: 12 });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {result.data.map((startup) => (
        <StartupCard key={startup.id} startup={startup} />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <section className="text-center py-16">
        <h1 className="text-4xl font-bold">
          Discover the Next Big Thing
        </h1>
        <p className="text-xl text-gray-600 mt-4 dark:text-gray-400">
          LaunchPad showcases the most innovative startups
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Latest Launches</h2>
          <Link
            href="/startups"
            className="text-primary-600 hover:underline dark:text-primary-400"
          >
            View all
          </Link>
        </div>

        <Suspense fallback={<StartupGridSkeleton />}>
          <LatestStartups />
        </Suspense>
      </section>
    </div>
  );
}
