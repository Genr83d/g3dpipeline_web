import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { watchUser } from '../services/userService';
import { deriveFirstName } from '../services/authService';
import type { AppUser } from '../types';
import type { Actor, Assigner } from '../services/jobService';

export interface AuthState {
  /** undefined = still resolving */
  authUser: User | null | undefined;
  /** Live users/{uid} doc; null = signed in but no doc yet; undefined = loading */
  profile: AppUser | null | undefined;
  /** True when the profile read failed rather than finding no document. The
   *  two are not the same: a missing doc means a brand-new sign-up awaiting
   *  approval, while a failed read tells us nothing about the account. */
  profileError: boolean;
  firstName: string;
  isActive: boolean;
  isAdmin: boolean;
  isManagerOrAdmin: boolean;
  actor: Actor | null;
  /** Identity as stored in the live /users doc — the exact values assignment rules verify. */
  assigner: Assigner | null;
}

const AuthContext = createContext<AuthState>({
  authUser: undefined,
  profile: undefined,
  profileError: false,
  firstName: '',
  isActive: false,
  isAdmin: false,
  isManagerOrAdmin: false,
  actor: null,
  assigner: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<AppUser | null | undefined>(undefined);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setAuthUser), []);

  useEffect(() => {
    if (!authUser) {
      setProfile(authUser === null ? null : undefined);
      setProfileError(false);
      return;
    }
    let disposed = false;
    setProfile(undefined);
    setProfileError(false);
    const unsubscribe = watchUser(
      authUser.uid,
      (user) => {
        if (disposed) return;
        setProfile(user);
        setProfileError(false);
      },
      () => {
        if (disposed) return;
        setProfile(null);
        setProfileError(true);
      },
    );
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [authUser]);

  const value = useMemo<AuthState>(() => {
    const firstName = authUser ? deriveFirstName(authUser) : '';
    const isActive = profile?.status === 'active';
    const isAdmin = isActive && profile?.role === 'admin';
    const isManagerOrAdmin = isActive && (profile?.role === 'manager' || profile?.role === 'admin');
    const displayName = profile?.name || authUser?.displayName?.trim() || authUser?.email || firstName;
    const actor: Actor | null =
      authUser && isActive
        ? { uid: authUser.uid, firstName, displayName, email: authUser.email ?? '' }
        : null;
    const assigner: Assigner | null =
      profile && isActive ? { uid: profile.uid, name: profile.name, role: profile.role } : null;
    return {
      authUser,
      profile,
      profileError,
      firstName,
      isActive,
      isAdmin,
      isManagerOrAdmin,
      actor,
      assigner,
    };
  }, [authUser, profile, profileError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
