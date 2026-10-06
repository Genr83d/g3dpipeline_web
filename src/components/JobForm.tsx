import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toDateInputValue, fromDateInputValue } from '../lib/format';
import {
  clampJobQuantity,
  DEFAULT_JOB_CATEGORY,
  JOB_CATEGORY_OPTIONS,
  jobQuantityConfig,
  NORMALIZED_QUANTITY,
  validateJobQuantity,
} from '../lib/jobCategories';
import { JOB_TAG_OPTIONS } from '../lib/jobTags';
import { isManagerOrAdminRole } from '../lib/roles';
import {
  parseSectionNames,
  sectionHelperText,
  sectionRequiredMessage,
  sectionsHeading,
  sectionsToText,
  usesRepairVocabulary,
} from '../lib/jobSections';
import type { Job, JobCategory, JobTag } from '../types';
import { useAuth } from '../context/AuthProvider';
import { IconMinus, IconPlus } from './icons';
import { FormError } from './FormError';
import type { FormActivity } from './JobProgressModal';

export interface JobFormValues {
  name: string;
  customer: string;
  quantity: number;
  dueDate: Date;
  category: JobCategory;
  /** Always sent, empty included: an explicit empty list is what lets someone
   *  turn a stock deduction off, and what stops the saved job falling back to
   *  the legacy job-name match. */
  tags: JobTag[];
  isAwf: boolean;
  /** Set only when editing shifts the deadline to a different calendar day. */
  dueDateChangeNote?: string;
  /** One section name per line, required for every category. Percentages and
   *  collaborators are not edited here — unchanged names keep the progress and
   *  the owner they already had. */
  sectionNames: string[];
}

type FieldKey = 'name' | 'customer' | 'quantity' | 'dueDate' | 'dueDateChangeNote' | 'sections';

const FIELD_IDS: Readonly<Record<FieldKey, string>> = {
  name: 'job-name',
  customer: 'job-customer',
  quantity: 'job-qty',
  dueDate: 'job-due',
  dueDateChangeNote: 'due-date-change-note-field',
  sections: 'job-sections',
};

const ERROR_ID = 'job-form-error';

const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200';
const hintClass = 'mt-1 text-xs text-slate-500 dark:text-slate-400';

/** Add and edit share this form. `onSubmit` may resolve with an error message
 *  (a rejected write, say) and the form shows it in place, next to the
 *  fields, rather than only in a passing toast. */
export function JobForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onActivity,
}: {
  initial?: Job;
  submitLabel: string;
  onSubmit: (values: JobFormValues) => Promise<void | string>;
  onCancel: () => void;
  onActivity?: (activity: FormActivity) => void;
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
  const [tags, setTags] = useState<JobTag[]>(initial?.tags ?? []);
  const [isAwf, setIsAwf] = useState(initial?.isAwf ?? profile?.role === 'awf');
  const [sectionText, setSectionText] = useState(
    sectionsToText(initial?.repairProcesses ?? []),
  );
  const [dueDateChangeNote, setDueDateChangeNote] = useState('');
  const [error, setErrorText] = useState('');
  const [errorField, setErrorField] = useState<FieldKey | null>(null);
  const [busy, setBusy] = useState(false);
  const today = toDateInputValue(new Date());
  const formRef = useRef<HTMLFormElement>(null);

  /** Shows `message` and, when a field is at fault, marks and focuses it. */
  function setError(message: string, field: FieldKey | null = null) {
    setErrorText(message);
    setErrorField(field);
    if (field) {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>(`#${FIELD_IDS[field]}`)?.focus(),
      );
    }
  }

  function invalid(field: FieldKey) {
    return errorField === field
      ? { 'aria-invalid': true as const, 'aria-describedby': ERROR_ID }
      : {};
  }

  // Compare calendar days: a note is required only while editing an existing job
  // whose deadline now lands on a different day. Re-selecting the original day
  // (or creating a new job) clears the requirement.
  const originalDueDate = initial ? toDateInputValue(initial.dueDate) : '';
  const dueDateChanged = Boolean(initial) && dueDate !== originalDueDate;

  const sectionLabel = sectionsHeading(category);
  const sectionNames = parseSectionNames(sectionText);
  const quantityConfig = jobQuantityConfig(category);
  const parsedQuantity = Number(quantity.trim());
  const atMinimum =
    Number.isFinite(parsedQuantity) && parsedQuantity <= quantityConfig.minimumQuantity;
  const atMaximum =
    Number.isFinite(parsedQuantity) && parsedQuantity >= quantityConfig.maximumQuantity;

  // Existing sections whose names no longer appear lose their progress and
  // owner on save — say so while it can still be undone, not after.
  const droppedSections = initial
    ? initial.repairProcesses.filter(
        (section) =>
          !sectionNames.includes(section.name) &&
          (section.progress > 0 || section.collaboratorUid.trim().length > 0),
      )
    : [];

  const dirty = initial
    ? name !== initial.name ||
      customer !== initial.customer ||
      quantity !== String(initial.quantity) ||
      dueDateChanged ||
      category !== initial.category ||
      tags.slice().sort().join() !== initial.tags.slice().sort().join() ||
      isAwf !== initial.isAwf ||
      sectionText !== sectionsToText(initial.repairProcesses)
    : name.trim().length > 0 || customer.trim().length > 0 || sectionText.trim().length > 0;

  useEffect(() => {
    onActivity?.({ dirty, busy });
  }, [dirty, busy, onActivity]);

  function toggleTag(tag: JobTag, checked: boolean) {
    setTags((current) =>
      checked ? [...new Set([...current, tag])] : current.filter((entry) => entry !== tag),
    );
  }

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
    if (!name.trim()) return setError('Job name is required.', 'name');
    if (!customer.trim()) return setError('Receiver is required.', 'customer');
    const quantityError = quantityConfig.usesQuantity
      ? validateJobQuantity(category, quantity)
      : null;
    if (quantityError) return setError(quantityError, 'quantity');
    if (
      initial &&
      (quantityConfig.usesQuantity ? Number(quantity.trim()) : NORMALIZED_QUANTITY) <
        initial.completedQuantity
    ) {
      return setError(
        'The total quantity cannot be less than the completed quantity.',
        'quantity',
      );
    }
    if (!dueDate) return setError('Deadline is required.', 'dueDate');
    const parsedDueDate = fromDateInputValue(dueDate);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    // Only a deadline someone is choosing now has to be in the future. An
    // overdue job keeps its past date through an unrelated edit — renaming it
    // must not force a new deadline and a reason for one.
    const choosingDeadline = !initial || dueDateChanged;
    if (choosingDeadline && parsedDueDate.getTime() < startOfToday.getTime()) {
      return setError('Deadline cannot be in the past.', 'dueDate');
    }
    if (dueDateChanged && !dueDateChangeNote.trim()) {
      return setError('Add a reason for changing the deadline.', 'dueDateChangeNote');
    }
    if (sectionNames.length === 0) {
      return setError(sectionRequiredMessage(category), 'sections');
    }
    setError('');
    setBusy(true);
    try {
      const failure = await onSubmit({
        name: name.trim(),
        customer: customer.trim(),
        quantity: quantityConfig.usesQuantity ? Number(quantity.trim()) : NORMALIZED_QUANTITY,
        dueDate: parsedDueDate,
        category,
        tags,
        isAwf: profile?.role === 'awf' ? true : isAwf,
        dueDateChangeNote: dueDateChanged ? dueDateChangeNote.trim() : undefined,
        sectionNames,
      });
      if (typeof failure === 'string' && failure) setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="job-name" className={labelClass}>
            Job Name
          </label>
          <input
            id="job-name"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bracket set, PETG"
            autoFocus
            {...invalid('name')}
          />
        </div>
        <div>
          <label htmlFor="job-customer" className={labelClass}>
            Name of Receiver
          </label>
          <input
            id="job-customer"
            className="field"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Who is this for?"
            {...invalid('customer')}
          />
        </div>
        <div>
          <label htmlFor="job-category" className={labelClass}>
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
        <div>
          <label htmlFor="job-due" className={labelClass}>
            Deadline
          </label>
          <input
            id="job-due"
            className="field readout"
            type="date"
            // An unchanged past deadline is allowed to stay; the picker only
            // steers toward today once someone starts choosing a new date.
            min={initial && !dueDateChanged && originalDueDate < today ? undefined : today}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            {...invalid('dueDate')}
          />
        </div>
        {quantityConfig.usesQuantity && (
          <div>
            <label htmlFor="job-qty" className={labelClass}>
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
                className="field readout text-center"
                type="number"
                inputMode="numeric"
                min={quantityConfig.minimumQuantity}
                max={quantityConfig.maximumQuantity}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={String(quantityConfig.minimumQuantity)}
                {...invalid('quantity')}
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
            <p className={hintClass}>
              Max {quantityConfig.maximumQuantity}
              {initial && initial.completedQuantity > 0
                ? ` · ${initial.completedQuantity} already done`
                : ''}
            </p>
          </div>
        )}
        {dueDateChanged && (
          <div className={quantityConfig.usesQuantity ? '' : 'sm:col-span-2'}>
            <label htmlFor="due-date-change-note-field" className={labelClass}>
              Reason for deadline change
            </label>
            <textarea
              id="due-date-change-note-field"
              className="field min-h-20 resize-y"
              rows={2}
              value={dueDateChangeNote}
              onChange={(e) => setDueDateChangeNote(e.target.value)}
              placeholder="Why is the deadline moving?"
              {...invalid('dueDateChangeNote')}
            />
            <p className={hintClass}>Required when the due date changes</p>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="job-sections" className={labelClass}>
          {sectionLabel}
        </label>
        <textarea
          id="job-sections"
          className="field min-h-24 resize-y"
          rows={4}
          value={sectionText}
          onChange={(e) => setSectionText(e.target.value)}
          placeholder={
            usesRepairVocabulary(category)
              ? 'Cleaning\nWelding\nMachining\nSpraying'
              : 'Design\nRouting\nMetalworking'
          }
          {...invalid('sections')}
        />
        <p className={hintClass}>
          {sectionHelperText(category)}
          {initial ? ' Renaming one resets it to 0% and unassigned.' : ''}
        </p>
        {droppedSections.length > 0 && (
          <p className="mt-2 rounded border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-400/25 dark:bg-amber-950/40 dark:text-amber-200">
            Saving clears the progress and owner of{' '}
            <strong>{droppedSections.map((section) => section.name).join(', ')}</strong>.
          </p>
        )}
      </div>

      <fieldset>
        <legend className={labelClass}>Tags</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {JOB_TAG_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`job-tag-${option.value}`}
              className="flex cursor-pointer items-start gap-2.5 rounded border border-slate-200/80 bg-white/50 px-3 py-2.5 transition-colors has-[:checked]:border-primary/45 has-[:checked]:bg-primary-soft/50 dark:border-slate-800/80 dark:bg-slate-950/25 dark:has-[:checked]:border-indigo-400/40 dark:has-[:checked]:bg-indigo-950/40"
            >
              <input
                id={`job-tag-${option.value}`}
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-primary focus:ring-primary dark:border-slate-700"
                checked={tags.includes(option.value)}
                onChange={(e) => toggleTag(option.value, e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
          {canChooseAwf && (
            <label
              htmlFor="job-awf"
              className="flex cursor-pointer items-start gap-2.5 rounded border border-slate-200/80 bg-white/50 px-3 py-2.5 transition-colors has-[:checked]:border-secondary/45 has-[:checked]:bg-secondary-soft/50 dark:border-slate-800/80 dark:bg-slate-950/25 dark:has-[:checked]:border-emerald-400/40 dark:has-[:checked]:bg-emerald-950/40"
            >
              <input
                id="job-awf"
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-secondary focus:ring-secondary dark:border-slate-700"
                checked={isAwf}
                onChange={(e) => setIsAwf(e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  AWF job
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Include this job in the AWF Staff pipeline.
                </span>
              </span>
            </label>
          )}
        </div>
      </fieldset>

      <FormError id={ERROR_ID} message={error} />

      {/* Pinned to the bottom of the scrolling dialog body, so Save is always
          in reach however long the form grows. */}
      <div className="sticky -bottom-5 z-10 -mx-5 mt-auto flex items-center justify-end gap-2 border-t border-[var(--surface-border)] bg-[var(--surface-bg-strong)] px-5 py-3">
        {initial && dirty && !busy && (
          <span className="technical-label mr-auto text-amber-700 dark:text-amber-300">
            Unsaved changes
          </span>
        )}
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
