import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useInventoryOutlet } from '../routes/Workspace';
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
import { PageHeader } from '../components/PageHeader';
import { MaterialCardSkeleton, Skeleton } from '../components/Skeleton';
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
      className={`surface surface-hover space-y-4 p-4 ${
        low ? 'border-2 border-danger/50 dark:border-red-400/40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="technical-label">Material</p>
          <p className="line-clamp-2 font-display text-lg font-bold text-ink dark:text-slate-50">{material.name}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {formatQuantity(material.quantity)} of {formatQuantity(material.totalQuantity)}{' '}
            {material.unit}
          </p>
        </div>
        <button
          type="button"
          aria-label="Edit material"
          title="Edit material"
          className="shrink-0 rounded-md border border-slate-200/70 bg-white/45 p-2 text-slate-500 transition-colors hover:bg-white/80 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:border-slate-800/80 dark:bg-slate-950/20 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
          className="h-2.5 flex-1 overflow-hidden rounded-full border border-slate-200/70 bg-slate-200/80 dark:border-slate-800 dark:bg-slate-950/60"
        >
          <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className={`shrink-0 text-sm font-semibold ${colors.text}`}>
          {Math.round(ratio * 100)}%
        </span>
      </div>
      {low && (
        <p className={`flex items-center gap-1.5 rounded-md border border-danger/20 bg-danger-soft/60 px-3 py-2 text-sm font-semibold dark:bg-red-950/30 ${colors.text}`}>
          <IconAlert className="h-4 w-4" /> Low stock - below 30%
        </p>
      )}
    </div>
  );
}

export default function Inventory() {
  const { actor } = useAuth();
  const { materials, loading, error, retry } = useInventoryOutlet();
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
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        eyebrow="Materials control"
        subtitle={loading ? 'Connecting to stock records...' : 'Live company stock, shared with the mobile app'}
        actions={addButton}
      />

      {loading ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-11" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MaterialCardSkeleton />
            <MaterialCardSkeleton />
            <MaterialCardSkeleton />
          </div>
        </>
      ) : error ? (
        <EmptyState
          icon={<IconCloudOff className="h-7 w-7" />}
          title="Unable to Load Inventory"
          subtitle="Check your internet connection and Firestore permissions."
          action={
            <button className="btn-secondary" onClick={retry}>
              Retry
            </button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface px-4 py-3">
              <p className="technical-label">Materials tracked</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {materials.length}
              </p>
            </div>
            <div className="surface px-4 py-3">
              <p className="technical-label">Stock alerts</p>
              <p
                className={`flex items-center gap-2 font-display text-2xl font-bold tabular-nums ${
                  lowCount > 0
                    ? 'text-danger dark:text-red-400'
                    : 'text-secondary dark:text-emerald-300'
                }`}
              >
                {lowCount > 0 && <IconAlert className="h-5 w-5" />}
                {lowCount}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {lowCount > 0
                  ? 'Below the 30% stock level'
                  : 'All materials are sufficiently stocked'}
              </p>
            </div>
          </div>

          <div className="surface relative p-2">
            <IconSearch className="pointer-events-none absolute top-1/2 left-5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <label htmlFor="material-search" className="sr-only">
              Search materials
            </label>
            <input
              id="material-search"
              type="search"
              className="field border-transparent py-2.5 pr-10 pl-9"
              placeholder="Search materials"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searching && (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                className="absolute top-1/2 right-4 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((m) => (
                <MaterialCard key={m.id} material={m} onEdit={setEditing} />
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={adding} title="Add material" onClose={() => setAdding(false)}>
        <MaterialForm
          onSubmit={(values) => save((v) => addMaterial(actor!, v), values)}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <Modal open={editing !== null} title="Edit material" onClose={() => setEditing(null)}>
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
