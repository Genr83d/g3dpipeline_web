import { useCallback, useEffect, useState } from 'react';
import { watchMachines } from '../services/machineService';
import type { Machine } from '../types';

export interface MachinesState {
  machines: Machine[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useMachines(enabled: boolean): MachinesState {
  const [state, setState] = useState<Omit<MachinesState, 'retry'>>({
    machines: [],
    loading: enabled,
    error: null,
  });
  const [reload, setReload] = useState(0);

  const retry = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setState({ machines: [], loading: false, error: null });
      return;
    }
    setState({ machines: [], loading: true, error: null });
    return watchMachines(
      (machines) => setState({ machines, loading: false, error: null }),
      (err) => setState({ machines: [], loading: false, error: err.message }),
    );
  }, [enabled, reload]);

  return { ...state, retry };
}
