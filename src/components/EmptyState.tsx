import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center gap-2 px-5 py-14 text-center">
      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg border border-primary/15 bg-primary-soft/80 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:border-indigo-300/15 dark:bg-indigo-950/70 dark:text-indigo-300">
        {icon}
      </div>
      <p className="font-display text-lg font-bold">{title}</p>
      {subtitle && <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
