import { useMemo } from 'react';
import { useJobsOutlet } from '../routes/Workspace';
import { StatCard } from '../components/StatCard';
import { Skeleton } from '../components/Skeleton';
import { isOverdue } from '../types';
import { IconAlert, IconBox, IconCheck, IconClock, IconPlay } from '../components/icons';

export default function Summary() {
  const { jobs, loading } = useJobsOutlet();

  const stats = useMemo(() => {
    const pending = jobs.filter((j) => j.status === 'pending').length;
    const started = jobs.filter((j) => j.status === 'started').length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const pipelineQty = jobs
      .filter((j) => j.status !== 'completed')
      .reduce((sum, j) => sum + j.quantity, 0);
    const overdue = jobs.filter((j) => isOverdue(j)).length;
    const total = jobs.length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { pending, started, completed, pipelineQty, overdue, completionRate };
  }, [jobs]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Summary</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">A live look at the whole shop.</p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
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
          <StatCard label="Completion rate" value={`${stats.completionRate}%`} tone="success" icon={<IconCheck className="h-5 w-5" />} />
        </div>
      )}
    </div>
  );
}
