import { motion } from 'framer-motion';
import { isOverdue, type Job } from '../types';
import { formatDate } from '../lib/format';
import { StatusPill } from './StatusPill';
import { IconBox, IconCalendar, IconCheck, IconEdit, IconPlay, IconRestore, IconTrash, IconUser, IconUserPlus } from './icons';
import { useAuth } from '../context/AuthProvider';
import { useAppearance } from '../context/AppearanceProvider';

export function JobCard({
  job,
  onStart,
  onComplete,
  onEdit,
  onDelete,
  onRestore,
  onAssign,
}: {
  job: Job;
  onStart?: (job: Job) => void;
  onComplete?: (job: Job) => void;
  onEdit?: (job: Job) => void;
  onDelete?: (job: Job) => void;
  onRestore?: (job: Job) => void;
  onAssign?: (job: Job) => void;
}) {
  const { authUser, isAdmin, isManagerOrAdmin } = useAuth();
  const { motionReduced } = useAppearance();
  const overdue = isOverdue(job);
  const mine = job.assignedToUid === authUser?.uid;
  const isManager = isManagerOrAdmin && !isAdmin;
  // Starting an unassigned job self-assigns it — Managers may only assign Staff,
  // so they get no Start shortcut until a job is assigned to them.
  const canStart = job.assignedToUid === '' ? !isManager : mine;

  return (
    <motion.article
      layout={!motionReduced}
      initial={motionReduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={motionReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className={`surface flex flex-col gap-3 p-4 ${
        overdue
          ? 'border-danger/40'
          : job.status === 'started'
            ? 'border-amber-500/40 dark:border-amber-400/30'
            : job.status === 'completed'
              ? 'border-secondary/40 dark:border-emerald-400/30'
              : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-bold">{job.name}</h3>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">for {job.customer}</p>
        </div>
        <StatusPill status={job.status} overdue={overdue} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <IconBox className="h-4 w-4 text-slate-400" />
          {job.quantity} unit{job.quantity === 1 ? '' : 's'}
        </span>
        <span className={`inline-flex items-center gap-1.5 ${overdue ? 'font-semibold text-danger dark:text-red-300' : ''}`}>
          <IconCalendar className="h-4 w-4 text-slate-400" />
          Due {formatDate(job.dueDate)}
        </span>
        {job.assignedToName && (
          <span className="inline-flex items-center gap-1.5">
            <IconUser className="h-4 w-4 text-slate-400" />
            {job.status === 'completed' ? 'Done by' : job.status === 'started' ? 'Started by' : 'Assigned to'}{' '}
            {job.assignedToName}
            {mine ? ' (you)' : ''}
          </span>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {job.status === 'pending' && onStart && canStart && (
          <button className="btn-primary flex-1" onClick={() => onStart(job)}>
            <IconPlay className="h-4 w-4" /> Start
          </button>
        )}
        {job.status === 'started' && mine && onComplete && (
          <button className="btn-secondary flex-1" onClick={() => onComplete(job)}>
            <IconCheck className="h-4 w-4" /> Complete
          </button>
        )}
        {job.status === 'completed' && isManagerOrAdmin && onRestore && (
          <button className="btn-secondary flex-1" onClick={() => onRestore(job)}>
            <IconRestore className="h-4 w-4" /> Restore
          </button>
        )}
        {job.status !== 'completed' && isManagerOrAdmin && onAssign && (
          <button className="btn-secondary" onClick={() => onAssign(job)} aria-label={`Assign ${job.name}`}>
            <IconUserPlus className="h-4 w-4" /> {job.assignedToUid ? 'Reassign' : 'Assign'}
          </button>
        )}
        {isManagerOrAdmin && onEdit && (
          <button className="btn-ghost" onClick={() => onEdit(job)} aria-label={`Edit ${job.name}`}>
            <IconEdit className="h-4 w-4" /> Edit
          </button>
        )}
        {isAdmin && onDelete && (
          <button className="btn-danger" onClick={() => onDelete(job)} aria-label={`Delete ${job.name}`}>
            <IconTrash className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.article>
  );
}
