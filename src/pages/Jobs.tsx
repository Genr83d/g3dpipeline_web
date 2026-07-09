import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useJobsOutlet } from '../routes/Workspace';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../components/Toast';
import { JobCard } from '../components/JobCard';
import { JobForm, type JobFormValues } from '../components/JobForm';
import { Modal } from '../components/Modal';
import { AssignJobModal } from '../components/AssignJobModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { JobCardSkeleton, Skeleton } from '../components/Skeleton';
import { IconBox, IconPlus } from '../components/icons';
import { errorMessage } from '../lib/format';
import { isOverdue, type Job } from '../types';
import type { AssignTarget } from '../services/jobService';
import * as jobService from '../services/jobService';

type SortKey = 'due-asc' | 'due-desc' | 'qty-asc' | 'qty-desc';

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'due-asc', label: 'Closest due date' },
  { value: 'due-desc', label: 'Furthest due date' },
  { value: 'qty-asc', label: 'Smallest quantity' },
  { value: 'qty-desc', label: 'Largest quantity' },
];

export default function Jobs() {
  const { jobs, loading, error } = useJobsOutlet();
  const { actor, assigner, isAdmin, isManagerOrAdmin } = useAuth();
  const { toast } = useToast();
  const [sort, setSort] = useState<SortKey>('due-asc');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState<Job | null>(null);
  const [assigning, setAssigning] = useState<Job | null>(null);

  const pipeline = useMemo(() => {
    const active = jobs.filter((j) => j.status !== 'completed');
    const sorted = [...active];
    switch (sort) {
      case 'due-asc': sorted.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()); break;
      case 'due-desc': sorted.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime()); break;
      case 'qty-asc': sorted.sort((a, b) => a.quantity - b.quantity); break;
      case 'qty-desc': sorted.sort((a, b) => b.quantity - a.quantity); break;
    }
    return sorted;
  }, [jobs, sort]);
  const overview = useMemo(
    () => ({
      pending: pipeline.filter((job) => job.status === 'pending').length,
      started: pipeline.filter((job) => job.status === 'started').length,
      overdue: pipeline.filter((job) => isOverdue(job)).length,
      units: pipeline.reduce((total, job) => total + job.quantity, 0),
    }),
    [pipeline],
  );

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action();
      toast(success, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  if (!actor || !assigner) return null;

  async function handleAdd(values: JobFormValues) {
    await run(() => jobService.addJob(actor!, values), 'Job added to the pipeline.');
    setAdding(false);
  }

  async function handleEdit(values: JobFormValues) {
    if (!editing) return;
    await run(() => jobService.editJob(actor!, editing.id, values), 'Job updated.');
    setEditing(null);
  }

  async function handleSaveCollaborators(job: Job, collaborators: AssignTarget[]) {
    await jobService.assignJob(actor!, job.id, collaborators);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        eyebrow="Live pipeline"
        subtitle={loading ? 'Connecting to the production stream...' : `${pipeline.length} active job${pipeline.length === 1 ? '' : 's'} in the pipeline`}
        actions={
          <>
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

      {error && (
        <p className="rounded-md border border-danger/20 bg-danger-soft/70 px-3 py-2 text-sm font-medium text-danger dark:bg-red-950/40 dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <>
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
      ) : pipeline.length === 0 ? (
        <EmptyState
          icon={<IconBox className="h-7 w-7" />}
          title="The pipeline is clear"
          subtitle="No active jobs right now. Add one and it appears on everyone's board instantly."
          action={
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <IconPlus className="h-4 w-4" /> Add the first job
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
                  onStart={(j) => void run(() => jobService.startJob(actor!, assigner!, j.id), `You started “${j.name}”.`)}
                  onComplete={(j) => void run(() => jobService.completeJob(actor!, assigner!, j.id), `“${j.name}” completed. Nice.`)}
                  onEdit={setEditing}
                  onDelete={isAdmin ? setDeleting : undefined}
                  onAssign={isManagerOrAdmin ? setAssigning : undefined}
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

      <Modal open={adding} title="Add job" onClose={() => setAdding(false)}>
        <JobForm submitLabel="Add job" onSubmit={handleAdd} onCancel={() => setAdding(false)} />
      </Modal>

      <Modal open={editing !== null} title="Edit job" onClose={() => setEditing(null)}>
        {editing && (
          <JobForm initial={editing} submitLabel="Save changes" onSubmit={handleEdit} onCancel={() => setEditing(null)} />
        )}
      </Modal>

      <Modal open={deleting !== null} title="Delete job?" onClose={() => setDeleting(null)}>
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm">
              Permanently delete <strong>{deleting.name}</strong> for {deleting.customer}? This
              can't be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
              <button
                className="btn-danger"
                onClick={() => {
                  void run(() => jobService.deleteJob(deleting.id), 'Job deleted.');
                  setDeleting(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
