import { useEffect, useState } from 'react';
import { FormError } from './FormError';
import { Modal } from './Modal';
import { Skeleton } from './Skeleton';
import { roleLabel } from '../lib/roles';
import { userDisplayName } from '../lib/userName';
import { watchActiveUsers } from '../services/userService';
import type { AppUser } from '../types';

/** Active accounts something can be handed to, live while the picker is open. */
export function useActiveUsers(enabled: boolean): {
  users: AppUser[];
  loading: boolean;
  error: boolean;
} {
  const [state, setState] = useState({ users: [] as AppUser[], loading: true, error: false });
  useEffect(() => {
    if (!enabled) return;
    setState({ users: [], loading: true, error: false });
    return watchActiveUsers(
      (users) => setState({ users, loading: false, error: false }),
      () => setState({ users: [], loading: false, error: true }),
    );
  }, [enabled]);
  return state;
}

/** Picks an active person, or clears the current assignment. Shared by hazards
 *  and machine repairs. */
export function AssignUserModal({
  open,
  title,
  subtitle,
  assignedToUid,
  assignedToName,
  busy,
  onAssign,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  /** '' while nobody is assigned. */
  assignedToUid: string;
  assignedToName: string;
  busy: boolean;
  onAssign: (assignee: AppUser | null) => void;
  onClose: () => void;
}) {
  const { users, loading, error } = useActiveUsers(open);
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : error ? (
          <FormError message="Unable to load people. Check your connection." />
        ) : (
          <ul className="divide-y divide-[var(--rule)] rounded border border-[var(--rule)]" aria-label="Active people">
            {assignedToUid && (
              <li>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-500/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  onClick={() => onAssign(null)}
                >
                  <span className="font-semibold text-amber-700 dark:text-amber-300">Unassign</span>
                  <span className="truncate text-xs text-slate-500">Currently {assignedToName}</span>
                </button>
              </li>
            )}
            {users.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-slate-500">No active accounts to assign.</li>
            )}
            {users.map((user) => (
              <li key={user.uid}>
                <button
                  type="button"
                  disabled={busy}
                  aria-current={user.uid === assignedToUid ? 'true' : undefined}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-500/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  onClick={() => onAssign(user)}
                >
                  <span className="min-w-0 truncate font-semibold">{userDisplayName(user)}</span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {user.uid === assignedToUid ? 'Assigned · ' : ''}
                    {roleLabel(user.role)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
