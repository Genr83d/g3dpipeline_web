import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useJobsOutlet } from '../routes/Workspace';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../components/Toast';
import { JobCard } from '../components/JobCard';
import { JobForm, type JobFormValues } from '../components/JobForm';
import { JobProgressModal } from '../components/JobProgressModal';
import { Modal } from '../components/Modal';
import {
  JOB_DELETE_WARNING,
  JOB_DOWNSTREAM_WARNING,
  JobConfirmDialog,
  JobConfirmSummary,
} from '../components/JobConfirmDialog';
import { AssignJobModal } from '../components/AssignJobModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { JobCardSkeleton, Skeleton } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { IconBox, IconCloudOff, IconFilter, IconPlus } from '../components/icons';
import { errorMessage } from '../lib/format';
import {
  filterJobsByCategory,
  JOB_CATEGORY_OPTIONS,
  jobCategoryLabel,
  type JobCategoryFilter,
} from '../lib/jobCategories';
import { isOverdue, type Job } from '../types';
import type { AssignTarget } from '../services/jobService';
import * as jobService from '../services/jobService';

type SortKey = 'due-asc' | 'due-desc' | 'qty-asc' | 'qty-desc';

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'due-asc', label: 'Closest deadline' },
  { value: 'due-desc', label: 'Furthest deadline' },
  { value: 'qty-asc', label: 'Smallest quantity' },
  { value: 'qty-desc', label: 'Largest quantity' },
];

export default function Jobs() {
  const { jobs, loading, error, retry } = useJobsOutlet();
  const { actor, assigner, isAdmin, isManagerOrAdmin } = useAuth();
  const { toast } = useToast();
  const [sort, setSort] = useState<SortKey>('due-asc');
  const [categoryFilter, setCategoryFilter] = useState<JobCategoryFilter>('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState<Job | null>(null);
  const [assigning, setAssigning] = useState<Job | null>(null);
  const [starting, setStarting] = useState<Job | null>(null);
  const [completing, setCompleting] = useState<Job | null>(null);
  const [updatingProgress, setUpdatingProgress] = useState<Job | null>(null);

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status !== 'completed'),
    [jobs],
  );
  const pipeline = useMemo(() => {
    const sorted = filterJobsByCategory(activeJobs, categoryFilter);
    switch (sort) {
      case 'due-asc': sorted.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()); break;
      case 'due-desc': sorted.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime()); break;
      case 'qty-asc': sorted.sort((a, b) => a.quantity - b.quantity); break;
      case 'qty-desc': sorted.sort((a, b) => b.quantity - a.quantity); break;
    }
    return sorted;
  }, [activeJobs, categoryFilter, sort]);
  const overview = useMemo(
    () => ({
      pending: pipeline.filter((job) => job.status === 'pending').length,
      started: pipeline.filter((job) => job.status === 'started').length,
      overdue: pipeline.filter((job) => isOverdue(job)).length,
      units: pipeline.reduce((total, job) => total + job.quantity, 0),
    }),
    [pipeline],
  );

  async function run(action: () => Promise<void>, success: string): Promise<boolean> {
    try {
      await action();
      toast(success, 'success');
      return true;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return false;
    }
  }

  if (!actor || !assigner) return null;

  async function handleAdd(values: JobFormValues) {
    const saved = await run(
      () => jobService.addJob(actor!, assigner!, values),
      'Job added to the pipeline.',
    );
    if (saved) setAdding(false);
  }

  async function handleEdit(values: JobFormValues) {
    if (!editing) return;
    const saved = await run(
      () => jobService.editJob(actor!, assigner!, editing.id, values),
      'Job updated.',
    );
    if (saved) setEditing(null);
  }

  async function handleSaveCollaborators(job: Job, collaborators: AssignTarget[]) {
    await jobService.assignJob(actor!, assigner!, job.id, collaborators);
    const [primary] = collaborators;
    const suffix = collaborators.length > 1 ? ` + ${collaborators.length - 1}` : '';
    toast(`“${job.name}” collaborators updated: ${primary.name}${suffix}.`, 'success');
    setAssigning(null);
  }

  async function handleClearCollaborators(job: Job) {
    await jobService.unassignJob(actor!, job.id);
    toast(`“${job.name}” is unassigned.`, 'success');
    setAssigning(null);
  }

  async function handleUpdateProgress(completedQuantity: number) {
    if (!updatingProgress) return;
    await jobService.updateJobProgress({
      jobId: updatingProgress.id,
      completedQuantity,
      currentUser: { ...actor!, role: assigner!.role },
    });
    toast(`Progress updated to ${completedQuantity}/${updatingProgress.quantity} units.`, 'success');
    setUpdatingProgress(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        eyebrow="Live pipeline"
        subtitle={loading ? 'Loading shared jobs...' : `${pipeline.length} active job${pipeline.length === 1 ? '' : 's'} in the pipeline`}
        actions={
          <>
          <div className="relative w-full sm:w-auto">
            <IconFilter
              className={`pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transition-colors ${
                categoryFilter === 'all'
                  ? 'text-slate-400'
                  : 'text-primary dark:text-indigo-300'
              }`}
            />
            <label htmlFor="job-category-filter" className="sr-only">Filter by job type</label>
            <select
              id="job-category-filter"
              aria-label="Filter by job type"
              className={`field w-full py-2 pl-9 sm:w-auto ${
                categoryFilter === 'all'
                  ? ''
                  : 'border-primary/45 text-primary dark:border-indigo-400/45 dark:text-indigo-200'
              }`}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as JobCategoryFilter)}
            >
              <option value="all">All Types</option>
              {JOB_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <label htmlFor="sort" className="sr-only">Sort jobs</label>
          <select id="sort" className="field w-full py-2 sm:w-auto" value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}>
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <IconPlus className="h-4 w-4" /> Add job
          </button>
          </>
        }
      />

      {loading ? (
        <>
          <div className="surface flex items-center justify-center gap-3 px-4 py-5" role="status">
            <Spinner className="h-6 w-6" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Loading shared jobs...
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
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
          action={
            <button className="btn-secondary" onClick={retry}>
              Retry
            </button>
          }
        />
      ) : activeJobs.length === 0 ? (
        <EmptyState
          icon={<IconBox className="h-7 w-7" />}
          title="No Jobs In The Pipeline"
          subtitle="Create a new job to begin tracking production."
          action={
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <IconPlus className="h-4 w-4" /> Add the first job
            </button>
          }
        />
      ) : pipeline.length === 0 && categoryFilter !== 'all' ? (
        <EmptyState
          icon={<IconFilter className="h-7 w-7" />}
          title={`No ${jobCategoryLabel(categoryFilter)} Jobs`}
          subtitle="Try another job type or show all job types."
          action={
            <button className="btn-secondary" onClick={() => setCategoryFilter('all')}>
              Show All Types
            </button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Pending', overview.pending],
              ['In progress', overview.started],
              ['Overdue', overview.overdue],
              ['Units queued', overview.units],
            ].map(([label, value]) => (
              <div key={label} className="surface px-4 py-3">
                <p className="technical-label">{label}</p>
                <p className={`font-display text-2xl font-bold tabular-nums ${
                  label === 'Overdue' && Number(value) > 0 ? 'text-danger dark:text-red-300' : ''
                }`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {pipeline.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onStart={setStarting}
                  onComplete={setCompleting}
                  onEdit={setEditing}
                  onDelete={isAdmin ? setDeleting : undefined}
                  onAssign={isManagerOrAdmin ? setAssigning : undefined}
                  onUpdateProgress={setUpdatingProgress}
                />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      <AssignJobModal
        job={assigning}
        onSave={handleSaveCollaborators}
        onClear={handleClearCollaborators}
        onClose={() => setAssigning(null)}
      />

      <JobProgressModal
        job={updatingProgress}
        onSave={handleUpdateProgress}
        onClose={() => setUpdatingProgress(null)}
      />

      <Modal open={adding} title="Add job" onClose={() => setAdding(false)}>
        <JobForm submitLabel="Add job" onSubmit={handleAdd} onCancel={() => setAdding(false)} />
      </Modal>

      <Modal open={editing !== null} title="Edit job" onClose={() => setEditing(null)}>
        {editing && (
          <JobForm initial={editing} submitLabel="Save changes" onSubmit={handleEdit} onCancel={() => setEditing(null)} />
        )}
      </Modal>

      <JobConfirmDialog
        open={starting !== null}
        title="Start Job?"
        confirmLabel="Start Job"
        busyLabel="Updating…"
        warning={JOB_DOWNSTREAM_WARNING}
        onCancel={() => setStarting(null)}
        onConfirm={async () => {
          await jobService.startJob(actor!, assigner!, starting!.id);
          toast(`You started “${starting!.name}”.`, 'success');
          setStarting(null);
        }}
      >
        {starting && (
          <JobConfirmSummary
            jobName={starting.name}
            currentStatus="Pending"
            targetStatus="In Progress"
          />
        )}
      </JobConfirmDialog>

      <JobConfirmDialog
        open={completing !== null}
        title="Complete Job?"
        confirmLabel="Mark as Completed"
        busyLabel="Updating…"
        destructive
        warning={JOB_DOWNSTREAM_WARNING}
        onCancel={() => setCompleting(null)}
        onConfirm={async () => {
          await jobService.completeJob(actor!, assigner!, completing!.id);
          toast(`“${completing!.name}” completed. Nice.`, 'success');
          setCompleting(null);
        }}
      >
        {completing && (
          <JobConfirmSummary
            jobName={completing.name}
            jobRef={completing.id}
            currentStatus="In Progress"
            targetStatus="Completed"
          />
        )}
      </JobConfirmDialog>

      <JobConfirmDialog
        open={deleting !== null}
        title="Delete Job?"
        confirmLabel="Delete Job"
        busyLabel="Deleting…"
        destructive
        warning={JOB_DELETE_WARNING}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          await jobService.deleteJob(deleting!.id);
          toast(`“${deleting!.name}” deleted.`, 'success');
          setDeleting(null);
        }}
      >
        {deleting && <JobConfirmSummary jobName={deleting.name} jobRef={deleting.id} />}
      </JobConfirmDialog>
    </div>
  );
}
