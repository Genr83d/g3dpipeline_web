import { useEffect, useState, type FormEvent } from 'react';
import type { Job } from '../types';
import { validateCompletedQuantity } from '../lib/jobProgress';
import { Modal } from './Modal';

export function JobProgressModal({
  job,
  onSave,
  onClose,
}: {
  job: Job | null;
  onSave: (completedQuantity: number) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job) return;
    setValue(String(job.completedQuantity));
    setError('');
    setBusy(false);
  }, [job]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!job || busy) return;
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
    <Modal open={job !== null} title="Update Job Progress" onClose={() => !busy && onClose()}>
      {job && (
        <form className="space-y-5" noValidate onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{job.name}</p>
          <div>
            <label htmlFor="completed-quantity-field" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Units completed
            </label>
            <div className="flex items-center gap-3">
              <input
                id="completed-quantity-field"
                className="field min-w-0 flex-1"
                type="number"
                inputMode="numeric"
                min={0}
                max={job.quantity}
                step={1}
                required
                disabled={busy}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
              />
              <span className="shrink-0 font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                / {job.quantity}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Enter a value from 0 to {job.quantity}
            </p>
          </div>
          {error && (
            <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft/70 px-3 py-2 text-sm font-medium text-danger dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save Progress'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
