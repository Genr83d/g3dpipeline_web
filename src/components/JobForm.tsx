import { useState, type FormEvent } from 'react';
import { toDateInputValue, fromDateInputValue } from '../lib/format';
import type { Job } from '../types';

export interface JobFormValues {
  name: string;
  customer: string;
  quantity: number;
  dueDate: Date;
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
  const [name, setName] = useState(initial?.name ?? '');
  const [customer, setCustomer] = useState(initial?.customer ?? '');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '');
  const [dueDate, setDueDate] = useState(initial ? toDateInputValue(initial.dueDate) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!name.trim()) return setError('Job name is required.');
    if (!customer.trim()) return setError('Receiver is required.');
    if (!Number.isInteger(qty) || qty <= 0) return setError('Quantity must be a whole number above 0.');
    if (!dueDate) return setError('A due date is required.');
    setError('');
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        customer: customer.trim(),
        quantity: qty,
        dueDate: fromDateInputValue(dueDate),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="job-name" className="mb-1 block text-sm font-medium">
          Job name
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
        <label htmlFor="job-customer" className="mb-1 block text-sm font-medium">
          Receiver
        </label>
        <input
          id="job-customer"
          className="field"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Who is this for?"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="job-qty" className="mb-1 block text-sm font-medium">
            Quantity
          </label>
          <input
            id="job-qty"
            className="field"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1"
          />
        </div>
        <div>
          <label htmlFor="job-due" className="mb-1 block text-sm font-medium">
            Due date
          </label>
          <input
            id="job-due"
            className="field"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
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
