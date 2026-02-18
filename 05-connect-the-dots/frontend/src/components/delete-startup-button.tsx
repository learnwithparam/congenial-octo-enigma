'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteStartup } from '@/lib/api';
import { revalidateStartups } from '@/app/actions';

interface Props {
  startupId: number;
  startupName: string;
}

export function DeleteStartupButton({ startupId, startupName }: Props) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteStartup(startupId);
      await revalidateStartups();
      router.push('/startups');
    } catch (error) {
      alert('Failed to delete startup. Please try again.');
      setIsDeleting(false);
      setIsConfirming(false);
    }
  }

  if (isConfirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600 dark:text-red-400">
          Delete {startupName}?
        </span>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Confirm'}
        </button>
        <button
          onClick={() => setIsConfirming(false)}
          className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsConfirming(true)}
      className="px-3 py-1 text-red-600 text-sm border border-red-200 rounded hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
    >
      Delete
    </button>
  );
}
