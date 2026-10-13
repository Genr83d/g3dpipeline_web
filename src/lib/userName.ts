import type { AppUser } from '../types';

/** What to call an account: its name, or its email until it has one. */
export function userDisplayName(user: Pick<AppUser, 'name' | 'email'>): string {
  return user.name.trim() || user.email;
}
