'use client';

import { useState } from 'react';
import { upvoteStartup } from '@/lib/api';
import { revalidateStartup } from '@/app/actions';

interface Props {
  startupId: number;
  initialUpvotes: number;
}

export function UpvoteButton({ startupId, initialUpvotes }: Props) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  async function handleUpvote() {
    if (hasVoted) return;

    setIsVoting(true);
    try {
      const result = await upvoteStartup(startupId);
      setUpvotes(result.upvotes);
      setHasVoted(true);
      // Revalidate in the background - don't await
      revalidateStartup(startupId);
    } catch (error) {
      console.error('Failed to upvote');
    } finally {
      setIsVoting(false);
    }
  }

  return (
    <button
      onClick={handleUpvote}
      disabled={isVoting || hasVoted}
      className={
        'flex flex-col items-center px-4 py-2 rounded-lg border transition-colors ' +
        (hasVoted
          ? 'bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400'
          : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20')
      }
    >
      <svg
        className="w-5 h-5"
        fill={hasVoted ? 'currentColor' : 'none'}
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
      <span className="text-sm font-semibold">{upvotes}</span>
    </button>
  );
}
