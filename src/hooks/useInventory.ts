import { useCallback, useEffect, useState } from 'react';
import { watchInventory } from '../services/inventoryService';
import type { Material } from '../types';

export interface InventoryState {
  materials: Material[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useInventory(enabled: boolean): InventoryState {
  const [state, setState] = useState<Omit<InventoryState, 'retry'>>({
    materials: [],
    loading: enabled,
    error: null,
  });
  const [reload, setReload] = useState(0);

  const retry = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setState({ materials: [], loading: false, error: null });
      return;
    }
    setState({ materials: [], loading: true, error: null });
    return watchInventory(
      (materials) => setState({ materials, loading: false, error: null }),
      (err) => setState({ materials: [], loading: false, error: err.message }),
    );
  }, [enabled, reload]);

  return { ...state, retry };
}
