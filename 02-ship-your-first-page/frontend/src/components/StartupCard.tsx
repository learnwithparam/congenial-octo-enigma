import Link from "next/link";
import { Startup } from "@/types";
import { Badge } from "@/components/Badge";

type StartupCardProps = {
  startup: Startup;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function StartupCard({ startup }: StartupCardProps) {
  return (
    <Link
      href={`/startups/${startup.slug}`}
      className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary-300 sm:p-5 dark:border-gray-800 dark:bg-gray-900 dark:hover:shadow-gray-900/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-900 group-hover:text-primary-600 transition-colors sm:text-lg dark:text-gray-100 dark:group-hover:text-primary-400">
            {startup.name}
          </h3>
          <p className="mt-1 text-sm text-gray-500 line-clamp-2 dark:text-gray-400">
            {startup.tagline}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-center group-hover:border-primary-200 group-hover:bg-primary-50 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:group-hover:border-primary-700 dark:group-hover:bg-primary-900/50">
          <svg
            className="h-3.5 w-3.5 text-gray-400 group-hover:text-primary-500 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
          <span className="text-xs font-bold text-gray-600 group-hover:text-primary-600 transition-colors dark:text-gray-300 dark:group-hover:text-primary-400">
            {startup.upvotes}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Badge>{startup.category}</Badge>
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          <span>{startup.founder}</span>
          <span>{formatDate(startup.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
