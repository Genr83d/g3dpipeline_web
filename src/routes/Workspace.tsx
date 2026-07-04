import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useJobs, type JobsState } from '../hooks/useJobs';
import { useAuth } from '../context/AuthProvider';
import { useAppearance } from '../context/AppearanceProvider';
import { AccountMenu } from '../components/AccountMenu';

const tabs = [
  { to: '/', label: 'Jobs', end: true },
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-display text-sm font-black text-white">
              G8
            </div>
            <span className="hidden font-display text-lg font-bold sm:block">GENR8 Pipeline</span>
          </div>
          <nav className="flex items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800" aria-label="Workspace tabs">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className="relative rounded-full px-4 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                {({ isActive: active }) => (
                  <>
                    {active && (
                      <motion.span
                        layoutId={motionReduced ? undefined : 'tab-pill'}
                        className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-slate-700"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className={`relative ${active ? 'text-primary dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>
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
