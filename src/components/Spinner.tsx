/** Circular activity indicator in the app primary color — no fake percentages. */
export function Spinner({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-4 border-primary/25 border-t-primary dark:border-indigo-300/25 dark:border-t-indigo-300 ${className}`}
    />
  );
}

export function CenteredSpinner() {
  return (
    <div className="flex justify-center py-24">
      <Spinner />
    </div>
  );
}
