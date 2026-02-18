import Link from 'next/link';
import type { Startup } from '@/types';

interface StartupCardProps {
  startup: Startup;
}

export function StartupCard({ startup }: StartupCardProps) {
  return (
    <Link
      href={'/startups/' + startup.id}
      className="block p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow dark:border-gray-800 dark:hover:border-gray-700"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {startup.name}
          </h3>
          <p className="text-gray-600 mt-1 dark:text-gray-400">
            {startup.tagline}
          </p>
        </div>
        <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          {startup.upvotes}
        </span>
      </div>
    </Link>
  );
}
