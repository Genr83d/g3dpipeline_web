import { useState } from 'react';
import { motion } from 'framer-motion';
import { isOverdue, type Job } from '../types';
import { formatDate } from '../lib/format';
import {
  canCompleteJob,
  canDeleteJob,
  canEditJob,
  canManageCollaborators,
  canRestoreJob,
  canStartJob,
} from '../lib/jobPermissions';
import { isManagerOrAdminRole, roleLabel } from '../lib/roles';
import { jobCategoryLabel } from '../lib/jobCategories';
import { StatusPill } from './StatusPill';
import { IconBox, IconCalendar, IconCheck, IconChevron, IconEdit, IconPlay, IconRestore, IconTag, IconTrash, IconUser, IconUserPlus } from './icons';
import { useAuth } from '../context/AuthProvider';
import { useAppearance } from '../context/AppearanceProvider';

function collaboratorSummary(job: Job, currentUid?: string): string {
  if (job.collaborators.length === 0) return '';
  const me = currentUid && job.collaborators.some((collaborator) => collaborator.uid === currentUid);
  if (me) {
    return job.collaborators.length === 1 ? 'Me' : `Me + ${job.collaborators.length - 1}`;
  }
  const first = job.collaborators[0];
  const firstName = first.name.trim();
  if (job.collaborators.length === 1) {
    return firstName ? `${firstName} · ${roleLabel(first.role)}` : roleLabel(first.role);
  }
  return firstName
    ? `${firstName} + ${job.collaborators.length - 1}`
    : `${job.collaborators.length} people`;
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
  const { profile } = useAuth();
  const { motionReduced } = useAppearance();
  const [expanded, setExpanded] = useState(true);
  const overdue = isOverdue(job);
  const hasCollaborators = job.collaboratorUids.length > 0 || job.assignedToUid.length > 0;
  const collaboration = collaboratorSummary(job, profile?.uid);
  const isCompleted = job.status === 'completed';
  const viewer = profile ? { uid: profile.uid, role: profile.role } : null;
  const canStart = viewer ? canStartJob(job, viewer) : false;
  const canComplete = viewer ? canCompleteJob(job, viewer) : false;
  const canEdit = profile ? canEditJob(job.status, profile.role) : false;
  const canManageTeam = profile ? canManageCollaborators(job.status, profile.role) : false;
  const canRestore = profile ? canRestoreJob(profile.role) : false;
  const canDelete = profile ? canDeleteJob(profile.role) : false;
  const isManagerOrAdmin = profile ? isManagerOrAdminRole(profile.role) : false;
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
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusPill status={job.status} overdue={overdue} />
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-300/70 bg-white/60 px-2 py-0.5 text-[0.68rem] font-bold text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-300">
            <IconTag className="h-3 w-3" />
            {jobCategoryLabel(job.category)}
          </span>
          {isManagerOrAdmin && job.isAwf && (
            <span className="inline-flex rounded-md border border-secondary/35 bg-secondary-soft px-2 py-0.5 text-[0.68rem] font-bold tracking-wide text-secondary dark:border-emerald-400/30 dark:bg-emerald-950/70 dark:text-emerald-300">
              AWF
            </span>
          )}
        </div>
      </div>

      {expanded && <div className="divide-y divide-slate-200/70 border-y border-slate-200/70 text-sm text-slate-700 dark:divide-slate-800/80 dark:border-slate-800/80 dark:text-slate-200">
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
              {collaboration}
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
              {collaboration || 'Unassigned'}
            </strong>
          </span>
        )}
      </div>}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          className="btn-ghost px-2.5"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${job.name}`}
          onClick={() => setExpanded((value) => !value)}
        >
          <IconChevron className={`h-4 w-4 transition-transform ${expanded ? '-rotate-90' : 'rotate-90'}`} />
          {expanded ? 'Hide details' : 'Show details'}
        </button>
        {job.status === 'pending' && onStart && canStart && (
          <button className="btn-primary flex-1" onClick={() => onStart(job)}>
            <IconPlay className="h-4 w-4" /> Start Job
          </button>
        )}
        {job.status === 'started' && canComplete && onComplete && (
          <button className="btn-secondary flex-1" onClick={() => onComplete(job)}>
            <IconCheck className="h-4 w-4" /> Complete Job
          </button>
        )}
        {job.status === 'completed' && canRestore && onRestore && (
          <button className="btn-secondary flex-1" onClick={() => onRestore(job)}>
            <IconRestore className="h-4 w-4" /> Restore
          </button>
        )}
        {canManageTeam && onAssign && (
          <button className="btn-secondary" onClick={() => onAssign(job)} aria-label={`Edit collaborators for ${job.name}`}>
            <IconUserPlus className="h-4 w-4" /> {hasCollaborators ? 'Edit Team' : 'Add Team'}
          </button>
        )}
        {canEdit && onEdit && (
          <button className="btn-ghost" onClick={() => onEdit(job)} aria-label={`Edit ${job.name}`}>
            <IconEdit className="h-4 w-4" /> Edit
          </button>
        )}
        {canDelete && onDelete && (
          <button className="btn-danger" onClick={() => onDelete(job)} aria-label={`Delete ${job.name}`}>
            <IconTrash className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.article>
  );
}
