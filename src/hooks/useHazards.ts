import { useCallback, useEffect, useRef, useState } from 'react';
import { watchHazards } from '../services/hazardService';
import type { Hazard } from '../types';

export interface HazardsState {
  hazards: Hazard[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** `scopeKey` lets a live role change dispose and recreate this listener. */
export function useHazards(enabled: boolean, scopeKey = ''): HazardsState {
  const [state, setState] = useState<Omit<HazardsState, 'retry'>>({
    hazards: [],
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
      setState({ hazards: [], loading: false, error: null });
      return () => {
        disposed = true;
      };
    }

    setState({ hazards: [], loading: true, error: null });

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = watchHazards(
        (hazards) => {
          if (!isCurrent()) return;
          setState({ hazards, loading: false, error: null });
        },
        () => {
          if (!isCurrent()) return;
          setState({
            hazards: [],
            loading: false,
            error: 'Unable to load hazard reports. Check your connection and try again.',
          });
        },
      );
    } catch {
      if (isCurrent()) {
        setState({
          hazards: [],
          loading: false,
          error: 'Unable to load hazard reports. Check your connection and try again.',
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
