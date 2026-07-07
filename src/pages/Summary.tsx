import { useMemo } from 'react';
import { useJobsOutlet } from '../routes/Workspace';
import { useAuth } from '../context/AuthProvider';
import { useInventory } from '../hooks/useInventory';
import { isLowStock, stockRatio } from '../services/inventoryService';
import { StatCard } from '../components/StatCard';
import { CenteredSpinner } from '../components/Spinner';
import { JobProgressGauge } from '../components/JobProgressGauge';
import { formatQuantity } from '../lib/format';
import { isOverdue } from '../types';
import { IconAlert, IconBox, IconCheck, IconClock, IconPlay } from '../components/icons';

export default function Summary() {
  const { jobs, loading } = useJobsOutlet();
  const { isActive } = useAuth();
  const { materials, loading: inventoryLoading } = useInventory(isActive);

  const stats = useMemo(() => {
    const pending = jobs.filter((j) => j.status === 'pending').length;
    const started = jobs.filter((j) => j.status === 'started').length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const pipelineQty = jobs
      .filter((j) => j.status !== 'completed')
      .reduce((sum, j) => sum + j.quantity, 0);
    const overdue = jobs.filter((j) => isOverdue(j)).length;
    return { pending, started, completed, pipelineQty, overdue };
  }, [jobs]);

  /** Lowest stock percentage first. */
  const lowStock = useMemo(
    () => materials.filter(isLowStock).sort((a, b) => stockRatio(a) - stockRatio(b)),
    [materials],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Summary</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">A live look at the whole shop.</p>
      </div>

      {loading ? (
        <CenteredSpinner />
      ) : (
        <>
          <div className="surface p-6">
            <JobProgressGauge
              pending={stats.pending}
              started={stats.started}
              completed={stats.completed}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Pending" value={stats.pending} icon={<IconClock className="h-5 w-5" />} />
            <StatCard label="In progress" value={stats.started} tone="primary" icon={<IconPlay className="h-5 w-5" />} />
            <StatCard label="Completed" value={stats.completed} tone="success" icon={<IconCheck className="h-5 w-5" />} />
            <StatCard label="Units in pipeline" value={stats.pipelineQty} icon={<IconBox className="h-5 w-5" />} />
            <StatCard
              label="Overdue"
              value={stats.overdue}
              tone={stats.overdue > 0 ? 'danger' : 'default'}
              icon={<IconAlert className="h-5 w-5" />}
            />
          </div>

          {!inventoryLoading && lowStock.length > 0 && (
            <section aria-labelledby="low-stock-heading" className="surface p-4">
              <h2
                id="low-stock-heading"
                className="mb-3 flex items-center gap-2 font-display text-base font-bold text-danger dark:text-red-400"
              >
                <IconAlert className="h-5 w-5" /> Low stock materials
              </h2>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {lowStock.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {formatQuantity(m.quantity)} of {formatQuantity(m.totalQuantity)} {m.unit}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full border border-danger/40 bg-danger-soft px-2.5 py-0.5 text-xs font-bold text-danger hc:border-current dark:border-red-400/40 dark:bg-red-950 dark:text-red-300">
                      {Math.round(stockRatio(m) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
