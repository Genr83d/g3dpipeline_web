import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useInventory } from '../hooks/useInventory';
import {
  addMaterial,
  editMaterial,
  filterMaterials,
  isLowStock,
  stockRatio,
  type MaterialInput,
} from '../services/inventoryService';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { MaterialForm } from '../components/MaterialForm';
import { useToast } from '../components/Toast';
import {
  IconAlert,
  IconClose,
  IconCloudOff,
  IconEdit,
  IconLayers,
  IconSearch,
} from '../components/icons';
import { formatQuantity } from '../lib/format';
import type { Material } from '../types';

/** <30% danger, <50% caution, ≥50% healthy — mirrors the Flutter stock colors. */
function stockColors(ratio: number): { text: string; bar: string } {
  if (ratio < 0.3) return { text: 'text-danger dark:text-red-400', bar: 'bg-danger' };
  if (ratio < 0.5) return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
  return { text: 'text-secondary dark:text-emerald-300', bar: 'bg-secondary' };
}

function MaterialCard({ material, onEdit }: { material: Material; onEdit: (m: Material) => void }) {
  const ratio = stockRatio(material);
  const low = isLowStock(material);
  const colors = stockColors(ratio);
  return (
    <div
      className={`surface space-y-3 p-4 ${
        low ? 'border-2 border-danger/50 dark:border-red-400/40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 font-semibold">{material.name}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatQuantity(material.quantity)} of {formatQuantity(material.totalQuantity)}{' '}
            {material.unit}
          </p>
        </div>
        <button
          type="button"
          aria-label="Edit material"
          title="Edit material"
          className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          onClick={() => onEdit(material)}
        >
          <IconEdit className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={`${material.name} stock level`}
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        >
          <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className={`shrink-0 text-sm font-semibold ${colors.text}`}>
          {Math.round(ratio * 100)}%
        </span>
      </div>
      {low && (
        <p className={`flex items-center gap-1.5 text-sm font-medium ${colors.text}`}>
          <IconAlert className="h-4 w-4" /> Low stock - below 30%
        </p>
      )}
    </div>
  );
}

export default function Inventory() {
  const { isActive, actor } = useAuth();
  const { materials, loading, error } = useInventory(isActive);
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);

  const visible = useMemo(() => filterMaterials(materials, search), [materials, search]);
  const lowCount = useMemo(() => materials.filter(isLowStock).length, [materials]);
  const searching = search.trim().length > 0;

  if (!actor) return null;

  async function save(action: (values: MaterialInput) => Promise<void>, values: MaterialInput) {
    try {
      await action(values);
      setAdding(false);
      setEditing(null);
    } catch {
      toast('Unable to save this material. Check your connection and permissions.', 'error');
    }
  }

  const addButton = (
    <button className="btn-primary" onClick={() => setAdding(true)}>
      <IconLayers className="h-4 w-4" /> Add material
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Connecting…' : 'Live company stock, shared with the mobile app'}
          </p>
        </div>
        {addButton}
      </div>

      {loading ? (
        <div className="flex justify-center py-24" role="status" aria-label="Loading inventory">
          <span
            aria-hidden
            className="h-10 w-10 animate-spin rounded-full border-4 border-primary/25 border-t-primary"
          />
        </div>
      ) : error ? (
        <EmptyState
          icon={<IconCloudOff className="h-7 w-7" />}
          title="Unable to Load Inventory"
          subtitle="Check your internet connection and Firestore permissions."
        />
      ) : (
        <>
          <div className="surface space-y-1 p-4">
            <p className="font-display text-lg font-bold">
              {materials.length} {materials.length === 1 ? 'Material' : 'Materials'}
            </p>
            <p
              className={`flex items-center gap-1.5 text-sm font-medium ${
                lowCount > 0
                  ? 'text-danger dark:text-red-400'
                  : 'text-secondary dark:text-emerald-300'
              }`}
            >
              {lowCount > 0 && <IconAlert className="h-4 w-4" />}
              {lowCount > 0
                ? `${lowCount} below the 30% stock level`
                : 'All materials are sufficiently stocked'}
            </p>
          </div>

          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <label htmlFor="material-search" className="sr-only">
              Search materials
            </label>
            <input
              id="material-search"
              type="search"
              className="field py-2.5 pr-10 pl-9"
              placeholder="Search materials"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searching && (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:hover:text-slate-200"
                onClick={() => setSearch('')}
              >
                <IconClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {materials.length === 0 ? (
            <EmptyState
              icon={<IconLayers className="h-7 w-7" />}
              title="No Materials Yet"
              subtitle="Add the first material to start tracking company stock."
              action={addButton}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<IconSearch className="h-7 w-7" />}
              title="No Matching Materials"
              subtitle="Try searching by material name or unit."
              action={
                <button className="btn-ghost" onClick={() => setSearch('')}>
                  Clear search
                </button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((m) => (
                <MaterialCard key={m.id} material={m} onEdit={setEditing} />
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={adding} title="ADD MATERIAL" onClose={() => setAdding(false)}>
        <MaterialForm
          onSubmit={(values) => save((v) => addMaterial(actor!, v), values)}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <Modal open={editing !== null} title="EDIT MATERIAL" onClose={() => setEditing(null)}>
        {editing && (
          <MaterialForm
            initial={editing}
            onSubmit={(values) => save((v) => editMaterial(actor!, editing.id, v), values)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
