import { Link, NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useJobs, type JobsState } from '../hooks/useJobs';
import { useAuth } from '../context/AuthProvider';
import { useAppearance } from '../context/AppearanceProvider';
import { AccountMenu } from '../components/AccountMenu';
import { BrandMark } from '../components/BrandMark';

const tabs = [
  { to: '/', label: 'Jobs', end: true },
  { to: '/inventory', label: 'Inventory', end: false },
  { to: '/summary', label: 'Summary', end: false },
  { to: '/archive', label: 'Archive', end: false },
];

/** Signed-in shell: app bar, tab nav, and the shared live jobs stream. */
export function Workspace() {
  const { isActive } = useAuth();
  const { motionReduced } = useAppearance();
  const jobsState = useJobs(isActive);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4">
          <Link
            to="/"
            aria-label="GENR8 Pipeline home"
            className="flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <BrandMark className="h-9 w-9" alt="" />
            <span className="hidden font-display text-lg font-bold tracking-tight sm:block">GENR8 Pipeline</span>
          </Link>
          <nav className="flex items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800" aria-label="Workspace tabs">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className="relative rounded-full px-2.5 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none sm:px-4">
                {({ isActive: active }) => (
                  <>
                    {active && (
                      <motion.span
                        layoutId={motionReduced ? undefined : 'tab-pill'}
                        className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-slate-700"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className={`relative ${active ? 'font-bold text-primary dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>
                      {tab.label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <AccountMenu />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet context={jobsState} />
      </main>
    </div>
  );
}

export function useJobsOutlet(): JobsState {
  return useOutletContext<JobsState>();
}
