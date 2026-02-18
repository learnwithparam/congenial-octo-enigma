# Forms and Validation

Forms are the backbone of any interactive web application. So far our LaunchPad app lets users browse and search startups, but there is no way to submit a new one. In this lesson you will build a startup submission form from scratch, implement client-side validation with clear error messages, and handle the submission flow including success and error feedback.

## What You Will Learn

- The difference between controlled and uncontrolled form components
- Building a multi-field form with TypeScript
- Implementing client-side validation (required fields, URL format, length limits)
- Displaying inline error messages next to each field
- Handling form submission and showing toast notifications
- Using React 19's `useActionState` for form state management

## Concepts

### Controlled vs Uncontrolled Components

In React, a controlled component has its value managed by React state. You provide a `value` prop and update it via `onChange`. This gives you full control over every keystroke.

An uncontrolled component manages its own internal state. You read the value when you need it (like on submit) using a `ref` or `FormData`. This is closer to how native HTML forms work.

For our submission form, we will use a hybrid approach. We will use a controlled state object for validation purposes but also demonstrate how `FormData` can simplify form reading.

### Validation Strategy

Client-side validation provides instant feedback. Server-side validation is the real guard. Since we are working with mock data in this course, we will focus on client-side validation. When you connect to a real API in a later course, you will add server-side validation too.

Our validation rules:
- Name: required, 2-100 characters
- Tagline: required, 10-200 characters
- Description: required, 50-1000 characters
- URL: required, must be a valid URL
- Category: required, must be selected from the list

### Toast Notifications

A toast is a brief message that appears and then disappears. It is a common pattern for confirming actions without blocking the user. We will build a simple toast system from scratch.

## Step by Step

### Step 1: Create the Toast Component

Before the form, let us build the toast notification component we will use for feedback.

```tsx
// src/components/Toast.tsx
'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div
        className={
          'flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ' +
          (type === 'success' ? 'bg-green-600' : 'bg-red-600')
        }
      >
        {type === 'success' ? (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {message}
        <button onClick={onClose} className="ml-2 hover:opacity-80">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

For the slide-up animation, add this to your global CSS file (`src/app/globals.css`):

```css
@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
```

### Step 2: Define Form Types

Add a type for the form data and validation errors. You can put these in `src/types/index.ts` alongside your existing types.

```ts
// Add to src/types/index.ts

export interface StartupFormData {
  name: string;
  tagline: string;
  description: string;
  url: string;
  category: string;
}

export interface FormErrors {
  name?: string;
  tagline?: string;
  description?: string;
  url?: string;
  category?: string;
}
```

### Step 3: Build the Validation Logic

Create a validation utility. Keeping validation in its own file makes it reusable and testable.

```ts
// src/lib/validation.ts
import { StartupFormData, FormErrors } from '@/types';

export function validateStartupForm(data: StartupFormData): FormErrors {
  const errors: FormErrors = {};

  // Name validation
  if (!data.name.trim()) {
    errors.name = 'Name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else if (data.name.trim().length > 100) {
    errors.name = 'Name must be less than 100 characters';
  }

  // Tagline validation
  if (!data.tagline.trim()) {
    errors.tagline = 'Tagline is required';
  } else if (data.tagline.trim().length < 10) {
    errors.tagline = 'Tagline must be at least 10 characters';
  } else if (data.tagline.trim().length > 200) {
    errors.tagline = 'Tagline must be less than 200 characters';
  }

  // Description validation
  if (!data.description.trim()) {
    errors.description = 'Description is required';
  } else if (data.description.trim().length < 50) {
    errors.description = 'Description must be at least 50 characters';
  } else if (data.description.trim().length > 1000) {
    errors.description = 'Description must be less than 1000 characters';
  }

  // URL validation
  if (!data.url.trim()) {
    errors.url = 'URL is required';
  } else {
    try {
      new URL(data.url);
    } catch {
      errors.url = 'Please enter a valid URL (e.g., https://example.com)';
    }
  }

  // Category validation
  if (!data.category) {
    errors.category = 'Please select a category';
  }

  return errors;
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}
```

The URL validation uses the built-in `URL` constructor. If the string is not a valid URL, it throws an error. This is a clean way to validate URLs without regex.

### Step 4: Build the StartupForm Component

This is the main form component. It manages the form state, runs validation, and handles submission.

```tsx
// src/components/StartupForm.tsx
'use client';

import { useState, useCallback } from 'react';
import { Category, StartupFormData, FormErrors } from '@/types';
import { validateStartupForm, hasErrors } from '@/lib/validation';
import Toast from '@/components/Toast';

interface StartupFormProps {
  categories: Category[];
}

const initialFormData: StartupFormData = {
  name: '',
  tagline: '',
  description: '',
  url: '',
  category: '',
};

export default function StartupForm({ categories }: StartupFormProps) {
  const [formData, setFormData] = useState<StartupFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const handleChange = useCallback(
    (field: keyof StartupFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Clear the error for this field when the user starts typing
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  const handleBlur = useCallback(
    (field: keyof StartupFormData) => {
      setTouched((prev) => new Set(prev).add(field));

      // Validate just this field on blur
      const allErrors = validateStartupForm(formData);
      if (allErrors[field]) {
        setErrors((prev) => ({ ...prev, [field]: allErrors[field] }));
      }
    },
    [formData]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const validationErrors = validateStartupForm(formData);
    setErrors(validationErrors);

    // Mark all fields as touched
    setTouched(
      new Set(['name', 'tagline', 'description', 'url', 'category'])
    );

    if (hasErrors(validationErrors)) {
      setToast({
        message: 'Please fix the errors in the form.',
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate an API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // For now, just log the data
      console.log('Submitted startup:', formData);

      setToast({
        message: 'Startup submitted successfully! It will be reviewed shortly.',
        type: 'success',
      });

      // Reset the form
      setFormData(initialFormData);
      setTouched(new Set());
      setErrors({});
    } catch {
      setToast({
        message: 'Something went wrong. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Startup Name
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            className={
              'mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ' +
              (errors.name && touched.has('name')
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500')
            }
            placeholder="e.g., LaunchPad"
          />
          {errors.name && touched.has('name') && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {formData.name.length}/100 characters
          </p>
        </div>

        {/* Tagline Field */}
        <div>
          <label htmlFor="tagline" className="block text-sm font-medium text-gray-700">
            Tagline
          </label>
          <input
            id="tagline"
            type="text"
            value={formData.tagline}
            onChange={(e) => handleChange('tagline', e.target.value)}
            onBlur={() => handleBlur('tagline')}
            className={
              'mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ' +
              (errors.tagline && touched.has('tagline')
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500')
            }
            placeholder="A short catchy description of your startup"
          />
          {errors.tagline && touched.has('tagline') && (
            <p className="mt-1 text-sm text-red-600">{errors.tagline}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {formData.tagline.length}/200 characters
          </p>
        </div>

        {/* Description Field */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            onBlur={() => handleBlur('description')}
            rows={5}
            className={
              'mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ' +
              (errors.description && touched.has('description')
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500')
            }
            placeholder="Tell us about your startup. What problem does it solve? Who is it for?"
          />
          {errors.description && touched.has('description') && (
            <p className="mt-1 text-sm text-red-600">{errors.description}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {formData.description.length}/1000 characters
          </p>
        </div>

        {/* URL Field */}
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700">
            Website URL
          </label>
          <input
            id="url"
            type="url"
            value={formData.url}
            onChange={(e) => handleChange('url', e.target.value)}
            onBlur={() => handleBlur('url')}
            className={
              'mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ' +
              (errors.url && touched.has('url')
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500')
            }
            placeholder="https://yourstartup.com"
          />
          {errors.url && touched.has('url') && (
            <p className="mt-1 text-sm text-red-600">{errors.url}</p>
          )}
        </div>

        {/* Category Dropdown */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => handleChange('category', e.target.value)}
            onBlur={() => handleBlur('category')}
            className={
              'mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ' +
              (errors.category && touched.has('category')
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500')
            }
          >
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
          {errors.category && touched.has('category') && (
            <p className="mt-1 text-sm text-red-600">{errors.category}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={
            'w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors ' +
            (isSubmitting
              ? 'cursor-not-allowed bg-indigo-400'
              : 'bg-indigo-600 hover:bg-indigo-700')
          }
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Submitting...
            </span>
          ) : (
            'Submit Startup'
          )}
        </button>
      </form>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
```

This is a large component, so let us review the key decisions:

The "touched" pattern: We track which fields the user has interacted with using a `Set`. Errors only display for touched fields, so the user does not see a wall of red when they first load the page. On submit, we mark all fields as touched.

Validation on blur: When a user tabs away from a field, we validate just that field and show an error if needed. This gives immediate feedback without being aggressive.

Clearing errors on change: When the user starts fixing a field, we clear its error immediately. This avoids the frustrating experience of an error persisting while you are actively correcting it.

Character counts: Each text field shows a live character count. This helps users stay within limits.

The `noValidate` attribute: We add `noValidate` to the form to disable the browser's built-in validation tooltips. We want full control over the validation UI.

### Step 5: Create the Submit Page

Create the page that wraps the form.

```tsx
// src/app/submit/page.tsx
import { getCategories } from '@/lib/api';
import StartupForm from '@/components/StartupForm';

export const metadata = {
  title: 'Submit a Startup | LaunchPad',
  description: 'Submit your startup to be featured on LaunchPad.',
};

export default async function SubmitPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Submit Your Startup</h1>
        <p className="mt-2 text-gray-600">
          Share your startup with the LaunchPad community. Fill in the details
          below and we will review your submission.
        </p>
      </div>
      <StartupForm categories={categories} />
    </div>
  );
}
```

This is a server component. It fetches the categories on the server and passes them to the client component.

### Step 6: Add a Link to the Submit Page

Update your Navbar to include a link to the submit page. In your `src/components/Navbar.tsx`, add a "Submit" link alongside the other navigation items.

```tsx
// Add this link inside your Navbar's navigation section
<a
  href="/submit"
  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
>
  Submit Startup
</a>
```

Style it as a primary button to make it stand out from the regular nav links.

### Step 7: Test the Form

Start your dev server and navigate to `/submit`.

```bash
npm run dev
```

Test these scenarios:

1. Try submitting the empty form. All fields should show errors and a toast should appear saying "Please fix the errors in the form."
2. Fill in just the name with a single character and tab to the next field. The name error should say "Name must be at least 2 characters."
3. Enter an invalid URL like "not a url" and tab away. The URL error should appear.
4. Fill in all fields correctly and submit. You should see the loading spinner, then a success toast, and the form should reset.
5. Check the browser console to see the logged form data.

### Step 8: Alternative Approach with useActionState (React 19)

React 19 introduces `useActionState` for handling form actions. Here is what the same form could look like using this newer pattern:

```tsx
// Alternative approach — for reference
'use client';

import { useActionState } from 'react';
import { StartupFormData, FormErrors } from '@/types';
import { validateStartupForm, hasErrors } from '@/lib/validation';

interface FormState {
  errors: FormErrors;
  success: boolean;
  message: string;
}

async function submitStartupAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const data: StartupFormData = {
    name: formData.get('name') as string,
    tagline: formData.get('tagline') as string,
    description: formData.get('description') as string,
    url: formData.get('url') as string,
    category: formData.get('category') as string,
  };

  const errors = validateStartupForm(data);

  if (hasErrors(errors)) {
    return { errors, success: false, message: 'Please fix the errors.' };
  }

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return { errors: {}, success: true, message: 'Startup submitted!' };
}

export default function StartupFormWithAction() {
  const [state, formAction, isPending] = useActionState(submitStartupAction, {
    errors: {},
    success: false,
    message: '',
  });

  return (
    <form action={formAction}>
      <input name="name" type="text" />
      {state.errors.name && <p className="text-red-600">{state.errors.name}</p>}
      {/* ... other fields ... */}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

The `useActionState` approach is appealing because it works with both client-side and server-side form processing. The form action receives `FormData` natively, and `isPending` gives you loading state for free. We used the traditional `useState` approach in our main implementation because it gives more granular control over the UX (touched states, per-field validation on blur, clearing errors on change). Both approaches are valid.

## Try It Yourself

1. Add a "preview" section below the form that shows a live preview of the `StartupCard` as the user fills in the form. This helps them see what their submission will look like.

2. Add a "description" field that supports basic markdown. Show a "preview" tab that renders the markdown as HTML.

3. Implement a maximum of 3 submission attempts. After 3 failures, show a message asking the user to try again later.

## Key Takeaways

- Controlled components give you full control over form values, enabling real-time validation and character counts.
- Validate on blur for immediate feedback and on submit for a final check.
- Track "touched" fields so users only see errors for fields they have interacted with.
- Use the native `URL` constructor for URL validation instead of complex regex patterns.
- Show loading states during submission and disable the button to prevent double submits.
- Toast notifications provide non-blocking feedback for success and error states.
- React 19's `useActionState` offers an alternative pattern that works well for server-side form processing.

## Next Steps

The form works, but what happens when things go wrong? What if the data takes a while to load? In the next lesson, you will learn how to handle loading states with skeleton screens and error states with error boundaries, making your app feel polished and resilient.
