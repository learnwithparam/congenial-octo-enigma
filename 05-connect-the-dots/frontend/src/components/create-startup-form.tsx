'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { createStartup } from '@/lib/api';
import { revalidateStartups } from '@/app/actions';
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

      // Revalidate cached data
      await revalidateStartups();

      // Redirect to the new startup page
      router.push('/startups/' + startup.id);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const data = error.response.data as Record<string, unknown>;

        if (status === 400 && data.errors) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {submitError}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
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
            'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-900 dark:text-gray-100 ' +
            (errors.name
              ? 'border-red-500'
              : 'border-gray-300 dark:border-gray-700')
          }
          placeholder="Enter your startup name"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="tagline"
          className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
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
            'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-900 dark:text-gray-100 ' +
            (errors.tagline
              ? 'border-red-500'
              : 'border-gray-300 dark:border-gray-700')
          }
          placeholder="A short description of what you do"
        />
        {errors.tagline && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.tagline}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
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
            'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-900 dark:text-gray-100 ' +
            (errors.description
              ? 'border-red-500'
              : 'border-gray-300 dark:border-gray-700')
          }
          placeholder="Tell us more about your startup"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.description}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="url"
          className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
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
            'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-900 dark:text-gray-100 ' +
            (errors.url
              ? 'border-red-500'
              : 'border-gray-300 dark:border-gray-700')
          }
          placeholder="https://yourstartup.com"
        />
        {errors.url && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.url}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="category_id"
          className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
        >
          Category
        </label>
        <select
          id="category_id"
          name="category_id"
          value={formData.category_id}
          onChange={handleChange}
          className={
            'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-900 dark:text-gray-100 ' +
            (errors.category_id
              ? 'border-red-500'
              : 'border-gray-300 dark:border-gray-700')
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
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.category_id}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="logo_url"
          className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
        >
          Logo URL (optional)
        </label>
        <input
          type="url"
          id="logo_url"
          name="logo_url"
          value={formData.logo_url}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
          placeholder="https://yourstartup.com/logo.png"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Launching...' : 'Launch Startup'}
      </button>
    </form>
  );
}
