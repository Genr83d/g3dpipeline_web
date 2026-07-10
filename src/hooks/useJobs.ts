import { useCallback, useEffect, useRef, useState } from 'react';
import { watchJobs } from '../services/jobService';
import type { Job, UserRole } from '../types';

export interface JobsState {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

function errorCode(err: unknown): string {
  if (!err || typeof err !== 'object' || !('code' in err)) return '';
  return typeof err.code === 'string' ? err.code.replace(/^firestore\//, '') : '';
}

/** Fixed user-facing copy: never expose Firebase exception text or index URLs. */
export function jobLoadErrorMessage(err: unknown): string {
  switch (errorCode(err)) {
    case 'permission-denied':
      return 'Your job access changed. Please retry while we reconnect with your current role.';
    case 'failed-precondition':
      return 'The shared job list is temporarily being prepared. Please try again shortly.';
    case 'unavailable':
    case 'deadline-exceeded':
    case 'cancelled':
      return 'Unable to connect to shared jobs. Check your connection and try again.';
    default:
      return 'Unable to load shared jobs right now. Please try again.';
  }
}

/** Live jobs for the current role. `scopeKey` is normally `${uid}:${role}`. */
export function useJobs(enabled: boolean, role: UserRole, scopeKey: string): JobsState {
  const [state, setState] = useState<Omit<JobsState, 'retry'>>({
    jobs: [],
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
      setState({ jobs: [], loading: false, error: null });
      return () => {
        disposed = true;
      };
    }

    setState({ jobs: [], loading: true, error: null });

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = watchJobs(
        role,
        (jobs) => {
          if (!isCurrent()) return;
          setState({ jobs, loading: false, error: null });
        },
        (err) => {
          if (!isCurrent()) return;
          setState({ jobs: [], loading: false, error: jobLoadErrorMessage(err) });
        },
      );
    } catch (err) {
      if (isCurrent()) {
        setState({ jobs: [], loading: false, error: jobLoadErrorMessage(err) });
      }
    }

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [enabled, reload, role, scopeKey]);

  return { ...state, retry };
}
