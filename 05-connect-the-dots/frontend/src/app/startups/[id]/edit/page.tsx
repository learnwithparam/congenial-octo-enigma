import { getStartupServer, getCategoriesServer } from '@/lib/api-server';
import { EditStartupForm } from '@/components/edit-startup-form';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditStartupPage({ params }: Props) {
  const { id } = await params;
  const numericId = parseInt(id, 10);

  if (isNaN(numericId)) {
    notFound();
  }

  let startup;
  let categories;

  try {
    [startup, categories] = await Promise.all([
      getStartupServer(numericId),
      getCategoriesServer(),
    ]);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Edit {startup.name}</h1>
      <EditStartupForm startup={startup} categories={categories} />
    </div>
  );
}
