import { useState, type FormEvent } from 'react';
import type { Material } from '../types';
import type { MaterialInput } from '../services/inventoryService';

export function MaterialForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Material;
  onSubmit: (values: MaterialInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '');
  const [totalQuantity, setTotalQuantity] = useState(initial ? String(initial.totalQuantity) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const parsedQuantity = Number(quantity);
  const parsedTotal = Number(totalQuantity);
  const canSubmit =
    name.trim().length > 0 &&
    unit.trim().length > 0 &&
    quantity.trim().length > 0 &&
    totalQuantity.trim().length > 0 &&
    Number.isFinite(parsedQuantity) &&
    Number.isFinite(parsedTotal) &&
    parsedQuantity >= 0 &&
    parsedTotal > 0 &&
    parsedQuantity <= parsedTotal;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    const total = Number(totalQuantity);
    if (!name.trim()) return setError('Material name is required.');
    if (!unit.trim()) return setError('Unit is required.');
    if (quantity.trim() === '' || !Number.isFinite(qty) || qty < 0) {
      return setError('Current stock must be a valid number and cannot be negative.');
    }
    if (totalQuantity.trim() === '' || !Number.isFinite(total) || total <= 0) {
      return setError('Full stock quantity must be a valid number above zero.');
    }
    if (qty > total) return setError('Current stock cannot be greater than full stock.');
    setError('');
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), unit: unit.trim(), quantity: qty, totalQuantity: total });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="material-name" className="mb-1 block text-sm font-medium">
          Material Name
        </label>
        <input
          id="material-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pin Backs"
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="material-unit" className="mb-1 block text-sm font-medium">
          Unit
        </label>
        <input
          id="material-unit"
          className="field"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="e.g. sheets"
          aria-describedby="material-unit-help"
        />
        <p id="material-unit-help" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Examples: kg, sheets, litres, rolls
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="material-qty" className="mb-1 block text-sm font-medium">
            Current Stock
          </label>
          <input
            id="material-qty"
            className="field"
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label htmlFor="material-total" className="mb-1 block text-sm font-medium">
            Full Stock Quantity
          </label>
          <input
            id="material-total"
            className="field"
            type="number"
            min={0}
            step="any"
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(e.target.value)}
            placeholder="100"
            aria-describedby="material-total-help"
          />
          <p id="material-total-help" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            The amount considered 100% stocked
          </p>
        </div>
      </div>
      {error && <p className="text-sm font-medium text-danger" role="alert">{error}</p>}
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
          {busy ? 'Saving...' : initial ? 'Save Changes' : 'Add Material'}
        </button>
      </div>
    </form>
  );
}
