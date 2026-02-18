import { Suspense } from 'react';
import { StartupGrid } from '@/components/startup-grid';
import { StartupGridSkeleton } from '@/components/startup-grid-skeleton';
import { CategoryFilter } from '@/components/category-filter';
import { getCategoriesServer } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    category?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function StartupsPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const categories = await getCategoriesServer();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">All Startups</h1>

      <CategoryFilter
        categories={categories}
        activeCategory={resolvedParams.category}
      />

      <div className="mt-8">
        <Suspense fallback={<StartupGridSkeleton />}>
          <StartupGrid
            category={resolvedParams.category}
            search={resolvedParams.search}
            page={page}
          />
        </Suspense>
      </div>
    </div>
  );
}
