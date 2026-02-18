import { getCategoriesServer } from '@/lib/api-server';
import { CreateStartupForm } from '@/components/create-startup-form';

export const dynamic = 'force-dynamic';

export default async function NewStartupPage() {
  const categories = await getCategoriesServer();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Launch Your Startup</h1>
      <p className="text-gray-600 mb-8 dark:text-gray-400">
        Share your startup with the LaunchPad community
      </p>
      <CreateStartupForm categories={categories} />
    </div>
  );
}
