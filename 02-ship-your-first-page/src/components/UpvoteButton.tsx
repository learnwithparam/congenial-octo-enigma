"use client";

import { useState } from "react";

type UpvoteButtonProps = {
  initialCount: number;
};

export function UpvoteButton({ initialCount }: UpvoteButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [hasVoted, setHasVoted] = useState(false);

  function handleClick() {
    if (hasVoted) {
      setCount(count - 1);
      setHasVoted(false);
    } else {
      setCount(count + 1);
      setHasVoted(true);
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`flex flex-col items-center rounded-xl border-2 px-5 py-3 text-center transition-all active:scale-[0.98] ${
        hasVoted
          ? "border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-300"
          : "border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:bg-primary-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-primary-700 dark:hover:bg-primary-900/50"
      }`}
    >
      <svg
        className={`h-5 w-5 transition-colors ${
          hasVoted ? "text-primary-500" : "text-gray-400"
        }`}
        fill={hasVoted ? "currentColor" : "none"}
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
      <span className="mt-1 text-lg font-bold">{count}</span>
      <span className="text-xs">{hasVoted ? "Voted" : "Upvote"}</span>
    </button>
  );
}
