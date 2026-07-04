import { useEffect, useState } from 'react';
import { watchAllUsers } from '../services/userService';
import type { AppUser } from '../types';

export interface UsersState {
  users: AppUser[];
  loading: boolean;
  error: string | null;
}

export function useUsers(enabled: boolean): UsersState {
  const [state, setState] = useState<UsersState>({ users: [], loading: true, error: null });

  useEffect(() => {
    if (!enabled) return;
    setState({ users: [], loading: true, error: null });
    return watchAllUsers(
      (users) => setState({ users, loading: false, error: null }),
      (err) => setState({ users: [], loading: false, error: err.message }),
    );
  }, [enabled]);

  return state;
}
