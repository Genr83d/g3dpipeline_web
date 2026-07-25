import { useEffect, useState, type FormEvent } from 'react';
import type { Job, RepairProcess } from '../types';
import {
  clampRepairProgress,
  overallRepairProgress,
  REPAIR_PROGRESS_MAX,
  REPAIR_PROGRESS_MIN,
  REPAIR_PROGRESS_STEP,
} from '../lib/repairProcesses';
import { Modal } from './Modal';

/** One slider per repair process. Sliders move in 5% steps to match the Flutter
 *  app; the stored schema accepts any integer from 0 through 100, so values set
 *  elsewhere round-trip untouched unless the user drags that process. */
export function RepairProgressModal({
  job,
  onSave,
  onClose,
}: {
  job: Job | null;
  onSave: (processes: RepairProcess[]) => Promise<void>;
  onClose: () => void;
}) {
  const [processes, setProcesses] = useState<RepairProcess[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job) return;
    setProcesses(job.repairProcesses.map((process) => ({ ...process })));
    setError('');
    setBusy(false);
  }, [job]);

  function setProgress(name: string, value: number) {
    setProcesses((current) =>
      current.map((process) =>
        process.name === name ? { ...process, progress: clampRepairProgress(value) } : process,
      ),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!job || busy) return;
    setError('');
    setBusy(true);
    try {
      await onSave(processes);
    } catch {
      setError('Unable to update repair progress. Try again.');
      setBusy(false);
    }
  }

  return (
    <Modal
      open={job !== null}
      title="Update Repair Process Progress"
      onClose={() => !busy && onClose()}
    >
      {job && (
        <form className="space-y-5" noValidate onSubmit={handleSubmit}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
              {job.name}
            </p>
            <p className="shrink-0 text-sm font-bold tabular-nums text-primary dark:text-indigo-300">
              {overallRepairProgress(processes)}% overall
            </p>
          </div>
          <ul className="space-y-4">
            {processes.map((process, index) => {
              const fieldId = `repair-process-${index}`;
              return (
                <li key={process.name}>
                  <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
                    <label
                      htmlFor={fieldId}
                      className="min-w-0 truncate text-sm font-semibold text-slate-700 dark:text-slate-200"
                    >
                      {process.name}
                    </label>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-slate-600 dark:text-slate-300">
                      {process.progress}%
                    </span>
                  </div>
                  <input
                    id={fieldId}
                    type="range"
                    className="w-full accent-primary"
                    min={REPAIR_PROGRESS_MIN}
                    max={REPAIR_PROGRESS_MAX}
                    step={REPAIR_PROGRESS_STEP}
                    disabled={busy}
                    value={process.progress}
                    onChange={(event) => setProgress(process.name, Number(event.target.value))}
                  />
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
