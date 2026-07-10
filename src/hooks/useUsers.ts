import { useEffect, useRef, useState } from 'react';
import { watchAllUsers } from '../services/userService';
import type { AppUser } from '../types';

export interface UsersState {
  users: AppUser[];
  loading: boolean;
  error: string | null;
}

export function useUsers(enabled: boolean, scopeKey = ''): UsersState {
  const [state, setState] = useState<UsersState>({
    users: [],
    loading: enabled,
    error: null,
  });
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    let disposed = false;
    const isCurrent = () => !disposed && generationRef.current === generation;

    if (!enabled) {
      setState({ users: [], loading: false, error: null });
      return () => {
        disposed = true;
      };
    }

    setState({ users: [], loading: true, error: null });

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = watchAllUsers(
        (users) => {
          if (!isCurrent()) return;
          setState({ users, loading: false, error: null });
        },
        () => {
          if (!isCurrent()) return;
          setState({
            users: [],
            loading: false,
            error: 'Unable to load user accounts. Check your connection and permissions.',
          });
        },
      );
    } catch {
      if (isCurrent()) {
        setState({
          users: [],
          loading: false,
          error: 'Unable to load user accounts. Check your connection and permissions.',
        });
      }
    }

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [enabled, scopeKey]);

  return state;
}
