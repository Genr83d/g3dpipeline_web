/** The one error banner every form shares. `role="alert"` so it is announced,
 *  and an `id` so the field at fault can point at it with aria-describedby. */
export function FormError({ id, message }: { id?: string; message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded border border-danger/25 bg-danger-soft/70 px-3 py-2 text-sm font-medium text-danger dark:border-red-400/25 dark:bg-red-950/40 dark:text-red-300"
    >
      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="min-w-0">{message}</span>
    </p>
  );
}
