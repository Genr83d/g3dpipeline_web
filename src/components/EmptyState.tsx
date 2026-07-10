import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  tone = 'default',
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  tone?: 'default' | 'danger';
}) {
  const danger = tone === 'danger';
  return (
    <div
      className={`surface flex flex-col items-center justify-center gap-2 px-5 py-14 text-center ${
        danger ? 'border-danger/50 dark:border-red-400/40' : ''
      }`}
      role={danger ? 'alert' : undefined}
    >
      <div className={`mb-2 flex h-14 w-14 items-center justify-center rounded-lg border shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] ${
        danger
          ? 'border-danger/30 bg-danger-soft/80 text-danger dark:border-red-400/30 dark:bg-red-950/70 dark:text-red-300'
          : 'border-primary/15 bg-primary-soft/80 text-primary dark:border-indigo-300/15 dark:bg-indigo-950/70 dark:text-indigo-300'
      }`}>
        {icon}
      </div>
      <p className="font-display text-lg font-bold">{title}</p>
      {subtitle && <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
