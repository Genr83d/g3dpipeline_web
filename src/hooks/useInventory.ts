import { useCallback, useEffect, useRef, useState } from 'react';
import { watchInventory } from '../services/inventoryService';
import type { Material } from '../types';

export interface InventoryState {
  materials: Material[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** `scopeKey` lets a live role change dispose and recreate this listener. */
export function useInventory(enabled: boolean, scopeKey = ''): InventoryState {
  const [state, setState] = useState<Omit<InventoryState, 'retry'>>({
    materials: [],
    loading: enabled,
    error: null,
  });
  const [reload, setReload] = useState(0);
  const generationRef = useRef(0);

  const retry = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    const generation = ++generationRef.current;
    let disposed = false;
    const isCurrent = () => !disposed && generationRef.current === generation;

    if (!enabled) {
      setState({ materials: [], loading: false, error: null });
      return () => {
        disposed = true;
      };
    }

    setState({ materials: [], loading: true, error: null });

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = watchInventory(
        (materials) => {
          if (!isCurrent()) return;
          setState({ materials, loading: false, error: null });
        },
        () => {
          if (!isCurrent()) return;
          setState({
            materials: [],
            loading: false,
            error: 'Unable to load inventory. Check your connection and try again.',
          });
        },
      );
    } catch {
      if (isCurrent()) {
        setState({
          materials: [],
          loading: false,
          error: 'Unable to load inventory. Check your connection and try again.',
        });
      }
    }

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [enabled, reload, scopeKey]);

  return { ...state, retry };
}
