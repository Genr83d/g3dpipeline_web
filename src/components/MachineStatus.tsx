import { useEffect, useState } from 'react';
import type { Machine } from '../types';
import { machineDownLabel } from '../lib/machineStatus';
import { Led, signalText } from './Drafting';
import { Modal } from './Modal';
import { InlineSpinner } from './MachinePanel';

const MACHINE_FAULT_MAX = 500;

/** LED plus an uppercase mono label — the same pill the hazards use. Only a
 *  machine that is down gets one; a working machine stays quiet. */
export function MachineDownPill({ machine }: { machine: Machine }) {
  return (
    <span
      data-testid="machine-down-pill"
      className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-sm border border-current/25 bg-white/60 px-2 py-0.5 font-mono text-[0.68rem] font-semibold tracking-[0.08em] uppercase dark:bg-slate-950/40 ${signalText.danger}`}
    >
      <Led tone="danger" live />
      <span className="truncate">{machineDownLabel(machine)}</span>
    </span>
  );
}

/** Asks what is wrong before a machine is marked down. */
export function ReportDownModal({
  machine,
  busy,
  onReport,
  onClose,
}: {
  machine: Machine | null;
  busy: boolean;
  onReport: (machine: Machine, reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const id = machine?.id ?? null;
  useEffect(() => setReason(''), [id]);
  const trimmed = reason.trim();

  return (
    <Modal open={machine !== null} title="Report machine down" onClose={onClose}>
      {machine && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed && !busy) onReport(machine, trimmed);
          }}
        >
          <p className="text-sm">
            <strong>{machine.name}</strong> will show as offline until someone marks it repaired.
          </p>
          <div className="space-y-1.5">
            <label
              htmlFor={`machine-down-reason-${machine.id}`}
              className="text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              What is wrong?
            </label>
            <textarea
              id={`machine-down-reason-${machine.id}`}
              className="field min-h-20 resize-y"
              rows={3}
              maxLength={MACHINE_FAULT_MAX}
              autoFocus
              autoCapitalize="sentences"
              placeholder="Describe the fault"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-danger" disabled={!trimmed || busy}>
              {busy && <InlineSpinner />}
              Report down
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** A confirmation, so a stray tap does not put a broken machine back in service. */
export function MarkRepairedModal({
  machine,
  busy,
  onConfirm,
  onClose,
}: {
  machine: Machine | null;
  busy: boolean;
  onConfirm: (machine: Machine) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={machine !== null} title="Mark repaired" onClose={onClose}>
      {machine && (
        <div className="space-y-4">
          <p className="text-sm">
            Is <strong>{machine.name}</strong> fixed and back in service?
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => onConfirm(machine)}>
              {busy && <InlineSpinner />}
              Mark repaired
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
