import { useEffect, useState, type FormEvent } from 'react';
import type { Job } from '../types';
import { validateCompletedQuantity } from '../lib/jobProgress';
import { Modal } from './Modal';
import { FormError } from './FormError';

export interface FormActivity {
  dirty: boolean;
  busy: boolean;
}

/** The units-completed form on its own, so it can sit in a dialog or in the
 *  job panel's Units tab. `onActivity` reports unsaved edits and an in-flight
 *  save, which is what lets the host refuse to close mid-way. */
export function JobProgressForm({
  job,
  onSave,
  onCancel,
  onActivity,
  showJobName = true,
}: {
  job: Job;
  onSave: (completedQuantity: number) => Promise<void>;
  onCancel: () => void;
  onActivity?: (activity: FormActivity) => void;
  showJobName?: boolean;
}) {
  const [value, setValue] = useState(String(job.completedQuantity));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(String(job.completedQuantity));
    setError('');
    setBusy(false);
  }, [job]);

  const dirty = value !== String(job.completedQuantity);
  useEffect(() => {
    onActivity?.({ dirty, busy });
  }, [dirty, busy, onActivity]);

  const numeric = Number(value);
  const ratio = job.quantity > 0 && Number.isFinite(numeric)
    ? Math.max(0, Math.min(1, numeric / job.quantity))
    : 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const validationError = validateCompletedQuantity(value, job.quantity);
    if (validationError) return setError(validationError);
    setError('');
    setBusy(true);
    try {
      await onSave(Number(value));
    } catch {
      setError('Unable to update progress. Try again.');
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      {showJobName && (
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{job.name}</p>
      )}
      <div>
        <label htmlFor="completed-quantity-field" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Units completed
        </label>
        <div className="flex items-center gap-3">
          <input
            id="completed-quantity-field"
            className="field readout min-w-0 flex-1 text-lg"
            type="number"
            inputMode="numeric"
            min={0}
            max={job.quantity}
            step={1}
            required
            disabled={busy}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'completed-quantity-error' : undefined}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
          <span className="readout shrink-0 text-lg font-semibold text-slate-600 dark:text-slate-300">
            / {job.quantity}
          </span>
        </div>
        <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-[1px] bg-primary/12 dark:bg-indigo-400/15">
          <div
            className="h-full bg-primary transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] dark:bg-indigo-400"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Enter a value from 0 to {job.quantity}
        </p>
      </div>
      <FormError id="completed-quantity-error" message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save Progress'}
        </button>
      </div>
    </form>
  );
}

export function JobProgressModal({
  job,
  onSave,
  onClose,
}: {
  job: Job | null;
  onSave: (completedQuantity: number) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={job !== null} title="Update Job Progress" onClose={() => !busy && onClose()}>
      {job && (
        <JobProgressForm
          job={job}
          onSave={onSave}
          onCancel={onClose}
          onActivity={(activity) => setBusy(activity.busy)}
        />
      )}
    </Modal>
  );
}
