import { useMemo } from 'react';
import { useJobsOutlet } from '../routes/Workspace';
import { useAuth } from '../context/AuthProvider';
import { useInventory } from '../hooks/useInventory';
import { isLowStock, stockRatio } from '../services/inventoryService';
import { StatCard } from '../components/StatCard';
import { JobProgressGauge } from '../components/JobProgressGauge';
import { PageHeader } from '../components/PageHeader';
import { Skeleton, StatCardSkeleton } from '../components/Skeleton';
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
    <div className="space-y-6">
      <PageHeader
        title="Summary"
        eyebrow="Operations overview"
        subtitle="A live look at the whole shop."
      />

      {loading ? (
        <>
          <div className="surface p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-12 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="w-full flex-1 space-y-3">
                <Skeleton className="h-4 w-full" />
                <div className="grid gap-2 sm:grid-cols-3">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        </>
      ) : (
        <>
          <div className="surface p-6">
            <JobProgressGauge
              pending={stats.pending}
              started={stats.started}
              completed={stats.completed}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

          {inventoryLoading ? (
            <section aria-label="Loading low stock materials" className="surface p-4">
              <Skeleton className="mb-4 h-5 w-44" />
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            </section>
          ) : lowStock.length > 0 && (
            <section aria-labelledby="low-stock-heading" className="surface p-4">
              <h2
                id="low-stock-heading"
                className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-danger dark:text-red-400"
              >
                <IconAlert className="h-5 w-5" /> Low stock materials
              </h2>
              <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
                {lowStock.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {formatQuantity(m.quantity)} of {formatQuantity(m.totalQuantity)} {m.unit}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-md border border-danger/40 bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger hc:border-current dark:border-red-400/40 dark:bg-red-950/80 dark:text-red-300">
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
