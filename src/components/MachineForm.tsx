import { useState, type FormEvent } from 'react';
import type { Machine } from '../types';
import type { MachineInput } from '../services/machineService';

export function MachineForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Machine;
  onSubmit: (values: MachineInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canSubmit = name.trim().length > 0 && location.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Machine name is required.');
    if (!location.trim()) return setError('Location is required.');
    setError('');
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        location: location.trim(),
        notes: notes.trim(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="machine-name" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Machine Name
        </label>
        <input
          id="machine-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. UV Printer 1"
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="machine-location" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Location
        </label>
        <input
          id="machine-location"
          className="field"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Production floor"
        />
      </div>
      <div>
        <label htmlFor="machine-notes" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Notes
        </label>
        <textarea
          id="machine-notes"
          className="field min-h-24 resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional maintenance notes"
        />
      </div>
      {error && (
        <p className="rounded-md border border-danger/20 bg-danger-soft/70 px-3 py-2 text-sm font-medium text-danger dark:bg-red-950/40 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy || !canSubmit}>
          {busy && (
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
          )}
          {busy ? 'Saving...' : initial ? 'Save Changes' : 'Add Machine'}
        </button>
      </div>
    </form>
  );
}
