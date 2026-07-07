import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useInventory } from '../hooks/useInventory';
import { filterMaterials } from '../services/inventoryService';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { IconClose, IconLayers, IconSearch } from '../components/icons';
import type { Material } from '../types';

function stockTone(m: Material): string {
  if (m.quantity <= 0) return 'text-danger';
  if (m.totalQuantity > 0 && m.quantity / m.totalQuantity <= 0.2) {
    return 'text-amber-600 dark:text-amber-400';
  }
  return 'text-slate-900 dark:text-slate-100';
}

function MaterialCard({ material }: { material: Material }) {
  return (
    <div className="surface flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="truncate font-semibold">{material.name}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{material.unit}</p>
      </div>
      <p className={`shrink-0 text-right font-display text-lg font-bold ${stockTone(material)}`}>
        {material.quantity}
        {material.totalQuantity > 0 && (
          <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
            {' '}/ {material.totalQuantity}
          </span>
        )}
      </p>
    </div>
  );
}

export default function Materials() {
  const { isActive } = useAuth();
  const { materials, loading, error } = useInventory(isActive);
  const [search, setSearch] = useState('');

  const visible = useMemo(() => filterMaterials(materials, search), [materials, search]);
  const searching = search.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Materials</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading
              ? 'Connecting…'
              : `${visible.length} material${visible.length === 1 ? '' : 's'}${searching ? ' matching your search' : ' in inventory'}`}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <label htmlFor="material-search" className="sr-only">Search materials</label>
          <input
            id="material-search"
            type="search"
            className="field py-2 pr-9 pl-9"
            placeholder="Search by name or unit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {searching && (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:hover:text-slate-200"
              onClick={() => setSearch('')}
            >
              <IconClose className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-danger" role="alert">{error}</p>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<IconLayers className="h-7 w-7" />}
          title={searching ? 'No materials match' : 'Inventory is empty'}
          subtitle={
            searching
              ? `Nothing matches “${search.trim()}”. Try a different name or unit.`
              : 'Materials added to the inventory will show up here in real time.'
          }
          action={
            searching ? (
              <button className="btn-ghost" onClick={() => setSearch('')}>Clear search</button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => (
            <MaterialCard key={m.id} material={m} />
          ))}
        </div>
      )}
    </div>
  );
}
