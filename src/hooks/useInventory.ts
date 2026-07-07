import { useEffect, useState } from 'react';
import { watchInventory } from '../services/inventoryService';
import type { Material } from '../types';

export interface InventoryState {
  materials: Material[];
  loading: boolean;
  error: string | null;
}

export function useInventory(enabled: boolean): InventoryState {
  const [state, setState] = useState<InventoryState>({ materials: [], loading: true, error: null });

  useEffect(() => {
    if (!enabled) return;
    setState({ materials: [], loading: true, error: null });
    return watchInventory(
      (materials) => setState({ materials, loading: false, error: null }),
      (err) => setState({ materials: [], loading: false, error: err.message }),
    );
  }, [enabled]);

  return state;
}
