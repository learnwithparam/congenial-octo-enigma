import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getStartupBySlug,
  getStartupSlugs,
  getStartupsByCategory,
} from "@/lib/api";
import { Badge } from "@/components/Badge";
import { StartupCard } from "@/components/StartupCard";
import { UpvoteButton } from "@/components/UpvoteButton";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const startup = getStartupBySlug(slug);

  if (!startup) {
    return { title: "Startup Not Found | LaunchPad" };
  }

  return {
    title: `${startup.name} | LaunchPad`,
    description: startup.tagline,
    openGraph: {
      title: startup.name,
      description: startup.tagline,
      type: "website",
    },
  };
}

export function generateStaticParams() {
  const slugs = getStartupSlugs();
  return slugs.map((slug) => ({ slug }));
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function StartupDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const startup = getStartupBySlug(slug);

  if (!startup) {
    notFound();
  }

  const relatedStartups = getStartupsByCategory(startup.category)
    .filter((s) => s.id !== startup.id)
    .slice(0, 3);

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link
            href="/"
            className="transition-colors hover:text-gray-900 dark:hover:text-gray-100"
          >
            Home
          </Link>
          <span>/</span>
          <Link
            href="/startups"
            className="transition-colors hover:text-gray-900 dark:hover:text-gray-100"
          >
            Startups
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-100">
            {startup.name}
          </span>
        </nav>

        {/* Main Content */}
        <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-950">
          {/* Header */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-gray-100">
                  {startup.name}
                </h1>
                <Badge>{startup.category}</Badge>
              </div>
              <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
                {startup.tagline}
              </p>
            </div>
            <div className="shrink-0">
              <UpvoteButton initialCount={startup.upvotes} />
            </div>
          </div>

          {/* Divider */}
          <hr className="my-6 border-gray-100 dark:border-gray-800" />

          {/* Description */}
          <div className="prose prose-gray max-w-none dark:prose-invert">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              About {startup.name}
            </h2>
            <p className="mt-3 leading-7 text-gray-600 dark:text-gray-400">
              {startup.description}
            </p>
          </div>

          {/* Details Grid */}
          <div className="mt-8 grid gap-4 rounded-lg border border-gray-100 bg-gray-50 p-5 sm:grid-cols-3 dark:border-gray-800 dark:bg-gray-900">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Founder
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                {startup.founder}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Launched
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatFullDate(startup.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Website
              </p>
              <a
                href={startup.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
              >
                Visit website
              </a>
            </div>
          </div>
        </article>

        {/* Back Link */}
        <div className="mt-6">
          <Link
            href="/startups"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to all startups
          </Link>
        </div>

        {/* Related Startups */}
        {relatedStartups.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              More in {startup.category}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Other startups you might like
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedStartups.map((related) => (
                <StartupCard key={related.id} startup={related} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
