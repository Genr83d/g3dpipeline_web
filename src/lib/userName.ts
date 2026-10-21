import type { AppUser } from '../types';
import type { Actor } from '../services/jobService';

/** What to call an account: its name, or its email until it has one. */
export function userDisplayName(user: Pick<AppUser, 'name' | 'email'>): string {
  return user.name.trim() || user.email;
}

/** What to call the signed-in person on what they write. */
export function actorDisplayName(actor: Actor): string {
  return actor.displayName?.trim() || actor.firstName || actor.email || 'User';
}
