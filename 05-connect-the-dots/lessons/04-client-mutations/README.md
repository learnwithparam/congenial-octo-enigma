# Client Mutations: Forms and Data Submission

So far, we have focused on reading data. The frontend fetches startups and categories from the API and displays them. But a real application also writes data. Users need to submit new startups, edit their listings, and upvote their favorites. These write operations are called mutations.

In this lesson, you will build forms that submit data to our REST API, handle form state and validation in Client Components, and use Next.js revalidation to keep the cached data fresh after changes.

## What You Will Learn

- How to build forms in Client Components that submit to an API
- How to manage form state with useState and handle validation
- How to call your API layer functions for POST, PUT, and DELETE operations
- How revalidatePath and revalidateTag refresh cached Server Component data
- How to use Server Actions as an alternative to client-side form handling
- How to provide user feedback during and after form submission

## Concepts

### Mutations in a Next.js App

When a user submits a form, the data flows through several layers:

1. The user fills in the form (Client Component with state)
2. The form submits, calling an API function from `src/lib/api.ts`
3. Axios sends a POST/PUT/DELETE request to the Express API
4. The Express API updates the SQLite database
5. The response comes back to the client
6. We update the UI and revalidate any cached data

The critical piece is step 6. After creating a new startup, the startups listing page still has stale cached data from our Server Component fetches. We need to tell Next.js to refresh that cache.

### Server Actions

Next.js provides Server Actions as an alternative pattern for mutations. A Server Action is an async function that runs on the server, defined with the `"use server"` directive. You can call them from Client Components or even use them directly as form actions.

Server Actions are powerful because they can directly revalidate cached data (since they run on the server where the cache lives). We will use a combination of client-side form handling and Server Actions in this lesson.

## Step by Step

### Step 1: Create the Startup Form Component

Let us build a form for creating new startups. This is a Client Component because it needs state and event handlers:

```ts
// src/components/create-startup-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStartup } from '@/lib/api';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
}

export function CreateStartupForm({ categories }: Props) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    description: '',
    url: '',
    category_id: 0,
    logo_url: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.tagline.trim()) {
      newErrors.tagline = 'Tagline is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.url.trim()) {
      newErrors.url = 'URL is required';
    } else if (!formData.url.startsWith('http')) {
      newErrors.url = 'URL must start with http:// or https://';
    }

    if (!formData.category_id) {
      newErrors.category_id = 'Please select a category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'category_id' ? parseInt(value, 10) : value,
    }));
    // Clear the error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const startup = await createStartup({
        name: formData.name,
        tagline: formData.tagline,
        description: formData.description,
        url: formData.url,
        category_id: formData.category_id,
        logo_url: formData.logo_url || undefined,
      });

      // Redirect to the new startup page
      router.push('/startups/' + startup.id);
      router.refresh(); // Triggers revalidation of server-side data
    } catch (error) {
      setSubmitError(
        'Failed to create startup. Please check your input and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {submitError}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Startup Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={
            'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
            (errors.name ? 'border-red-500' : 'border-gray-300')
          }
          placeholder="Enter your startup name"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="tagline"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Tagline
        </label>
        <input
          type="text"
          id="tagline"
          name="tagline"
          value={formData.tagline}
          onChange={handleChange}
          className={
            'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
            (errors.tagline ? 'border-red-500' : 'border-gray-300')
          }
          placeholder="A short description of what you do"
        />
        {errors.tagline && (
          <p className="mt-1 text-sm text-red-600">{errors.tagline}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={5}
          className={
            'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
            (errors.description ? 'border-red-500' : 'border-gray-300')
          }
          placeholder="Tell us more about your startup"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="url"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Website URL
        </label>
        <input
          type="url"
          id="url"
          name="url"
          value={formData.url}
          onChange={handleChange}
          className={
            'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
            (errors.url ? 'border-red-500' : 'border-gray-300')
          }
          placeholder="https://yourstartup.com"
        />
        {errors.url && (
          <p className="mt-1 text-sm text-red-600">{errors.url}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="category_id"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Category
        </label>
        <select
          id="category_id"
          name="category_id"
          value={formData.category_id}
          onChange={handleChange}
          className={
            'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
            (errors.category_id ? 'border-red-500' : 'border-gray-300')
          }
        >
          <option value={0}>Select a category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        {errors.category_id && (
          <p className="mt-1 text-sm text-red-600">{errors.category_id}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="logo_url"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Logo URL (optional)
        </label>
        <input
          type="url"
          id="logo_url"
          name="logo_url"
          value={formData.logo_url}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="https://yourstartup.com/logo.png"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Launching...' : 'Launch Startup'}
      </button>
    </form>
  );
}
```

This is a substantial component, so let us walk through the key decisions.

State management: We use a single `formData` object for all fields rather than individual useState calls. This makes it easy to reset the form or populate it with existing data (for editing). A separate `errors` object tracks validation messages per field.

Validation: Client-side validation runs before submission. It catches obvious problems immediately without making an API call. The API should also validate (and it does, from Course 03), but client-side validation gives faster feedback.

Error clearing: When the user starts typing in a field that has an error, we clear that specific error. This responsive behavior makes the form feel alive and helpful.

Submit flow: We set `isSubmitting` to true, make the API call, and either redirect on success or show an error message on failure. The button text changes to "Launching..." to indicate progress.

### Step 2: Create the Submit Page

The form needs a page to live on. This page is a Server Component that fetches categories and passes them to the form:

```ts
// src/app/startups/new/page.tsx

import { getCategoriesServer } from '@/lib/api-server';
import { CreateStartupForm } from '@/components/create-startup-form';

export default async function NewStartupPage() {
  const categories = await getCategoriesServer();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Launch Your Startup</h1>
      <p className="text-gray-600 mb-8">
        Share your startup with the LaunchPad community
      </p>
      <CreateStartupForm categories={categories} />
    </main>
  );
}
```

This demonstrates the server/client component pattern beautifully. The Server Component fetches the categories list (which needs no interactivity), and the Client Component handles the interactive form. The categories arrive as a prop, already loaded, with no client-side fetch needed.

### Step 3: Revalidate Cached Data with Server Actions

When we create a new startup, the startups listing page still shows cached data. We need to tell Next.js to refresh. Create a Server Action for this:

```ts
// src/app/actions.ts
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

The `"use server"` directive marks this file as containing Server Actions. These functions run on the server and can be called from Client Components.

`revalidateTag('startups')` invalidates any fetch call that was tagged with `'startups'` (remember the tags we added in Lesson 03).

`revalidatePath('/startups')` invalidates the cached rendering of the startups page, forcing it to re-render with fresh data on the next visit.

### Step 4: Call Server Actions After Mutations

Update the form component to call the server action after a successful creation:

```ts
// In src/components/create-startup-form.tsx
// Add this import at the top:
import { revalidateStartups } from '@/app/actions';

// Update the handleSubmit function's try block:
try {
  const startup = await createStartup({
    name: formData.name,
    tagline: formData.tagline,
    description: formData.description,
    url: formData.url,
    category_id: formData.category_id,
    logo_url: formData.logo_url || undefined,
  });

  // Revalidate cached data
  await revalidateStartups();

  // Redirect to the new startup page
  router.push('/startups/' + startup.id);
} catch (error) {
  setSubmitError(
    'Failed to create startup. Please check your input and try again.'
  );
}
```

Now when a startup is created: the API writes it to the database, the server action invalidates the cache, and when the user navigates to the startups page, they see fresh data including their new startup.

### Step 5: Build an Edit Form

Editing a startup is similar to creating one, but the form starts populated with existing data. Let us create an edit component:

```ts
// src/components/edit-startup-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateStartup } from '@/lib/api';
import { revalidateStartups, revalidateStartup } from '@/app/actions';
import type { Startup, Category } from '@/types';

interface Props {
  startup: Startup;
  categories: Category[];
}

export function EditStartupForm({ startup, categories }: Props) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: startup.name,
    tagline: startup.tagline,
    description: startup.description,
    url: startup.url,
    category_id: startup.category_id,
    logo_url: startup.logo_url || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'category_id' ? parseInt(value, 10) : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await updateStartup(startup.id, {
        name: formData.name,
        tagline: formData.tagline,
        description: formData.description,
        url: formData.url,
        category_id: formData.category_id,
        logo_url: formData.logo_url || undefined,
      });

      await revalidateStartup(startup.id);
      await revalidateStartups();

      router.push('/startups/' + startup.id);
    } catch (error) {
      setSubmitError('Failed to update startup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {submitError}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Startup Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="tagline"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Tagline
        </label>
        <input
          type="text"
          id="tagline"
          name="tagline"
          value={formData.tagline}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={5}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="url"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Website URL
        </label>
        <input
          type="url"
          id="url"
          name="url"
          value={formData.url}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="category_id"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Category
        </label>
        <select
          id="category_id"
          name="category_id"
          value={formData.category_id}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

And the edit page:

```ts
// src/app/startups/[id]/edit/page.tsx

import { getStartupServer, getCategoriesServer } from '@/lib/api-server';
import { EditStartupForm } from '@/components/edit-startup-form';
import { notFound } from 'next/navigation';

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
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Edit {startup.name}</h1>
      <EditStartupForm startup={startup} categories={categories} />
    </main>
  );
}
```

### Step 6: Handle Delete Operations

Deleting a startup requires a confirmation step. Here is a delete button component:

```ts
// src/components/delete-startup-button.tsx
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
        <span className="text-sm text-red-600">
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
          className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsConfirming(true)}
      className="px-3 py-1 text-red-600 text-sm border border-red-200 rounded hover:bg-red-50"
    >
      Delete
    </button>
  );
}
```

The two-step confirmation (click once to reveal confirm/cancel, click again to actually delete) prevents accidental deletions without the jarring experience of a browser confirm dialog.

### Step 7: Server Actions as Form Actions (Alternative Pattern)

Next.js also supports using Server Actions directly as form actions. This approach works without JavaScript and is progressively enhanced:

```ts
// src/app/startups/new/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';

const API_BASE_URL = 'http://localhost:3001/api';

export async function createStartupAction(formData: FormData) {
  const body = {
    name: formData.get('name') as string,
    tagline: formData.get('tagline') as string,
    description: formData.get('description') as string,
    url: formData.get('url') as string,
    category_id: parseInt(formData.get('category_id') as string, 10),
    logo_url: (formData.get('logo_url') as string) || undefined,
  };

  const response = await fetch(API_BASE_URL + '/startups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'Failed to create startup');
  }

  const startup = await response.json();

  revalidateTag('startups');
  redirect('/startups/' + startup.id);
}
```

You can use this Server Action in a form:

```tsx
<form action={createStartupAction}>
  <input name="name" type="text" required />
  <input name="tagline" type="text" required />
  {/* ... other fields ... */}
  <button type="submit">Launch Startup</button>
</form>
```

The trade-off: Server Actions are simpler and work without JavaScript, but you lose fine-grained control over loading states, error display, and validation feedback. For LaunchPad, we use the Client Component approach for the richer user experience, but knowing both patterns is valuable.

### Step 8: Handling Validation Errors from the API

The API may return validation errors that your client-side validation did not catch. Here is how to handle them:

```ts
// Enhanced error handling in the form submit
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSubmitError(null);

  if (!validateForm()) {
    return;
  }

  setIsSubmitting(true);

  try {
    const startup = await createStartup({
      name: formData.name,
      tagline: formData.tagline,
      description: formData.description,
      url: formData.url,
      category_id: formData.category_id,
      logo_url: formData.logo_url || undefined,
    });

    await revalidateStartups();
    router.push('/startups/' + startup.id);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = error.response.data as Record<string, unknown>;

      if (status === 400 && data.errors) {
        // API returned field-level validation errors
        const apiErrors = data.errors as Record<string, string>;
        setErrors(apiErrors);
      } else if (status === 401) {
        setSubmitError('You must be logged in to create a startup.');
      } else {
        setSubmitError(
          (data.error as string) || 'Something went wrong. Please try again.'
        );
      }
    } else {
      setSubmitError('Network error. Please check your connection.');
    }
  } finally {
    setIsSubmitting(false);
  }
}
```

This enhanced error handling distinguishes between different types of failures: validation errors (which get mapped to specific fields), authentication errors (which get a specific message), other server errors, and network failures.

### Step 9: Add the Upvote Mutation

The upvote button is a lighter mutation that does not involve a full form:

```ts
// src/components/upvote-button.tsx
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

Notice that we fire `revalidateStartup` without awaiting it. The upvote count is already updated locally, so there is no need to block the UI while the cache invalidates in the background.

## Exercise

1. Build the CreateStartupForm component with full validation
2. Create the /startups/new page that passes categories to the form
3. Create the Server Actions file with revalidation functions
4. Build the EditStartupForm and the /startups/[id]/edit page
5. Build the DeleteStartupButton with two-step confirmation
6. Update the UpvoteButton to persist the vote and revalidate
7. Test the full flow: create a startup, verify it appears on the listing page, edit it, and delete it

## Key Takeaways

- Client Components handle form state, validation, and submission since they need hooks and event handlers
- Server Components fetch initial data (like categories) and pass it as props to Client Components
- Server Actions with revalidateTag and revalidatePath keep cached Server Component data fresh after mutations
- Call router.refresh() from Client Components to trigger revalidation after a mutation
- Client-side validation provides instant feedback; API validation is the safety net
- Two-step deletion (reveal then confirm) prevents accidental data loss
- Fire-and-forget revalidation (not awaiting the server action) is appropriate when the UI is already updated locally

## Summary

In this lesson, we built the full mutation flow for LaunchPad. Users can now create, edit, and delete startups through forms that submit to our REST API. We implemented client-side validation for instant feedback, handled API errors gracefully, and used Next.js Server Actions to keep our cached data in sync after every mutation.

The read and write sides of our application are now connected. Data flows from the database through the API to Server Components, and user input flows from Client Components through the API back to the database.

## What is Next

In the next lesson, we will add authentication. Users will be able to sign up, log in, and have their identity verified on protected routes. We will implement JWT token management with the jose library and protect both pages and API calls.
