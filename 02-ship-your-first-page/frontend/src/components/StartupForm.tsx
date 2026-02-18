"use client";

import { useState, useCallback } from "react";
import { Category, StartupFormData, FormErrors } from "@/types";
import { validateStartupForm, hasErrors } from "@/lib/validation";
import Toast from "@/components/Toast";

interface StartupFormProps {
  categories: Category[];
}

const initialFormData: StartupFormData = {
  name: "",
  tagline: "",
  description: "",
  url: "",
  category: "",
};

export default function StartupForm({ categories }: StartupFormProps) {
  const [formData, setFormData] = useState<StartupFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
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
      new Set(["name", "tagline", "description", "url", "category"])
    );

    if (hasErrors(validationErrors)) {
      setToast({
        message: "Please fix the errors in the form.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate an API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // For now, just log the data
      console.log("Submitted startup:", formData);

      setToast({
        message:
          "Startup submitted successfully! It will be reviewed shortly.",
        type: "success",
      });

      // Reset the form
      setFormData(initialFormData);
      setTouched(new Set());
      setErrors({});
    } catch {
      setToast({
        message: "Something went wrong. Please try again.",
        type: "error",
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
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Startup Name
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            onBlur={() => handleBlur("name")}
            className={
              "mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 " +
              (errors.name && touched.has("name")
                ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:bg-gray-900 dark:text-gray-100"
                : "border-gray-300 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100")
            }
            placeholder="e.g., LaunchPad"
          />
          {errors.name && touched.has("name") && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.name}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            {formData.name.length}/100 characters
          </p>
        </div>

        {/* Tagline Field */}
        <div>
          <label
            htmlFor="tagline"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Tagline
          </label>
          <input
            id="tagline"
            type="text"
            value={formData.tagline}
            onChange={(e) => handleChange("tagline", e.target.value)}
            onBlur={() => handleBlur("tagline")}
            className={
              "mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 " +
              (errors.tagline && touched.has("tagline")
                ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:bg-gray-900 dark:text-gray-100"
                : "border-gray-300 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100")
            }
            placeholder="A short catchy description of your startup"
          />
          {errors.tagline && touched.has("tagline") && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.tagline}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            {formData.tagline.length}/200 characters
          </p>
        </div>

        {/* Description Field */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            onBlur={() => handleBlur("description")}
            rows={5}
            className={
              "mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 " +
              (errors.description && touched.has("description")
                ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:bg-gray-900 dark:text-gray-100"
                : "border-gray-300 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100")
            }
            placeholder="Tell us about your startup. What problem does it solve? Who is it for?"
          />
          {errors.description && touched.has("description") && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.description}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            {formData.description.length}/1000 characters
          </p>
        </div>

        {/* URL Field */}
        <div>
          <label
            htmlFor="url"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Website URL
          </label>
          <input
            id="url"
            type="url"
            value={formData.url}
            onChange={(e) => handleChange("url", e.target.value)}
            onBlur={() => handleBlur("url")}
            className={
              "mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 " +
              (errors.url && touched.has("url")
                ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:bg-gray-900 dark:text-gray-100"
                : "border-gray-300 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100")
            }
            placeholder="https://yourstartup.com"
          />
          {errors.url && touched.has("url") && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.url}
            </p>
          )}
        </div>

        {/* Category Dropdown */}
        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Category
          </label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => handleChange("category", e.target.value)}
            onBlur={() => handleBlur("category")}
            className={
              "mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 " +
              (errors.category && touched.has("category")
                ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:bg-gray-900 dark:text-gray-100"
                : "border-gray-300 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100")
            }
          >
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
          {errors.category && touched.has("category") && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.category}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={
            "w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all active:scale-[0.98] " +
            (isSubmitting
              ? "cursor-not-allowed bg-primary-400"
              : "bg-primary-600 hover:bg-primary-700")
          }
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
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
            "Submit Startup"
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
