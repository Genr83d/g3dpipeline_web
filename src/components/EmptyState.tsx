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
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary dark:bg-indigo-950 dark:text-indigo-300">
        {icon}
      </div>
      <p className="text-base font-semibold">{title}</p>
      {subtitle && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
