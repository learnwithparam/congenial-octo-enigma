import { getStartupsServer } from '@/lib/api-server';
import { StartupCard } from '@/components/startup-card';

interface Props {
  category?: string;
  search?: string;
  page?: number;
}

export async function StartupGrid({ category, search, page = 1 }: Props) {
  const result = await getStartupsServer({
    page,
    limit: 12,
    category,
    search,
  });

  if (result.data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No startups found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {result.data.map((startup) => (
        <StartupCard key={startup.id} startup={startup} />
      ))}
    </div>
  );
}
