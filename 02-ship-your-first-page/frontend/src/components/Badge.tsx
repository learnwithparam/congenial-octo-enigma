type BadgeProps = {
  children: React.ReactNode;
  variant?: "primary" | "gray";
};

export function Badge({ children, variant = "primary" }: BadgeProps) {
  const styles = {
    primary:
      "bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
