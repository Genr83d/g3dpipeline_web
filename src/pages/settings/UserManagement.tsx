import { useAuth } from '../../context/AuthProvider';
import { useUsers } from '../../hooks/useUsers';
import { setUserStatus } from '../../services/userService';
import { useToast } from '../../components/Toast';
import { TableRowSkeleton } from '../../components/Skeleton';
import { errorMessage } from '../../lib/format';
import { SettingsShell } from './SettingsShell';
import { roleLabel, roleScopeKey } from '../../lib/roles';
import type { AppUser, UserStatus } from '../../types';

const statusStyles: Record<UserStatus, string> = {
  pending: 'border-amber-400/35 bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
  active: 'border-secondary/35 bg-secondary-soft text-secondary dark:bg-emerald-950/80 dark:text-emerald-300',
  disabled: 'border-slate-300 bg-slate-200 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  removed: 'border-danger/30 bg-danger-soft text-danger dark:bg-red-950/80 dark:text-red-300',
};

export default function UserManagement() {
  const { authUser, profile, isAdmin } = useAuth();
  const { users, loading, error } = useUsers(
    isAdmin,
    profile ? roleScopeKey(profile.uid, profile.role) : '',
  );
  const { toast } = useToast();

  async function change(user: AppUser, status: UserStatus, verb: string) {
    try {
      await setUserStatus(user.uid, status);
      toast(`${user.name || user.email} ${verb}.`, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  function actionsFor(user: AppUser) {
    // Rules: admins can't edit other admins or themselves.
    if (user.role === 'admin' || user.uid === authUser?.uid) return null;
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {user.status === 'pending' && (
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void change(user, 'active', 'approved')}>
            Approve
          </button>
        )}
        {(user.status === 'disabled' || user.status === 'removed') && (
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void change(user, 'active', 'restored')}>
            Restore
          </button>
        )}
        {user.status === 'active' && (
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => void change(user, 'disabled', 'disabled')}>
            Disable
          </button>
        )}
        {user.status !== 'removed' && (
          <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => void change(user, 'removed', 'removed')}>
            Remove
          </button>
        )}
      </div>
    );
  }

  return (
    <div data-tour="user-management">
    <SettingsShell title="User management" subtitle="Approve and manage user accounts" wide>
      {error && (
        <p className="rounded-md border border-danger/20 bg-danger-soft/70 px-3 py-2 text-sm font-medium text-danger dark:bg-red-950/40 dark:text-red-300" role="alert">
          Unable to load user accounts. Check your connection and permissions, then try again.
        </p>
      )}
      {loading ? (
        <div className="space-y-3">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      ) : (
        <ul className="space-y-3">
          {users.map((user) => (
            <li key={user.uid} className="surface surface-hover flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {user.name || user.email}
                  {user.uid === authUser?.uid && (
                    <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                  )}
                </p>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs font-medium text-primary dark:text-indigo-300">{roleLabel(user.role)}</span>
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${statusStyles[user.status]}`}>
                    {user.status}
                  </span>
                </div>
              </div>
              {actionsFor(user)}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Roles can only be changed in the Firebase Console; the app never writes roles.
      </p>
    </SettingsShell>
    </div>
  );
}
