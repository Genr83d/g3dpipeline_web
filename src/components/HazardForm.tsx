import { useState, type FormEvent } from 'react';
import {
  HAZARD_LOCATION_MAX,
  HAZARD_SEVERITIES,
  HAZARD_TEXT_MAX,
  HAZARD_TITLE_MAX,
  hazardSeverityGuidance,
  hazardSeverityLabel,
  validateHazardInput,
  type HazardInput,
} from '../lib/hazards';
import type { Hazard, HazardSeverity } from '../types';
import { signalText, type SignalTone } from './Drafting';
import { FormError } from './FormError';

export const hazardSeverityTone: Readonly<Record<HazardSeverity, SignalTone>> = {
  low: 'primary',
  medium: 'amber',
  high: 'danger',
  critical: 'danger',
};

/** Report a hazard, or correct a report. */
export function HazardForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Hazard;
  onSubmit: (values: HazardInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [severity, setSeverity] = useState<HazardSeverity>(initial?.severity ?? 'medium');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const values = { title, location, description, severity };
    const message = validateHazardInput(values);
    if (message) return setError(message);
    setError('');
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        location: location.trim(),
        description: description.trim(),
        severity,
      });
    } finally {
      setBusy(false);
    }
  }

  const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200';

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="hazard-title" className={labelClass}>
          What is the hazard?
        </label>
        <input
          id="hazard-title"
          className="field"
          value={title}
          maxLength={HAZARD_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Oil on the floor by press 2"
          aria-invalid={error && !title.trim() ? true : undefined}
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="hazard-location" className={labelClass}>
          Where is it? <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input
          id="hazard-location"
          className="field"
          value={location}
          maxLength={HAZARD_LOCATION_MAX}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Press bay"
        />
      </div>
      <fieldset>
        <legend className={labelClass}>Severity</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HAZARD_SEVERITIES.map((option) => (
            <label
              key={option}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded border px-2 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                severity === option
                  ? `border-current bg-white/70 dark:bg-slate-900/70 ${signalText[hazardSeverityTone[option]]}`
                  : 'border-slate-200/80 text-slate-600 hover:bg-white/60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`}
            >
              <input
                type="radio"
                name="hazard-severity"
                value={option}
                className="sr-only"
                checked={severity === option}
                onChange={() => setSeverity(option)}
              />
              {hazardSeverityLabel(option)}
            </label>
          ))}
        </div>
        <p
          className={`mt-1.5 text-xs font-medium ${signalText[hazardSeverityTone[severity]]}`}
          data-testid="hazard-severity-guidance"
        >
          {hazardSeverityGuidance(severity)}
        </p>
      </fieldset>
      <div>
        <label htmlFor="hazard-description" className={labelClass}>
          Details <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea
          id="hazard-description"
          className="field min-h-24 resize-y"
          value={description}
          maxLength={HAZARD_TEXT_MAX}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What you saw, and who it could hurt"
        />
      </div>
      <FormError message={error} />
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy && (
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
          )}
          {busy ? 'Saving...' : initial ? 'Save Changes' : 'Report Hazard'}
        </button>
      </div>
    </form>
  );
}
