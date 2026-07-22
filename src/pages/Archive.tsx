import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useJobsOutlet } from '../routes/Workspace';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../components/Toast';
import { JobCard } from '../components/JobCard';
import { EmptyState } from '../components/EmptyState';
import {
  JOB_DELETE_WARNING,
  JobConfirmDialog,
  JobConfirmSummary,
} from '../components/JobConfirmDialog';
import { JobCardSkeleton, Skeleton } from '../components/Skeleton';
import { PageHeader } from '../components/PageHeader';
import { IconCheck, IconCloudOff } from '../components/icons';
import { errorMessage } from '../lib/format';
import { deleteJob, restoreJob } from '../services/jobService';
import type { Job } from '../types';

export default function Archive() {
  const { jobs, loading, error, retry } = useJobsOutlet();
  const { actor, isAdmin, isManagerOrAdmin } = useAuth();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<Job | null>(null);

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

  async function handleDelete(job: Job) {
    await deleteJob(job.id);
    toast(`“${job.name}” deleted.`, 'success');
    setDeleting(null);
  }

  return (
    <div className="space-y-6" data-tour="archive-page">
      <PageHeader
        title="Archive"
        eyebrow="Completed output"
        subtitle={loading ? 'Connecting to shipped jobs...' : `${archived.length} completed job${archived.length === 1 ? '' : 's'}, newest first`}
      />

      {loading ? (
        <>
          <Skeleton className="h-20 max-w-sm" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
          </div>
        </>
      ) : error ? (
        <EmptyState
          tone="danger"
          icon={<IconCloudOff className="h-7 w-7" />}
          title="Unable to Load Jobs"
          subtitle={error}
          action={<button className="btn-secondary" onClick={retry}>Retry</button>}
        />
      ) : archived.length === 0 ? (
        <EmptyState
          icon={<IconCheck className="h-7 w-7" />}
          title="Nothing shipped yet"
          subtitle="Completed jobs land here, newest first."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {archived.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onRestore={isManagerOrAdmin ? (j) => void handleRestore(j.id, j.name) : undefined}
                onDelete={isAdmin ? setDeleting : undefined}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <JobConfirmDialog
        open={deleting !== null}
        title="Delete Job?"
        confirmLabel="Delete Job"
        busyLabel="Deleting…"
        destructive
        warning={JOB_DELETE_WARNING}
        onCancel={() => setDeleting(null)}
        onConfirm={() => handleDelete(deleting!)}
      >
        {deleting && <JobConfirmSummary jobName={deleting.name} jobRef={deleting.id} />}
      </JobConfirmDialog>
    </div>
  );
}
