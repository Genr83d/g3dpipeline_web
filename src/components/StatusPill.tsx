import type { JobStatus } from '../types';

const styles: Record<JobStatus, { label: string; cls: string }> = {
  pending: {
    label: 'Pending',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  started: {
    label: 'In progress',
    cls: 'bg-primary-soft text-primary dark:bg-indigo-950 dark:text-indigo-300',
  },
  completed: {
    label: 'Completed',
    cls: 'bg-secondary-soft text-secondary dark:bg-emerald-950 dark:text-emerald-300',
  },
};

export function StatusPill({ status, overdue = false }: { status: JobStatus; overdue?: boolean }) {
  if (overdue) {
    return (
      <span className="inline-flex items-center rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger hc:border hc:border-current dark:bg-red-950 dark:text-red-300">
        Overdue
      </span>
    );
  }
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold hc:border hc:border-current ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
