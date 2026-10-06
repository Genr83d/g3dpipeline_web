import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { isOverdue, type Job, type JobCategory } from '../types';
import { formatDate } from '../lib/format';
import {
  canCompleteJob,
  canDeleteJob,
  canEditJob,
  canManageCollaborators,
  canUpdateJobProgress,
  canUpdateSectionProgress,
  canRestoreJob,
  canStartJob,
} from '../lib/jobPermissions';
import { isManagerOrAdminRole, roleLabel } from '../lib/roles';
import { jobCategoryLabel, jobQuantityConfig } from '../lib/jobCategories';
import { jobTagLabel } from '../lib/jobTags';
import { jobCompletionRatio } from '../lib/jobProgress';
import {
  overallSectionProgress,
  sectionCollaboratorName,
  sectionsHeading,
  usesRepairVocabulary,
} from '../lib/jobSections';
import { StatusPill } from './StatusPill';
import { Gauge, type SignalTone } from './Drafting';
import { IconBox, IconCalendar, IconCheck, IconChevron, IconCode, IconEdit, IconGear, IconHistory, IconLayers, IconPalette, IconPlay, IconRestore, IconTag, IconTrash, IconUser, IconUserPlus, IconUsers, IconWrench } from './icons';
import { useAuth } from '../context/AuthProvider';
import { useAppearance } from '../context/AppearanceProvider';

/** Compact dropdown of assigned collaborators. Collapsed it shows only the
 *  count; expanded, a vertical list of avatar initial, name, and role. Never
 *  renders email addresses or other private contact details. Legacy jobs with
 *  only an assigned user surface that user via parseJob's collaborator fallback. */
function CollaboratorList({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const count = job.collaborators.length;

  return (
    <div className="py-1.5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <IconUsers className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
          <span className="truncate">Collaborators ({count})</span>
        </span>
        <IconChevron className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5" data-testid={`job-collaborators-${job.id}`}>
          {job.collaborators.map((collaborator) => {
            const name = collaborator.name.trim();
            return (
              <li key={collaborator.uid} className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-[var(--rule)] bg-slate-100 font-mono text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {name || 'Unknown collaborator'}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {roleLabel(collaborator.role)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const categoryBadgeStyles: Readonly<Record<JobCategory, string>> = {
  manufacturing:
    'border-primary/35 bg-primary-soft/70 text-primary dark:border-indigo-400/35 dark:bg-indigo-950/75 dark:text-indigo-300',
  repair:
    'border-amber-400/45 bg-amber-100 text-amber-800 dark:border-amber-400/40 dark:bg-amber-950/75 dark:text-amber-300',
  design:
    'border-violet-400/40 bg-violet-100 text-violet-700 dark:border-violet-400/40 dark:bg-violet-950/75 dark:text-violet-300',
  softwareDevelopment:
    'border-cyan-400/40 bg-cyan-100 text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-950/75 dark:text-cyan-300',
  miscellaneous:
    'border-slate-300/70 bg-slate-100 text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/75 dark:text-slate-300',
};

function JobCategoryIcon({ category }: { category: JobCategory }) {
  const className = 'h-3.5 w-3.5 shrink-0';
  switch (category) {
    case 'manufacturing':
      return <span data-category-symbol="gear"><IconGear className={className} /></span>;
    case 'repair':
      return <span data-category-symbol="wrench"><IconWrench className={className} /></span>;
    case 'design':
      return <span data-category-symbol="palette"><IconPalette className={className} /></span>;
    case 'softwareDevelopment':
      return <span data-category-symbol="code"><IconCode className={className} /></span>;
    case 'miscellaneous':
      return <span data-category-symbol="tag"><IconTag className={className} /></span>;
  }
}

/** A spec-sheet row: label, dotted leader, measured value. */
function SpecRow({
  icon,
  label,
  children,
  tone = '',
}: {
  icon: ReactNode;
  label: ReactNode;
  children: ReactNode;
  tone?: string;
}) {
  return (
    // The label keeps its width and the value gives way: a long value
    // truncates inside the card instead of pushing past its edge.
    <div className={`flex min-w-0 items-baseline gap-2 py-1.5 ${tone}`}>
      <span className="inline-flex shrink-0 items-center gap-2 self-center">
        {icon}
        <span className="whitespace-nowrap">{label}</span>
      </span>
      <span aria-hidden className="min-w-3 flex-1 translate-y-[-3px] border-b border-dotted border-[var(--rule)]" />
      <strong className="min-w-0 truncate text-right font-semibold">{children}</strong>
    </div>
  );
}

/** The heading line of a readout block. When the viewer can change the value
 *  it becomes a button that opens the job panel on the matching tab; the gauge
 *  itself stays outside the button so assistive tech still reads it as a
 *  progress bar. */
function ReadoutHeader({
  icon,
  label,
  value,
  action,
}: {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  const content = (
    <>
      <span className="inline-flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <strong className="readout font-semibold text-ink dark:text-slate-100">{value}</strong>
        {action && (
          <IconChevron className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary dark:group-hover:text-indigo-300" />
        )}
      </span>
    </>
  );
  if (!action) {
    return <div className="flex min-w-0 items-center justify-between gap-3">{content}</div>;
  }
  return (
    <button
      type="button"
      aria-label={action.label}
      title={action.label}
      onClick={action.onClick}
      className="group -mx-1.5 flex w-[calc(100%+0.75rem)] min-w-0 items-center justify-between gap-3 rounded px-1.5 py-0.5 text-left transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:hover:bg-indigo-400/10"
    >
      {content}
    </button>
  );
}

/** Per-section readout, shown for every job category. Every role sees these;
 *  only a manager, an admin, or a collaborator who owns one of the sections
 *  can open them for editing. */
function JobSectionList({ job }: { job: Job }) {
  return (
    <ul className="mt-2 space-y-2" data-testid={`job-sections-${job.id}`}>
      {job.repairProcesses.map((section) => {
        const owner = sectionCollaboratorName(job.collaborators, section);
        const tone = section.progress >= 100 ? 'secondary' : 'amber';
        return (
          <li key={section.name}>
            <div className="flex min-w-0 items-baseline justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                  {section.name}
                </span>
                <span
                  className={`max-w-[45%] shrink-0 truncate ${
                    owner
                      ? 'text-slate-500 dark:text-slate-400'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {owner || 'Unassigned'}
                </span>
              </span>
              <span className="readout shrink-0 font-semibold text-slate-600 dark:text-slate-300">
                {section.progress}%
              </span>
            </div>
            <Gauge
              className="mt-1 h-1"
              value={section.progress}
              tone={tone}
              label={`${section.name} progress`}
              testId={`job-section-fill-${job.id}-${section.name.toLowerCase()}`}
            />
          </li>
        );
      })}
    </ul>
  );
}

function daysLate(due: Date, now: Date = new Date()): number {
  return Math.max(1, Math.floor((now.getTime() - due.getTime()) / 86_400_000));
}

const statusTicks: Readonly<Record<'overdue' | Job['status'], string>> = {
  overdue: '[--tick:var(--color-danger)] dark:[--tick:var(--color-red-400)]',
  started: '[--tick:var(--color-amber-500)] dark:[--tick:var(--color-amber-400)]',
  completed: '[--tick:var(--color-secondary)] dark:[--tick:var(--color-emerald-400)]',
  pending: '',
};

export function JobCard({
  job,
  onStart,
  onComplete,
  onEdit,
  onDelete,
  onRestore,
  onAssign,
  onUpdateProgress,
  onUpdateSectionProgress,
}: {
  job: Job;
  onStart?: (job: Job) => void;
  onComplete?: (job: Job) => void;
  onEdit?: (job: Job) => void;
  onDelete?: (job: Job) => void;
  onRestore?: (job: Job) => void;
  onAssign?: (job: Job) => void;
  onUpdateProgress?: (job: Job) => void;
  onUpdateSectionProgress?: (job: Job) => void;
}) {
  const { profile } = useAuth();
  const { motionReduced } = useAppearance();
  const overdue = isOverdue(job);
  const hasCollaborators = job.collaboratorUids.length > 0 || job.assignedToUid.length > 0;
  const isCompleted = job.status === 'completed';
  const quantityConfig = jobQuantityConfig(job.category);
  const showsQuantity = quantityConfig.usesQuantity;
  const viewer = profile ? { uid: profile.uid, role: profile.role } : null;
  const canStart = viewer ? canStartJob(job, viewer) : false;
  const canComplete = viewer ? canCompleteJob(job, viewer) : false;
  const canEdit = profile ? canEditJob(job.status, profile.role) : false;
  const canManageTeam = profile ? canManageCollaborators(job.status, profile.role) : false;
  const canRestore = profile ? canRestoreJob(profile.role) : false;
  const canDelete = profile ? canDeleteJob(profile.role) : false;
  const canUpdateProgress = Boolean(
    viewer &&
    showsQuantity &&
    job.quantity !== 1 &&
    onUpdateProgress &&
    canUpdateJobProgress(job, viewer),
  );
  const showsSections = job.repairProcesses.length > 0;
  const sectionProgress = overallSectionProgress(job.repairProcesses);
  const canUpdateSections = Boolean(
    viewer &&
    showsSections &&
    onUpdateSectionProgress &&
    canUpdateSectionProgress(
      { status: job.status, sections: job.repairProcesses },
      viewer,
    ),
  );
  const completionRatio = jobCompletionRatio(job.completedQuantity, job.quantity);
  const completionPercentage = Math.round(completionRatio * 100);
  const isManagerOrAdmin = profile ? isManagerOrAdminRole(profile.role) : false;
  const tone: SignalTone = overdue
    ? 'danger'
    : job.status === 'started'
      ? 'amber'
      : job.status === 'completed'
        ? 'secondary'
        : 'primary';
  const iconClass = 'h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500';

  return (
    <motion.article
      data-tour="job-card"
      layout={!motionReduced}
      initial={motionReduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={motionReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className={`surface surface-hover drafting-frame relative flex flex-col gap-3.5 p-4 ${
        statusTicks[overdue ? 'overdue' : job.status]
      } ${overdue ? 'border-danger/35 dark:border-red-400/30' : ''}`}
    >
      {/* Title block: identifier and state on one ruled line, as on a drawing. */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--rule)] pb-2.5">
        <p
          className="min-w-0 truncate font-mono text-[0.7rem] tracking-[0.06em] text-slate-500 dark:text-slate-400"
          data-testid={`job-order-number-${job.id}`}
        >
          <span className="uppercase">Job order</span>
          {job.orderNumber && (
            <>
              {' • '}
              <span className="font-bold text-primary dark:text-indigo-300">
                {job.orderNumber}
              </span>
            </>
          )}
        </p>
        <StatusPill status={job.status} overdue={overdue} />
      </div>

      <div className="min-w-0 space-y-1.5">
        <h3 className="line-clamp-2 font-display text-lg leading-6 font-bold tracking-tight text-ink dark:text-slate-50">
          {job.name}
        </h3>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="mr-1 min-w-0 truncate text-sm font-medium text-slate-600 dark:text-slate-300">
            {job.customer}
          </p>
          <span
            aria-label={`Job type: ${jobCategoryLabel(job.category)}`}
            data-job-category={job.category}
            className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[0.68rem] font-bold ${categoryBadgeStyles[job.category]}`}
          >
            <JobCategoryIcon category={job.category} />
            {jobCategoryLabel(job.category)}
          </span>
          {/* Tags are what actually drive stock deduction, so they are on the
              card rather than hidden in the edit form. */}
          {job.tags.map((tag) => (
            <span
              key={tag}
              data-job-tag={tag}
              aria-label={`Tag: ${jobTagLabel(tag)}`}
              className="inline-flex rounded-sm border border-primary/35 bg-primary-soft px-1.5 py-0.5 font-mono text-[0.65rem] font-bold tracking-wide text-primary uppercase dark:border-indigo-400/30 dark:bg-indigo-950/70 dark:text-indigo-300"
            >
              {jobTagLabel(tag)}
            </span>
          ))}
          {isManagerOrAdmin && job.isAwf && (
            <span className="inline-flex rounded-sm border border-secondary/35 bg-secondary-soft px-1.5 py-0.5 font-mono text-[0.65rem] font-bold tracking-wide text-secondary dark:border-emerald-400/30 dark:bg-emerald-950/70 dark:text-emerald-300">
              AWF
            </span>
          )}
        </div>
      </div>

      {showsQuantity && (
        <div className="min-w-0 text-sm text-slate-600 dark:text-slate-300" data-testid={`job-progress-${job.id}`}>
          <ReadoutHeader
            icon={<IconBox className={iconClass} />}
            label={quantityConfig.quantityLabel}
            value={`${job.completedQuantity}/${job.quantity} units`}
            action={
              canUpdateProgress
                ? { label: 'Update job progress', onClick: () => onUpdateProgress?.(job) }
                : undefined
            }
          />
          <div className="mt-1.5 flex items-center gap-2.5">
            <Gauge
              className="h-1.5 flex-1"
              value={completionPercentage}
              tone={tone}
              label={`${job.name} completion`}
              testId={`job-progress-fill-${job.id}`}
            />
            <span className="readout w-9 shrink-0 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
              {completionPercentage}%
            </span>
          </div>
        </div>
      )}

      {showsSections && (
        <div className="min-w-0 text-sm text-slate-600 dark:text-slate-300">
          <ReadoutHeader
            icon={
              usesRepairVocabulary(job.category) ? (
                <IconWrench className={iconClass} />
              ) : (
                <IconLayers className={iconClass} />
              )
            }
            label={sectionsHeading(job.category)}
            value={`${sectionProgress}% overall`}
            action={
              canUpdateSections
                ? { label: 'Update section progress', onClick: () => onUpdateSectionProgress?.(job) }
                : undefined
            }
          />
          <JobSectionList job={job} />
        </div>
      )}

      <div className="text-sm text-slate-600 dark:text-slate-300">
        {isCompleted && (
          <SpecRow icon={<IconCheck className="h-4 w-4 shrink-0 text-secondary dark:text-emerald-300" />} label="Completed by">
            {job.completedByName || '—'}
          </SpecRow>
        )}
        {isCompleted && (
          <SpecRow
            icon={<IconCalendar className="h-4 w-4 shrink-0 text-secondary dark:text-emerald-300" />}
            label="Completed on"
          >
            <span className="readout text-secondary dark:text-emerald-300">{formatDate(job.completedAt)}</span>
          </SpecRow>
        )}
        <SpecRow
          icon={<IconCalendar className={overdue ? 'h-4 w-4 shrink-0' : iconClass} />}
          label="Due date"
          tone={overdue ? 'font-semibold text-danger dark:text-red-300' : ''}
        >
          <span className="readout">
            {formatDate(job.dueDate)}
            {overdue && ` · ${daysLate(job.dueDate)}d late`}
          </span>
        </SpecRow>
        {/* The reason is prose, not a measurement, so it wraps under its
            label rather than sitting at the end of a leader line. */}
        {job.dueDateChangeNote && (
          <div className="py-1.5">
            <span className="inline-flex items-center gap-2">
              <IconHistory className={iconClass} />
              Deadline changed
            </span>
            <p
              className="mt-1 line-clamp-3 pl-6 text-[0.8125rem] leading-5 break-words text-slate-700 dark:text-slate-200"
              title={job.dueDateChangeNote}
            >
              {job.dueDateChangeNote}
            </p>
          </div>
        )}
        {job.collaborators.length > 0 ? (
          <CollaboratorList job={job} />
        ) : (
          !isCompleted && (
            <SpecRow icon={<IconUser className={iconClass} />} label="Collaborators">
              <span className="text-amber-700 dark:text-amber-300">Unassigned</span>
            </SpecRow>
          )
        )}
      </div>

      <div
        data-testid={`job-actions-${job.id}`}
        className="mt-auto flex flex-nowrap items-center justify-center gap-[12px] border-t border-[var(--rule)] pt-3.5"
      >
        {canEdit && onEdit && (
          <button
            className="btn-ghost px-2.5"
            onClick={() => onEdit(job)}
            aria-label="Edit job"
            title="Edit job"
          >
            <IconEdit className="h-4 w-4" />
          </button>
        )}
        {canManageTeam && onAssign && (
          <button className="btn-secondary" onClick={() => onAssign(job)}>
            <IconUserPlus className="h-4 w-4" /> {hasCollaborators ? 'Team' : 'Add Team'}
          </button>
        )}
        {job.status === 'pending' && onStart && canStart && (
          <button className="btn-primary" onClick={() => onStart(job)}>
            <IconPlay className="h-4 w-4" /> Start
          </button>
        )}
        {job.status === 'started' && canComplete && onComplete && (
          <button className="btn-secondary" onClick={() => onComplete(job)}>
            <IconCheck className="h-4 w-4" /> Complete
          </button>
        )}
        {job.status === 'completed' && canRestore && onRestore && (
          <button className="btn-secondary" onClick={() => onRestore(job)}>
            <IconRestore className="h-4 w-4" /> Restore
          </button>
        )}
        {canDelete && onDelete && (
          <button
            className="btn-danger px-2.5"
            onClick={() => onDelete(job)}
            aria-label="Delete job"
            title="Delete job"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.article>
  );
}
