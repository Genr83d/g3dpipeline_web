import { useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useJobsOutlet } from '../routes/Workspace';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../components/Toast';
import { JobCard } from '../components/JobCard';
import { EmptyState } from '../components/EmptyState';
import { JobCardSkeleton } from '../components/Skeleton';
import { IconCheck } from '../components/icons';
import { errorMessage } from '../lib/format';
import { restoreJob } from '../services/jobService';

export default function Archive() {
  const { jobs, loading } = useJobsOutlet();
  const { actor } = useAuth();
  const { toast } = useToast();

  const archived = useMemo(
    () =>
      jobs
        .filter((j) => j.status === 'completed')
        .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)),
    [jobs],
  );

  async function handleRestore(jobId: string, name: string) {
    try {
      await restoreJob(actor!, jobId);
      toast(`“${name}” is back in the pipeline.`, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Archive</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {loading ? 'Connecting…' : `${archived.length} completed job${archived.length === 1 ? '' : 's'}, newest first`}
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <JobCardSkeleton /><JobCardSkeleton />
        </div>
      ) : archived.length === 0 ? (
        <EmptyState
          icon={<IconCheck className="h-7 w-7" />}
          title="Nothing shipped yet"
          subtitle="Completed jobs land here, newest first."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {archived.map((job) => (
              <JobCard key={job.id} job={job} onRestore={(j) => void handleRestore(j.id, j.name)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
