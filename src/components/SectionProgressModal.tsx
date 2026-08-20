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

/** One slider per job section. Sliders move in 5% steps to match the Flutter
 *  app; the stored schema accepts any integer from 0 through 100, so values set
 *  elsewhere round-trip untouched unless the user drags that section.
 *
 *  Managers and admins may move every section. A collaborator sees the whole
 *  list — the job's shape is not a secret — but only the sections assigned to
 *  them are interactive; the rest are disabled and name their owner. */
export function SectionProgressModal({
  job,
  onSave,
  onClose,
}: {
  job: Job | null;
  onSave: (sections: JobSection[]) => Promise<void>;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [sections, setSections] = useState<JobSection[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job) return;
    setSections(job.repairProcesses.map((section) => ({ ...section })));
    setError('');
    setBusy(false);
  }, [job]);

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
    if (!job || busy) return;
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
    <Modal
      open={job !== null}
      title={job ? `Update ${sectionsHeading(job.category)}` : 'Update Job Sections'}
      onClose={() => !busy && onClose()}
    >
      {job && (
        <form className="space-y-5" noValidate onSubmit={handleSubmit}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
              {job.name}
            </p>
            <p className="shrink-0 text-sm font-bold tabular-nums text-primary dark:text-indigo-300">
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
                    <span className="shrink-0 text-sm font-bold tabular-nums text-slate-600 dark:text-slate-300">
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
          {error && (
            <p
              role="alert"
              className="rounded-md border border-danger/20 bg-danger-soft/70 px-3 py-2 text-sm font-medium text-danger dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save Progress'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
