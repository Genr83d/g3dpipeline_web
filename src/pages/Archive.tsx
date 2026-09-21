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
import { IconCalendar, IconCheck, IconCloudOff } from '../components/icons';
import { errorMessage } from '../lib/format';
import {
  ARCHIVE_ALL_MONTHS,
  ARCHIVE_ALL_MONTHS_LABEL,
  archiveMonthLabel,
  archiveMonthOptions,
  archivedJobs,
  filterJobsByArchiveMonth,
  isArchiveMonthAvailable,
  type ArchiveMonthFilter,
} from '../lib/archiveMonths';
import { deleteJob, restoreJob } from '../services/jobService';
import type { Job } from '../types';

export default function Archive() {
  const { jobs, loading, error, retry } = useJobsOutlet();
  const { actor, isAdmin, isManagerOrAdmin } = useAuth();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<Job | null>(null);
  const [month, setMonth] = useState<ArchiveMonthFilter>(ARCHIVE_ALL_MONTHS);

  const archived = useMemo(() => archivedJobs(jobs), [jobs]);
  const monthOptions = useMemo(() => archiveMonthOptions(archived), [archived]);

  // Restoring or deleting the last job of the month in view empties it while
  // the user is looking at it. Falling back during this render — rather than
  // in an effect — means the select never paints a value no option carries.
  if (!isArchiveMonthAvailable(month, monthOptions)) setMonth(ARCHIVE_ALL_MONTHS);

  const visible = useMemo(
    () => filterJobsByArchiveMonth(archived, month),
    [archived, month],
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

  const count = month === ARCHIVE_ALL_MONTHS ? archived.length : visible.length;
  const subtitle = loading
    ? 'Connecting to shipped jobs...'
    : `${count} completed job${count === 1 ? '' : 's'}${
        month === ARCHIVE_ALL_MONTHS ? ', newest first' : ` in ${archiveMonthLabel(month)}`
      }`;

  return (
    <div className="space-y-6" data-tour="archive-page">
      <PageHeader
        title="Archive"
        eyebrow="Completed output"
        subtitle={subtitle}
        actions={
          !loading && !error && archived.length > 0 ? (
            <div className="relative w-full sm:w-auto" data-tour="archive-month-filter">
              <IconCalendar
                className={`pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transition-colors ${
                  month === ARCHIVE_ALL_MONTHS
                    ? 'text-slate-400'
                    : 'text-primary dark:text-indigo-300'
                }`}
              />
              <label htmlFor="archive-month-filter" className="sr-only">
                Filter by completion month
              </label>
              <select
                id="archive-month-filter"
                aria-label="Filter by completion month"
                className={`field w-full py-2 pl-9 sm:w-auto ${
                  month === ARCHIVE_ALL_MONTHS
                    ? ''
                    : 'border-primary/45 text-primary dark:border-indigo-400/45 dark:text-indigo-200'
                }`}
                value={month}
                onChange={(e) => setMonth(e.target.value as ArchiveMonthFilter)}
              >
                <option value={ARCHIVE_ALL_MONTHS}>{ARCHIVE_ALL_MONTHS_LABEL}</option>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : undefined
        }
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
            {visible.map((job) => (
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
        {deleting && <JobConfirmSummary jobName={deleting.name} jobRef={deleting.orderNumber} />}
      </JobConfirmDialog>
    </div>
  );
}
