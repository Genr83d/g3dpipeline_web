import { useCallback, useEffect, useRef, useState } from 'react';
import { watchMachines } from '../services/machineService';
import type { Machine } from '../types';

export interface MachinesState {
  machines: Machine[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** `scopeKey` lets a live role change dispose and recreate this listener. */
export function useMachines(enabled: boolean, scopeKey = ''): MachinesState {
  const [state, setState] = useState<Omit<MachinesState, 'retry'>>({
    machines: [],
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
      setState({ machines: [], loading: false, error: null });
      return () => {
        disposed = true;
      };
    }

    setState({ machines: [], loading: true, error: null });

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = watchMachines(
        (machines) => {
          if (!isCurrent()) return;
          setState({ machines, loading: false, error: null });
        },
        () => {
          if (!isCurrent()) return;
          setState({
            machines: [],
            loading: false,
            error: 'Unable to load maintenance records. Check your connection and try again.',
          });
        },
      );
    } catch {
      if (isCurrent()) {
        setState({
          machines: [],
          loading: false,
          error: 'Unable to load maintenance records. Check your connection and try again.',
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
