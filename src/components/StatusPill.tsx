import type { JobStatus } from '../types';

/** Pending → primary, In Progress → amber/caution, Completed → success,
 *  per the Flutter status chip colors. Tinted background + matching border. */
const styles: Record<JobStatus, { label: string; cls: string }> = {
  pending: {
    label: 'PENDING',
    cls: 'border-primary/30 bg-primary-soft text-primary dark:border-indigo-400/30 dark:bg-indigo-950 dark:text-indigo-300',
  },
  started: {
    label: 'IN PROGRESS',
    cls: 'border-amber-500/40 bg-amber-100 text-amber-800 dark:border-amber-400/40 dark:bg-amber-950 dark:text-amber-300',
  },
  completed: {
    label: 'COMPLETED',
    cls: 'border-secondary/40 bg-secondary-soft text-secondary dark:border-emerald-400/40 dark:bg-emerald-950 dark:text-emerald-300',
  },
};

export function StatusPill({ status, overdue = false }: { status: JobStatus; overdue?: boolean }) {
  if (overdue) {
    return (
      <span className="inline-flex items-center rounded-md border border-danger/40 bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger hc:border-current dark:border-red-400/40 dark:bg-red-950/80 dark:text-red-300">
        OVERDUE
      </span>
    );
  }
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold hc:border-current ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
