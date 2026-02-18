import { StartupFormData, FormErrors } from "@/types";

export function validateStartupForm(data: StartupFormData): FormErrors {
  const errors: FormErrors = {};

  // Name validation
  if (!data.name.trim()) {
    errors.name = "Name is required";
  } else if (data.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  } else if (data.name.trim().length > 100) {
    errors.name = "Name must be less than 100 characters";
  }

  // Tagline validation
  if (!data.tagline.trim()) {
    errors.tagline = "Tagline is required";
  } else if (data.tagline.trim().length < 10) {
    errors.tagline = "Tagline must be at least 10 characters";
  } else if (data.tagline.trim().length > 200) {
    errors.tagline = "Tagline must be less than 200 characters";
  }

  // Description validation
  if (!data.description.trim()) {
    errors.description = "Description is required";
  } else if (data.description.trim().length < 50) {
    errors.description = "Description must be at least 50 characters";
  } else if (data.description.trim().length > 1000) {
    errors.description = "Description must be less than 1000 characters";
  }

  // URL validation
  if (!data.url.trim()) {
    errors.url = "URL is required";
  } else {
    try {
      new URL(data.url);
    } catch {
      errors.url = "Please enter a valid URL (e.g., https://example.com)";
    }
  }

  // Category validation
  if (!data.category) {
    errors.category = "Please select a category";
  }

  return errors;
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}
