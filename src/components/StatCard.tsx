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
    <div className="surface surface-hover flex items-center gap-4 p-4">
      {icon && (
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:border-slate-800 dark:bg-slate-950/35 ${toneCls}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="technical-label truncate">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
      </div>
    </div>
  );
}
