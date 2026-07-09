import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconBack } from '../../components/icons';

export function SettingsShell({ title, subtitle, children, wide = false }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`mx-auto space-y-6 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
      <div>
        <Link to="/" className="btn-ghost mb-3 px-3 py-2">
          <IconBack className="h-4 w-4" /> Back to jobs
        </Link>
        <p className="technical-label mb-1">Settings</p>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl dark:text-slate-50">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
