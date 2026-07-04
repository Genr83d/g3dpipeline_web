import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { watchUser } from '../services/userService';
import { deriveFirstName } from '../services/authService';
import type { AppUser } from '../types';
import type { Actor } from '../services/jobService';

export interface AuthState {
  /** undefined = still resolving */
  authUser: User | null | undefined;
  /** Live users/{uid} doc; null = signed in but no doc yet; undefined = loading */
  profile: AppUser | null | undefined;
  firstName: string;
  isActive: boolean;
  isAdmin: boolean;
  isManagerOrAdmin: boolean;
  actor: Actor | null;
}

const AuthContext = createContext<AuthState>({
  authUser: undefined,
  profile: undefined,
  firstName: '',
  isActive: false,
  isAdmin: false,
  isManagerOrAdmin: false,
  actor: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<AppUser | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, setAuthUser), []);

  useEffect(() => {
    if (!authUser) {
      setProfile(authUser === null ? null : undefined);
      return;
    }
    setProfile(undefined);
    return watchUser(
      authUser.uid,
      setProfile,
      () => setProfile(null),
    );
  }, [authUser]);

  const value = useMemo<AuthState>(() => {
    const firstName = authUser ? deriveFirstName(authUser) : '';
    const isActive = profile?.status === 'active';
    const isAdmin = isActive && profile?.role === 'admin';
    const isManagerOrAdmin = isActive && (profile?.role === 'manager' || profile?.role === 'admin');
    const actor: Actor | null =
      authUser && isActive ? { uid: authUser.uid, firstName, email: authUser.email ?? '' } : null;
    return { authUser, profile, firstName, isActive, isAdmin, isManagerOrAdmin, actor };
  }, [authUser, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
