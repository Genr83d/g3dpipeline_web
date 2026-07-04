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
    <div className={`mx-auto space-y-5 ${wide ? 'max-w-4xl' : 'max-w-xl'}`}>
      <div>
        <Link to="/" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline dark:text-indigo-300">
          <IconBack className="h-4 w-4" /> Back to jobs
        </Link>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
