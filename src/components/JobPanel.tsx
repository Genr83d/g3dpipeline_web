import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { isOverdue, type Job, type JobSection } from '../types';
import { useAuth } from '../context/AuthProvider';
import { useAppearance } from '../context/AppearanceProvider';
import {
  canEditJob,
  canManageCollaborators,
  canUpdateJobProgress,
  canUpdateSectionProgress,
} from '../lib/jobPermissions';
import { jobQuantityConfig } from '../lib/jobCategories';
import { overallSectionProgress, usesRepairVocabulary } from '../lib/jobSections';
import { formatDate } from '../lib/format';
import type { AssignTarget } from '../services/jobService';
import { SidePanel, PanelTabs, type PanelTab } from './SidePanel';
import { StatusPill } from './StatusPill';
import { JobForm, type JobFormValues } from './JobForm';
import { JobProgressForm, type FormActivity } from './JobProgressModal';
import { SectionProgressForm } from './SectionProgressModal';
import { JobTeamForm } from './AssignJobModal';

export type JobPanelTab = 'details' | 'units' | 'sections' | 'team';

export interface JobPanelState {
  job: Job;
  tab: JobPanelTab;
}

const IDLE: FormActivity = { dirty: false, busy: false };

/** Which tabs this viewer can use on this job. A tab the viewer cannot act on
 *  is not shown at all — staff opening a job they work on see only progress. */
export function jobPanelTabs(
  job: Job,
  viewer: { uid: string; role: Parameters<typeof canEditJob>[1] } | null,
): PanelTab<JobPanelTab>[] {
  if (!viewer) return [];
  const tabs: PanelTab<JobPanelTab>[] = [];
  if (canEditJob(job.status, viewer.role)) tabs.push({ id: 'details', label: 'Details' });
  const showsQuantity = jobQuantityConfig(job.category).usesQuantity;
  if (showsQuantity && job.quantity !== 1 && canUpdateJobProgress(job, viewer)) {
    tabs.push({ id: 'units', label: 'Units', badge: `${job.completedQuantity}/${job.quantity}` });
  }
  if (
    job.repairProcesses.length > 0 &&
    canUpdateSectionProgress({ status: job.status, sections: job.repairProcesses }, viewer)
  ) {
    tabs.push({
      id: 'sections',
      label: usesRepairVocabulary(job.category) ? 'Processes' : 'Sections',
      badge: `${overallSectionProgress(job.repairProcesses)}%`,
    });
  }
  if (canManageCollaborators(job.status, viewer.role)) {
    tabs.push({
      id: 'team',
      label: 'Team',
      badge: job.collaborators.length > 0 ? job.collaborators.length : undefined,
    });
  }
  return tabs;
}

/** One place to work on a job: its details, its progress, and its team.
 *
 *  Each tab saves on its own and a successful save closes the panel, exactly
 *  like the separate dialogs it replaces. Leaving a tab — or the panel — with
 *  unsaved edits asks first, so at most one tab is ever dirty and closing
 *  after a save can never drop someone's work. */
export function JobPanel({
  state,
  onTabChange,
  onClose,
  onSaveDetails,
  onSaveUnits,
  onSaveSections,
  onSaveTeam,
  onClearTeam,
}: {
  state: JobPanelState | null;
  onTabChange: (tab: JobPanelTab) => void;
  onClose: () => void;
  onSaveDetails: (job: Job, values: JobFormValues) => Promise<void | string>;
  onSaveUnits: (job: Job, completedQuantity: number) => Promise<void>;
  onSaveSections: (job: Job, sections: JobSection[]) => Promise<void>;
  onSaveTeam: (job: Job, collaborators: AssignTarget[], sections: JobSection[]) => Promise<void>;
  onClearTeam: (job: Job) => Promise<void>;
}) {
  const { profile } = useAuth();
  const { motionReduced } = useAppearance();
  const [activity, setActivity] = useState<FormActivity>(IDLE);
  /** What the user tried to do while the active tab had unsaved edits. */
  const [pending, setPending] = useState<{ kind: 'close' } | { kind: 'tab'; tab: JobPanelTab } | null>(null);

  const job = state?.job ?? null;
  const viewer = profile ? { uid: profile.uid, role: profile.role } : null;
  const tabs = job ? jobPanelTabs(job, viewer) : [];
  const active = tabs.some((t) => t.id === state?.tab) ? state!.tab : tabs[0]?.id;

  useEffect(() => {
    setActivity(IDLE);
    setPending(null);
  }, [job?.id, active]);

  const reportActivity = useCallback((next: FormActivity) => {
    setActivity((current) =>
      current.dirty === next.dirty && current.busy === next.busy ? current : next,
    );
  }, []);

  const requestClose = useCallback(() => {
    if (activity.busy) return;
    if (activity.dirty) return setPending({ kind: 'close' });
    onClose();
  }, [activity, onClose]);

  function requestTab(tab: JobPanelTab) {
    if (tab === active || activity.busy) return;
    if (activity.dirty) return setPending({ kind: 'tab', tab });
    onTabChange(tab);
  }

  function discard() {
    const action = pending;
    setPending(null);
    setActivity(IDLE);
    if (!action) return;
    if (action.kind === 'close') onClose();
    else onTabChange(action.tab);
  }

  const overdue = job ? isOverdue(job) : false;

  return (
    <SidePanel
      open={job !== null && active !== undefined}
      title={job?.name ?? ''}
      onClose={requestClose}
      meta={
        job && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {job.orderNumber && (
              <span className="readout text-xs font-semibold text-primary dark:text-indigo-300">
                {job.orderNumber}
              </span>
            )}
            <StatusPill status={job.status} overdue={overdue} />
            <span
              className="readout min-w-0 max-w-full truncate text-xs text-slate-500 dark:text-slate-400"
              title={job.customer}
            >
              {job.customer} · due {formatDate(job.dueDate)}
            </span>
          </div>
        )
      }
      tabs={
        tabs.length > 1 && active ? (
          <PanelTabs tabs={tabs} active={active} onChange={requestTab} idPrefix="job-panel" />
        ) : undefined
      }
    >
      <AnimatePresence initial={false}>
        {pending && (
          <motion.div
            role="alertdialog"
            aria-label="Discard changes?"
            initial={motionReduced ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="sticky -top-5 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-amber-500/35 bg-amber-50 px-3 py-2.5 shadow-[0_8px_18px_-12px_rgba(13,23,38,0.35)] dark:border-amber-400/30 dark:bg-amber-950"
          >
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Discard changes?
              <span className="block text-xs font-medium text-amber-800/80 dark:text-amber-200/80">
                This tab has edits that are not saved.
              </span>
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost py-1.5" onClick={() => setPending(null)}>
                Keep editing
              </button>
              <button type="button" className="btn-danger py-1.5" onClick={discard}>
                Discard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {job && (
        <div
          className="flex min-h-full flex-col"
          id="job-panel-tabpanel"
          role={tabs.length > 1 ? 'tabpanel' : undefined}
          aria-labelledby={tabs.length > 1 ? `job-panel-tab-${active}` : undefined}
        >
          {active === 'details' && (
            <JobForm
              key={job.id}
              initial={job}
              submitLabel="Save changes"
              onSubmit={(values) => onSaveDetails(job, values)}
              onCancel={requestClose}
              onActivity={reportActivity}
            />
          )}
          {active === 'units' && (
            <JobProgressForm
              job={job}
              showJobName={false}
              onSave={(value) => onSaveUnits(job, value)}
              onCancel={requestClose}
              onActivity={reportActivity}
            />
          )}
          {active === 'sections' && (
            <SectionProgressForm
              job={job}
              showJobName={false}
              onSave={(sections) => onSaveSections(job, sections)}
              onCancel={requestClose}
              onActivity={reportActivity}
            />
          )}
          {active === 'team' && (
            <JobTeamForm
              job={job}
              showHeading
              onSave={onSaveTeam}
              onClear={onClearTeam}
              onClose={requestClose}
              onActivity={reportActivity}
            />
          )}
        </div>
      )}
    </SidePanel>
  );
}
