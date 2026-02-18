# 07 — Optimistic Updates

When a user clicks an upvote button, they expect the count to change immediately. If the UI waits for the server to respond before updating, there is a noticeable delay that makes the application feel sluggish. Optimistic updates solve this by updating the UI first and then sending the request to the server. If the server confirms the action, everything is already in sync. If the server rejects it, the UI rolls back to the previous state. This lesson explores the optimistic update pattern using the upvote-button.tsx component in our LaunchPad project, and connects it to Next.js server action revalidation.

## What You Will Learn

- What optimistic updates are and when to use them
- How the upvote-button.tsx component implements this pattern
- How to roll back state when an API call fails
- The relationship between client state and server cache in Next.js
- How server actions (revalidateTag, revalidatePath) keep server-rendered data fresh
- How to combine optimistic UI with Next.js cache revalidation
- Trade-offs and pitfalls of optimistic updates

## Key Concepts

### The Perceived Performance Problem

Consider a typical request-response cycle for an upvote action:

1. User clicks the upvote button.
2. Frontend sends `POST /startups/42/upvote` to the server.
3. Server processes the request (database write, validation).
4. Server responds with the new upvote count.
5. Frontend updates the UI with the new count.

Steps 2 through 4 take anywhere from 50ms on a fast local network to several hundred milliseconds on a slow connection. During that time, the UI is frozen. The user sees no change and might click again, thinking the first click did not register.

### The Optimistic Approach

Optimistic updates flip the order:

1. User clicks the upvote button.
2. Frontend immediately updates the count in the UI (before the server responds).
3. Frontend sends `POST /startups/42/upvote` to the server.
4. If the server confirms, the count is already correct in the UI.
5. If the server rejects, the frontend rolls back the count to its previous value.

The user sees instant feedback. The action feels immediate even though the server has not processed it yet. This is called "optimistic" because we are optimistically assuming the server will succeed.

### When to Use Optimistic Updates

Optimistic updates work best when:

- The action is very likely to succeed (like upvoting, where there are few reasons for failure).
- The update is small and reversible (incrementing a counter, toggling a boolean).
- Immediate feedback significantly improves the user experience.

They are less appropriate when:

- The action has complex validation that might fail (like creating a resource with many required fields).
- The action has irreversible side effects (like sending an email or charging a payment).
- The success rate is low or unpredictable.

## Step by Step

### Step 1: The API Function

Before looking at the component, let us review the API function it depends on. In `src/lib/api.ts`:

```ts
export async function upvoteStartup(
  id: number
): Promise<{ upvotes: number }> {
  const response = await apiClient.post('/startups/' + id + '/upvote');
  return response.data;
}
```

This function sends a POST request to the upvote endpoint and returns the new upvote count from the server. The response includes the authoritative count from the database, which is important for reconciliation.

### Step 2: The Upvote Button Component

Open `src/components/upvote-button.tsx`:

```tsx
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
          ? 'bg-blue-50 border-blue-300 text-blue-600'
          : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50')
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
```

Let us break down how this component manages state and handles the update flow.

### Step 3: State Management in the Component

The component maintains three pieces of state:

```ts
const [upvotes, setUpvotes] = useState(initialUpvotes);
const [isVoting, setIsVoting] = useState(false);
const [hasVoted, setHasVoted] = useState(false);
```

`upvotes` tracks the displayed count. It starts with the value from the server (passed as `initialUpvotes` prop from a Server Component) and gets updated after the API call succeeds.

`isVoting` tracks whether a request is currently in flight. While true, the button is disabled to prevent double-clicking.

`hasVoted` tracks whether the user has already voted. Once true, the button stays permanently disabled and switches to its "voted" visual style. This prevents users from upvoting the same startup multiple times in a single session.

### Step 4: The Update Flow in Detail

Let us trace through `handleUpvote` line by line:

```ts
async function handleUpvote() {
  if (hasVoted) return;
```

First guard: if the user has already voted, do nothing. This is a fast bail-out before any state changes.

```ts
  setIsVoting(true);
```

Set the loading state. The button becomes disabled immediately, providing visual feedback that the click was registered.

```ts
  try {
    const result = await upvoteStartup(startupId);
    setUpvotes(result.upvotes);
    setHasVoted(true);
```

Call the API and wait for the response. When it succeeds, update the count with the server's authoritative value and mark the user as having voted. The server's count is used instead of simply incrementing the local count because another user might have upvoted between the time this page loaded and when this request was processed.

```ts
    // Revalidate in the background - don't await
    revalidateStartup(startupId);
```

Trigger a server action to revalidate the cached data. This line is intentionally not awaited, which we will examine in detail in the next step.

```ts
  } catch (error) {
    console.error('Failed to upvote');
  } finally {
    setIsVoting(false);
  }
}
```

If the API call fails, log the error and reset the loading state. The upvote count stays at its original value because `setUpvotes` was never called (it only runs inside the try block after a successful response).

### Step 5: Making It Fully Optimistic

The current implementation waits for the server response before updating the count. To make it fully optimistic, we would update the count immediately and roll back on failure:

```tsx
async function handleUpvote() {
  if (hasVoted) return;

  // Save the current value for potential rollback
  const previousUpvotes = upvotes;

  // Optimistically update the UI immediately
  setUpvotes((prev) => prev + 1);
  setHasVoted(true);
  setIsVoting(true);

  try {
    const result = await upvoteStartup(startupId);
    // Reconcile with the server's authoritative count
    setUpvotes(result.upvotes);
    revalidateStartup(startupId);
  } catch (error) {
    // Roll back to the previous state
    setUpvotes(previousUpvotes);
    setHasVoted(false);
    console.error('Failed to upvote');
  } finally {
    setIsVoting(false);
  }
}
```

The key differences in this version:

Before the API call, we save the current upvote count in `previousUpvotes`. This is our rollback value.

We immediately call `setUpvotes((prev) => prev + 1)` and `setHasVoted(true)`. The UI updates on the very next render, which happens before the network request completes.

In the success case, we reconcile with `result.upvotes` from the server. This handles the case where the server count differs from our optimistic prediction (for example, another user upvoted between our page load and our click).

In the error case, we restore `previousUpvotes` and reset `hasVoted` to false. The UI snaps back to its original state, and the user can try again.

### Step 6: Server Action Revalidation

After a successful upvote, we call `revalidateStartup(startupId)`. This is a server action defined in `src/app/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { revalidateTag } from 'next/cache';

export async function revalidateStartups() {
  revalidateTag('startups');
  revalidatePath('/startups');
  revalidatePath('/');
}

export async function revalidateStartup(id: number) {
  revalidateTag('startup-' + id);
  revalidatePath('/startups/' + id);
}
```

The `'use server'` directive marks this file as containing server actions. These functions run on the server, not in the browser.

`revalidateTag('startup-' + id)` invalidates all cached fetch requests that were tagged with that string. Look back at `api-server.ts`:

```ts
export async function getStartupServer(id: number): Promise<Startup> {
  return fetchFromApi<Startup>('/startups/' + id, {
    next: {
      revalidate: 60,
      tags: ['startup-' + id],
    },
  });
}
```

The server-side fetch for a startup is tagged with `'startup-42'` (for example). When we call `revalidateTag('startup-42')`, Next.js marks that cached data as stale. The next time any Server Component renders and calls `getStartupServer(42)`, Next.js will fetch fresh data from the API instead of serving the cached version.

`revalidatePath('/startups/' + id)` revalidates the entire page at that URL. This ensures that if a user navigates to the startup detail page, they see the updated upvote count.

### Step 7: Why Not Await the Revalidation

In the upvote handler, the revalidation call is not awaited:

```ts
// Revalidate in the background - don't await
revalidateStartup(startupId);
```

This is intentional. The revalidation is a background operation that the user does not need to wait for. The client-side state (`upvotes`) is already correct because we updated it from the API response. The revalidation only affects the Next.js server cache, which matters for subsequent page loads or other users.

If we awaited the revalidation, the user would wait an extra round trip for something they cannot even see. The `finally` block (which resets `isVoting`) would run later, keeping the button in its loading state longer than necessary.

### Step 8: The Two-Cache Problem

In a Next.js application that mixes Server Components and Client Components, there are effectively two sources of truth:

The first is the Next.js server cache. This is the data fetched by Server Components using the extended fetch with `next.revalidate` and `next.tags`. It lives on the server and is shared across all users.

The second is the React client state. This is the data managed by useState, useReducer, or state management libraries in Client Components. It lives in the browser and is specific to each user.

When the upvote button updates its local state, the server cache still has the old count. This is why we call `revalidateStartup` after a successful upvote. It tells the server cache to refresh so that the next Server Component render shows the correct number.

If we did not call revalidation, a user who upvoted and then refreshed the page might briefly see the old count (from the stale server cache) before it catches up.

### Step 9: Optimistic Updates with React useOptimistic

React 19 introduced the `useOptimistic` hook specifically for this pattern:

```tsx
import { useOptimistic } from 'react';

function UpvoteButtonWithHook({ startupId, initialUpvotes }: Props) {
  const [optimisticUpvotes, addOptimisticUpvote] = useOptimistic(
    initialUpvotes,
    (currentUpvotes: number) => currentUpvotes + 1
  );

  async function handleUpvote() {
    addOptimisticUpvote(1);

    try {
      await upvoteStartup(startupId);
      revalidateStartup(startupId);
    } catch (error) {
      console.error('Failed to upvote');
      // The optimistic state automatically reverts
      // when the action that triggered it completes
    }
  }

  return (
    <button onClick={handleUpvote}>
      <span>{optimisticUpvotes}</span>
    </button>
  );
}
```

The `useOptimistic` hook takes the "real" value and an updater function. When you call `addOptimisticUpvote`, it immediately applies the updater to produce the optimistic value. When the async action completes (or fails), React reverts to the real value. This is a cleaner API than manual rollback with `useState`.

Note that `useOptimistic` is designed to work with React Server Components and server actions. In a fully server-action-based architecture, the revalidation would automatically update the "real" value, and the optimistic value would resolve seamlessly.

### Step 10: Optimistic Updates for More Complex Cases

Upvoting is a simple case: increment a number. Let us look at how optimistic updates work for adding an item to a list, which is a more complex scenario:

```tsx
'use client';

import { useState } from 'react';

interface Comment {
  id: number;
  text: string;
  author: string;
}

function CommentList({
  startupId,
  initialComments,
}: {
  startupId: number;
  initialComments: Comment[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState('');

  async function handleAddComment() {
    const text = newComment.trim();
    if (!text) return;

    // Create a temporary comment with a negative ID
    const tempComment: Comment = {
      id: -Date.now(), // Temporary negative ID
      text,
      author: 'You',
    };

    // Optimistically add to the list
    setComments((prev) => [...prev, tempComment]);
    setNewComment('');

    try {
      // Send to server and get the real comment back
      const response = await apiClient.post(
        '/startups/' + startupId + '/comments',
        { text }
      );
      const realComment = response.data as Comment;

      // Replace the temporary comment with the real one
      setComments((prev) =>
        prev.map((c) => (c.id === tempComment.id ? realComment : c))
      );
    } catch (error) {
      // Remove the temporary comment on failure
      setComments((prev) =>
        prev.filter((c) => c.id !== tempComment.id)
      );
    }
  }

  return (
    <div>
      {comments.map((comment) => (
        <div
          key={comment.id}
          className={comment.id < 0 ? 'opacity-50' : ''}
        >
          <p>{comment.text}</p>
          <span>{comment.author}</span>
        </div>
      ))}
      <input
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        placeholder="Add a comment..."
      />
      <button onClick={handleAddComment}>Post</button>
    </div>
  );
}
```

There are several patterns worth noting here.

The temporary comment uses a negative ID (`-Date.now()`) to distinguish it from real server-assigned IDs. This makes rollback easy because you can filter by ID.

While the temporary comment exists, it renders with `opacity-50` to give the user a subtle visual cue that it is still pending. This is a nice middle ground between hiding the comment (which defeats the purpose of optimistic updates) and showing it as fully confirmed.

On success, we swap the temporary comment for the real one using `map`. On failure, we remove the temporary comment using `filter`.

### Step 11: Common Pitfalls

There are several things that can go wrong with optimistic updates.

Race conditions: if the user clicks rapidly, multiple optimistic updates can overlap. The upvote button handles this with the `hasVoted` guard and the `isVoting` disabled state.

Stale closures: if your rollback references a stale value from a previous render, you might roll back to the wrong state. Using the functional form of setState (`setUpvotes((prev) => prev + 1)`) helps avoid this.

Inconsistent rollbacks: if an optimistic update touches multiple pieces of state, make sure you roll back all of them on failure, not just some. In the upvote example, both `upvotes` and `hasVoted` need to be restored.

Over-optimism: not every action should be optimistic. If the action has a significant chance of failing (like creating a resource that requires server-side validation), it is better to show a loading state and wait for confirmation.

## Exercise

1. Modify the existing upvote-button.tsx to be fully optimistic: update the count immediately before the API responds, and add rollback logic for failures.
2. Simulate a failure by temporarily modifying the `upvoteStartup` function to throw an error. Verify that the count rolls back correctly.
3. Add a visual indicator (like reduced opacity or a spinner) while the API request is in flight, even though the count has already updated optimistically.
4. Build a simple toggle component (like a bookmark or favorite button) that uses the optimistic pattern with a boolean state instead of a counter.
5. Experiment with `useOptimistic` from React. Refactor the upvote button to use it and compare the code with the manual useState approach.
6. Think about what would happen if the user upvotes, immediately navigates to another page, and then comes back. Would the upvote count be correct? What role does `revalidateStartup` play here?

## Summary

Optimistic updates make applications feel fast by updating the UI before the server confirms the action. The pattern has three steps: save the current state for rollback, update the UI immediately, and either reconcile with the server response on success or restore the saved state on failure.

Our upvote-button.tsx demonstrates this pattern in a contained way, with state for the count, the loading indicator, and the voted flag. After the API call succeeds, a server action call to `revalidateStartup` invalidates the Next.js server cache so that subsequent page loads reflect the new count.

The two-cache problem in Next.js (client state vs server cache) means you need to think about both sides. Client state gives instant feedback. Server cache revalidation ensures consistency across page loads and users. The combination of optimistic client updates with background server revalidation gives users the best of both worlds: instant responsiveness and eventual consistency.
