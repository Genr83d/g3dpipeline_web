import { useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useJobs, type JobsState } from '../hooks/useJobs';
import { useInventory, type InventoryState } from '../hooks/useInventory';
import { useMachines, type MachinesState } from '../hooks/useMachines';
import { useAuth } from '../context/AuthProvider';
import { useAppearance } from '../context/AppearanceProvider';
import { AccountMenu } from '../components/AccountMenu';
import { BrandMark } from '../components/BrandMark';

const tabs = [
  { to: '/', label: 'Jobs', end: true },
  { to: '/inventory', label: 'Inventory', end: false },
  { to: '/maintenance', label: 'Maintenance', end: false },
  { to: '/summary', label: 'Summary', end: false },
  { to: '/archive', label: 'Archive', end: false },
];

const awfTabs = tabs.filter(
  (tab) => tab.to === '/' || tab.to === '/summary' || tab.to === '/archive',
);

export interface WorkspaceOutletState {
  jobs: JobsState;
  inventory: InventoryState;
  machines: MachinesState;
}

/** Signed-in shell and the single owner of all role-dependent data streams. */
export function Workspace() {
  const { isActive, profile } = useAuth();
  const { motionReduced } = useAppearance();
  const navigate = useNavigate();
  const role = profile?.role ?? 'staff';
  const roleKey = profile ? `${profile.uid}:${profile.role}` : 'inactive';
  const isAwf = role === 'awf';
  const nonAwfEnabled = isActive && !isAwf;
  const jobsState = useJobs(isActive, role, roleKey);
  const inventoryState = useInventory(nonAwfEnabled, roleKey);
  const machinesState = useMachines(nonAwfEnabled, roleKey);
  const visibleTabs = isAwf ? awfTabs : tabs;

  // A keyed Workspace remounts for every live role change. On an AWF mount,
  // select Jobs once; subsequent AWF navigation to Summary/Archive is allowed.
  useEffect(() => {
    if (isActive && isAwf) navigate('/', { replace: true });
  }, [isActive, isAwf, navigate, roleKey]);

  const outletState: WorkspaceOutletState = {
    jobs: jobsState,
    inventory: inventoryState,
    machines: machinesState,
  };

  return (
    <div className="relative min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-white/40 bg-white/68 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/72">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:flex-nowrap sm:gap-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            aria-label="GENR8 Pipeline home"
            className="group flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950"
          >
            <span className="surface flex h-10 w-10 items-center justify-center p-1.5 transition-transform group-hover:-translate-y-0.5">
              <BrandMark className="h-full w-full" alt="" />
            </span>
            <span className="hidden sm:block">
              <span className="block font-display text-lg font-bold leading-5">GENR8 Pipeline</span>
              <span className="technical-label text-[0.64rem]">Production control</span>
            </span>
          </Link>
          <nav
            className="order-last flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-slate-200/70 bg-white/45 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/55 sm:order-none sm:w-auto"
            aria-label="Workspace tabs"
          >
            {visibleTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className="relative shrink-0 rounded-md px-2.5 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none sm:px-4"
              >
                {({ isActive: active }) => (
                  <>
                    {active && (
                      <motion.span
                        layoutId={motionReduced ? undefined : 'tab-pill'}
                        className="absolute inset-0 rounded-md border border-white/70 bg-white/85 shadow-sm dark:border-white/10 dark:bg-slate-800"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className={`relative ${active ? 'font-bold text-primary dark:text-indigo-300' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}>
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
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet context={outletState} />
      </main>
    </div>
  );
}

export function useJobsOutlet(): JobsState {
  return useOutletContext<WorkspaceOutletState>().jobs;
}

export function useInventoryOutlet(): InventoryState {
  return useOutletContext<WorkspaceOutletState>().inventory;
}

export function useMachinesOutlet(): MachinesState {
  return useOutletContext<WorkspaceOutletState>().machines;
}
