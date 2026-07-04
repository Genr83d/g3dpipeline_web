import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'primary' | 'success' | 'danger';
}) {
  const toneCls = {
    default: 'text-ink dark:text-slate-100',
    primary: 'text-primary dark:text-indigo-300',
    success: 'text-secondary dark:text-emerald-300',
    danger: 'text-danger dark:text-red-300',
  }[tone];
  return (
    <div className="surface flex items-center gap-4 p-4">
      {icon && (
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 ${toneCls}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
      </div>
    </div>
  );
}
