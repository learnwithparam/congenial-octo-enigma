import Link from 'next/link';

const footerLinks = [
  { href: '/startups', label: 'Startups' },
  { href: '/categories', label: 'Categories' },
  { href: '/startups/new', label: 'Submit' },
];

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-500">
              <span className="text-xs font-bold text-white">L</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              LaunchPad
            </span>
          </div>

          <div className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-primary-400"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="text-sm text-gray-400 dark:text-gray-500">
            &copy; 2025 LaunchPad. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
