import { getStartupServer } from '@/lib/api-server';
import { UpvoteButton } from '@/components/upvote-button';
import { DeleteStartupButton } from '@/components/delete-startup-button';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StartupPage({ params }: Props) {
  const { id } = await params;
  const numericId = parseInt(id, 10);

  if (isNaN(numericId)) {
    notFound();
  }

  let startup;
  try {
    startup = await getStartupServer(numericId);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{startup.name}</h1>
          <p className="text-lg text-gray-600 mt-2 dark:text-gray-400">
            {startup.tagline}
          </p>
        </div>
        {/* Client Component for interactivity */}
        <UpvoteButton
          startupId={startup.id}
          initialUpvotes={startup.upvotes}
        />
      </div>

      <div className="mt-8 prose max-w-none dark:prose-invert">
        <p>{startup.description}</p>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <a
          href={startup.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Visit Website
        </a>
        <Link
          href={'/startups/' + startup.id + '/edit'}
          className="inline-block px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Edit
        </Link>
        <DeleteStartupButton
          startupId={startup.id}
          startupName={startup.name}
        />
      </div>
    </div>
  );
}
