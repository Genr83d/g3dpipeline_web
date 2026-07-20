import { useEffect, useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { errorMessage } from '../lib/format';

export const JOB_DOWNSTREAM_WARNING =
  'This may affect workflow, notifications, reporting, billing, and other downstream processes.';

export const JOB_DELETE_WARNING =
  'This permanently removes the job from the pipeline. It cannot be undone and may affect workflow, reporting, and billing.';

export const UNTITLED_JOB_FALLBACK = 'Untitled job';

/** Confirmation dialog for consequential job actions (start/complete/delete).
 *  Cannot be dismissed while the request is in flight, blocks duplicate
 *  submissions, keeps errors retryable in place, and closes only after the
 *  backend confirms — callers must not update visible state optimistically. */
export function JobConfirmDialog({
  open,
  title,
  confirmLabel,
  busyLabel,
  destructive = false,
  warning,
  onCancel,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  busyLabel: string;
  destructive?: boolean;
  warning: string;
  onCancel: () => void;
  /** Resolves on backend success; the caller closes the dialog afterwards. */
  onConfirm: () => Promise<void>;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError('');
    }
  }, [open]);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={() => !busy && onCancel()}>
      <div className="space-y-4">
        {children}
        <p className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200">
          {warning}
        </p>
        {error && (
          <p
            className="rounded-md border border-danger/20 bg-danger-soft/70 px-3 py-2 text-sm font-medium text-danger dark:bg-red-950/40 dark:text-red-300"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={destructive ? 'btn-danger' : 'btn-primary'}
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function JobConfirmSummary({
  jobName,
  jobRef,
  currentStatus,
  targetStatus,
}: {
  jobName: string;
  jobRef?: string;
  currentStatus?: string;
  targetStatus?: string;
}) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold text-ink dark:text-slate-50">
        {jobName.trim() || UNTITLED_JOB_FALLBACK}
      </p>
      {jobRef && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Job ID: {jobRef}</p>
      )}
      {currentStatus && targetStatus && (
        <p className="text-slate-600 dark:text-slate-300">
          Current status: <strong>{currentStatus}</strong> → Target status:{' '}
          <strong>{targetStatus}</strong>
        </p>
      )}
    </div>
  );
}
