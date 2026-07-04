import { useAuth } from '../../context/AuthProvider';
import { useUsers } from '../../hooks/useUsers';
import { setUserStatus } from '../../services/userService';
import { useToast } from '../../components/Toast';
import { Skeleton } from '../../components/Skeleton';
import { errorMessage } from '../../lib/format';
import { SettingsShell } from './SettingsShell';
import type { AppUser, UserStatus } from '../../types';

const statusStyles: Record<UserStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  active: 'bg-secondary-soft text-secondary dark:bg-emerald-950 dark:text-emerald-300',
  disabled: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  removed: 'bg-danger-soft text-danger dark:bg-red-950 dark:text-red-300',
};

export default function UserManagement() {
  const { authUser, isAdmin } = useAuth();
  const { users, loading, error } = useUsers(isAdmin);
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
    <SettingsShell title="User management" subtitle="Approve and manage staff accounts" wide>
      {error && <p className="text-sm font-medium text-danger" role="alert">{error}</p>}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
        </div>
      ) : (
        <ul className="space-y-3">
          {users.map((user) => (
            <li key={user.uid} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {user.name || user.email}
                  {user.uid === authUser?.uid && (
                    <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                  )}
                </p>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs font-medium text-primary capitalize dark:text-indigo-300">{user.role}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusStyles[user.status]}`}>
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
  );
}
