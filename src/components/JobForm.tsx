import { useState, type FormEvent } from 'react';
import { toDateInputValue, fromDateInputValue } from '../lib/format';
import {
  clampJobQuantity,
  DEFAULT_JOB_CATEGORY,
  JOB_CATEGORY_OPTIONS,
  jobQuantityConfig,
  NORMALIZED_QUANTITY,
  validateJobQuantity,
} from '../lib/jobCategories';
import { isManagerOrAdminRole } from '../lib/roles';
import type { Job, JobCategory } from '../types';
import { useAuth } from '../context/AuthProvider';
import { IconMinus, IconPlus } from './icons';

export interface JobFormValues {
  name: string;
  customer: string;
  quantity: number;
  dueDate: Date;
  category: JobCategory;
  isAwf: boolean;
}

export function JobForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Job;
  submitLabel: string;
  onSubmit: (values: JobFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const { profile } = useAuth();
  const canChooseAwf = profile ? isManagerOrAdminRole(profile.role) : false;
  const [name, setName] = useState(initial?.name ?? '');
  const [customer, setCustomer] = useState(initial?.customer ?? '');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '');
  const [dueDate, setDueDate] = useState(initial ? toDateInputValue(initial.dueDate) : '');
  const [category, setCategory] = useState<JobCategory>(
    initial?.category ?? DEFAULT_JOB_CATEGORY,
  );
  const [isAwf, setIsAwf] = useState(initial?.isAwf ?? profile?.role === 'awf');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const today = toDateInputValue(new Date());

  const quantityConfig = jobQuantityConfig(category);
  const parsedQuantity = Number(quantity.trim());
  const atMinimum =
    Number.isFinite(parsedQuantity) && parsedQuantity <= quantityConfig.minimumQuantity;
  const atMaximum =
    Number.isFinite(parsedQuantity) && parsedQuantity >= quantityConfig.maximumQuantity;

  function stepQuantity(delta: number) {
    setQuantity((current) => {
      const value = Number(current.trim());
      const next = Number.isFinite(value) && current.trim().length > 0
        ? value + delta
        : quantityConfig.minimumQuantity;
      return String(clampJobQuantity(category, next));
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError('Job name is required.');
    if (!customer.trim()) return setError('Receiver is required.');
    const quantityError = quantityConfig.usesQuantity
      ? validateJobQuantity(category, quantity)
      : null;
    if (quantityError) return setError(quantityError);
    if (!dueDate) return setError('Deadline is required.');
    const parsedDueDate = fromDateInputValue(dueDate);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (parsedDueDate.getTime() < startOfToday.getTime()) {
      return setError('Deadline cannot be in the past.');
    }
    setError('');
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        customer: customer.trim(),
        quantity: quantityConfig.usesQuantity ? Number(quantity.trim()) : NORMALIZED_QUANTITY,
        dueDate: parsedDueDate,
        category,
        isAwf: profile?.role === 'awf' ? true : isAwf,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="job-name" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Job Name
        </label>
        <input
          id="job-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bracket set, PETG"
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="job-customer" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Name of Receiver
        </label>
        <input
          id="job-customer"
          className="field"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Who is this for?"
        />
      </div>
      <div>
        <label htmlFor="job-category" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Job Type
        </label>
        <select
          id="job-category"
          className="field"
          value={category}
          required
          onChange={(e) => setCategory(e.target.value as JobCategory)}
        >
          {JOB_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {quantityConfig.usesQuantity && (
          <div>
            <label htmlFor="job-qty" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              {quantityConfig.quantityLabel}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-ghost px-2.5"
                aria-label={`Decrease ${quantityConfig.quantityLabel.toLowerCase()}`}
                disabled={atMinimum}
                onClick={() => stepQuantity(-1)}
              >
                <IconMinus className="h-4 w-4" />
              </button>
              <input
                id="job-qty"
                className="field text-center"
                type="number"
                inputMode="numeric"
                min={quantityConfig.minimumQuantity}
                max={quantityConfig.maximumQuantity}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={String(quantityConfig.minimumQuantity)}
              />
              <button
                type="button"
                className="btn-ghost px-2.5"
                aria-label={`Increase ${quantityConfig.quantityLabel.toLowerCase()}`}
                disabled={atMaximum}
                onClick={() => stepQuantity(1)}
              >
                <IconPlus className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Max {quantityConfig.maximumQuantity}
            </p>
          </div>
        )}
        <div>
          <label htmlFor="job-due" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Deadline
          </label>
          <input
            id="job-due"
            className="field"
            type="date"
            min={today}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      {canChooseAwf && (
        <label
          htmlFor="job-awf"
          className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200/70 bg-white/45 px-3 py-3 dark:border-slate-800/80 dark:bg-slate-950/25"
        >
          <input
            id="job-awf"
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary dark:border-slate-700"
            checked={isAwf}
            onChange={(e) => setIsAwf(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              AWF job
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
              Include this job in the AWF Staff pipeline.
            </span>
          </span>
        </label>
      )}
      {error && (
        <p className="rounded-md border border-danger/20 bg-danger-soft/70 px-3 py-2 text-sm font-medium text-danger dark:bg-red-950/40 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
