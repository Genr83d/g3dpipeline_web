import { motion } from 'framer-motion';
import { isOverdue, type Job } from '../types';
import { formatDate } from '../lib/format';
import { StatusPill } from './StatusPill';
import { IconBox, IconCalendar, IconCheck, IconEdit, IconPlay, IconRestore, IconTrash, IconUser, IconUserPlus } from './icons';
import { useAuth } from '../context/AuthProvider';
import { useAppearance } from '../context/AppearanceProvider';

function collaboratorSummary(job: Job): string {
  if (job.collaborators.length === 0) return '';
  const firstName = job.collaborators[0].name || 'User';
  return job.collaborators.length === 1 ? firstName : `${firstName} + ${job.collaborators.length - 1}`;
}

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
  const mine =
    authUser !== null &&
    authUser !== undefined &&
    (job.collaboratorUids.includes(authUser.uid) || job.assignedToUid === authUser.uid);
  const hasCollaborators = job.collaboratorUids.length > 0;
  const collaboration = collaboratorSummary(job);
  const isCompleted = job.status === 'completed';
  const isManager = isManagerOrAdmin && !isAdmin;
  // Starting an unassigned job self-assigns it — Managers may only assign Staff,
  // so they get no Start shortcut until a job is assigned to them.
  const canStart = hasCollaborators ? mine : !isManager;
  const canComplete = mine || isManagerOrAdmin;
  const accent =
    overdue
      ? 'before:bg-danger'
      : job.status === 'started'
        ? 'before:bg-amber-500'
        : job.status === 'completed'
          ? 'before:bg-secondary'
          : 'before:bg-primary';

  return (
    <motion.article
      layout={!motionReduced}
      initial={motionReduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={motionReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className={`surface surface-hover relative flex min-h-64 flex-col gap-4 overflow-hidden p-4 before:absolute before:inset-y-0 before:left-0 before:w-1 ${accent} ${
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
        <div className="min-w-0 space-y-1 pl-2">
          <p className="technical-label">Job order</p>
          <h3 className="line-clamp-2 font-display text-lg font-bold leading-6 text-ink dark:text-slate-50">
            {job.name}
          </h3>
          <p className="truncate text-sm font-medium text-slate-600 dark:text-slate-300">
            {job.customer}
          </p>
        </div>
        <StatusPill status={job.status} overdue={overdue} />
      </div>

      <div className="divide-y divide-slate-200/70 border-y border-slate-200/70 text-sm text-slate-700 dark:divide-slate-800/80 dark:border-slate-800/80 dark:text-slate-200">
        {isCompleted && (
          <span className="flex items-center justify-between gap-3 py-2.5">
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconCheck className="h-4 w-4 shrink-0 text-secondary dark:text-emerald-300" />
              <span className="truncate">Completed by</span>
            </span>
            <strong className="min-w-0 truncate text-right">
              {job.completedByName || '—'}
            </strong>
          </span>
        )}
        {isCompleted && collaboration && (
          <span className="flex items-center justify-between gap-3 py-2.5">
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconUserPlus className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">Collaborators</span>
            </span>
            <strong className="min-w-0 truncate text-right">
              {collaboration}${mine ? ' (you)' : ''}
            </strong>
          </span>
        )}
        {isCompleted && (
          <span className="flex items-center justify-between gap-3 py-2.5">
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconCalendar className="h-4 w-4 shrink-0 text-secondary dark:text-emerald-300" />
              <span className="truncate">Completed on</span>
            </span>
            <strong className="shrink-0 text-secondary dark:text-emerald-300">
              {formatDate(job.completedAt)}
            </strong>
          </span>
        )}
        <span className="flex items-center justify-between gap-3 py-2.5">
          <span className="inline-flex min-w-0 items-center gap-2">
            <IconBox className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">Quantity</span>
          </span>
          <strong className="shrink-0 tabular-nums">
            {job.quantity} unit{job.quantity === 1 ? '' : 's'}
          </strong>
        </span>
        <span className={`flex items-center justify-between gap-3 py-2.5 ${
          overdue
            ? 'font-semibold text-danger dark:text-red-300'
            : ''
        }`}>
          <span className="inline-flex min-w-0 items-center gap-2">
            <IconCalendar className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">Due date</span>
          </span>
          <strong className="shrink-0">{formatDate(job.dueDate)}</strong>
        </span>
        {!isCompleted && (
          <span className="flex items-center justify-between gap-3 py-2.5">
            <span className="inline-flex min-w-0 items-center gap-2">
              <IconUser className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">Collaborators</span>
            </span>
            <strong className="min-w-0 truncate text-right">
              {collaboration ? `${collaboration}${mine ? ' (you)' : ''}` : 'Unassigned'}
            </strong>
          </span>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {job.status === 'pending' && onStart && canStart && (
          <button className="btn-primary flex-1" onClick={() => onStart(job)}>
            <IconPlay className="h-4 w-4" /> Start
          </button>
        )}
        {job.status === 'started' && canComplete && onComplete && (
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
          <button className="btn-secondary" onClick={() => onAssign(job)} aria-label={`Edit collaborators for ${job.name}`}>
            <IconUserPlus className="h-4 w-4" /> {hasCollaborators ? 'Edit' : 'Assign'}
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
