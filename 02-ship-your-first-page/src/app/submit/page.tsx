import type { Metadata } from "next";
import { getCategories } from "@/lib/api";
import StartupForm from "@/components/StartupForm";

export const metadata: Metadata = {
  title: "Submit a Startup | LaunchPad",
  description: "Submit your startup to be featured on LaunchPad.",
};

export default function SubmitPage() {
  const categories = getCategories();

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Submit Your Startup
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Share your startup with the LaunchPad community. Fill in the details
            below and we will review your submission.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-950">
          <StartupForm categories={categories} />
        </div>
      </div>
    </div>
  );
}
