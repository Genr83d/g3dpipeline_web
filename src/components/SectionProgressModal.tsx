import { useEffect, useState, type FormEvent } from 'react';
import type { Job, JobSection } from '../types';
import {
  clampSectionProgress,
  overallSectionProgress,
  sectionCollaboratorName,
  sectionsHeading,
  SECTION_PROGRESS_MAX,
  SECTION_PROGRESS_MIN,
  SECTION_PROGRESS_STEP,
} from '../lib/jobSections';
import { canEditSectionProgress } from '../lib/jobPermissions';
import { useAuth } from '../context/AuthProvider';
import { Modal } from './Modal';
import { FormError } from './FormError';
import type { FormActivity } from './JobProgressModal';

/** One slider per job section. Sliders move in 5% steps to match the Flutter
 *  app; the stored schema accepts any integer from 0 through 100, so values set
 *  elsewhere round-trip untouched unless the user drags that section.
 *
 *  Managers and admins may move every section. A collaborator sees the whole
 *  list — the job's shape is not a secret — but only the sections assigned to
 *  them are interactive; the rest are disabled and name their owner. */
export function SectionProgressForm({
  job,
  onSave,
  onCancel,
  onActivity,
  showJobName = true,
}: {
  job: Job;
  onSave: (sections: JobSection[]) => Promise<void>;
  onCancel: () => void;
  onActivity?: (activity: FormActivity) => void;
  showJobName?: boolean;
}) {
  const { profile } = useAuth();
  const [sections, setSections] = useState<JobSection[]>(() =>
    job.repairProcesses.map((section) => ({ ...section })),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSections(job.repairProcesses.map((section) => ({ ...section })));
    setError('');
    setBusy(false);
  }, [job]);

  const dirty = sections.some(
    (section, index) => section.progress !== job.repairProcesses[index]?.progress,
  );
  useEffect(() => {
    onActivity?.({ dirty, busy });
  }, [dirty, busy, onActivity]);

  function setProgress(name: string, value: number) {
    setSections((current) =>
      current.map((section) =>
        section.name === name ? { ...section, progress: clampSectionProgress(value) } : section,
      ),
    );
  }

  const viewer = profile ? { uid: profile.uid, role: profile.role } : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await onSave(sections);
    } catch {
      setError('Unable to update section progress. Try again.');
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          {showJobName ? job.name : sectionsHeading(job.category)}
        </p>
        <p className="readout shrink-0 text-sm font-bold text-primary dark:text-indigo-300">
          {overallSectionProgress(sections)}% overall
        </p>
      </div>
      <ul className="space-y-4">
        {sections.map((section, index) => {
          const fieldId = `job-section-${index}`;
          const editable = viewer ? canEditSectionProgress(section, viewer) : false;
          const owner = sectionCollaboratorName(job.collaborators, section);
          return (
            <li key={section.name}>
              <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
                <label
                  htmlFor={fieldId}
                  className="min-w-0 truncate text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  {section.name}
                </label>
                <span className="readout shrink-0 text-sm font-bold text-slate-600 dark:text-slate-300">
                  {section.progress}%
                </span>
              </div>
              <input
                id={fieldId}
                type="range"
                className="w-full accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                min={SECTION_PROGRESS_MIN}
                max={SECTION_PROGRESS_MAX}
                step={SECTION_PROGRESS_STEP}
                disabled={busy || !editable}
                value={section.progress}
                onChange={(event) => setProgress(section.name, Number(event.target.value))}
              />
              {!editable && (
                <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {owner ? `Assigned to ${owner}` : 'Unassigned'}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save Progress'}
        </button>
      </div>
    </form>
  );
}

export function SectionProgressModal({
  job,
  onSave,
  onClose,
}: {
  job: Job | null;
  onSave: (sections: JobSection[]) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={job !== null}
      title={job ? `Update ${sectionsHeading(job.category)}` : 'Update Job Sections'}
      onClose={() => !busy && onClose()}
    >
      {job && (
        <SectionProgressForm
          job={job}
          onSave={onSave}
          onCancel={onClose}
          onActivity={(activity) => setBusy(activity.busy)}
        />
      )}
    </Modal>
  );
}
