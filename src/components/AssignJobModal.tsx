import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthProvider';
import { watchAssignableUsers } from '../services/userService';
import type { AppUser, Job, UserRole } from '../types';

const roleLabels: Record<UserRole, string> = {
  staff: 'Staff',
  manager: 'Manager',
  admin: 'Admin',
};

const adminRoles: UserRole[] = ['staff', 'manager', 'admin'];

export function AssignJobModal({
  job,
  onAssign,
  onUnassign,
  onClose,
}: {
  job: Job | null;
  onAssign: (job: Job, target: AppUser) => void;
  onUnassign: (job: Job) => void;
  onClose: () => void;
}) {
  const { isAdmin } = useAuth();
  const [role, setRole] = useState<UserRole>('staff');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Managers may only see active Staff; reset the role each time the modal opens.
  useEffect(() => {
    if (job) setRole('staff');
  }, [job]);

  useEffect(() => {
    if (!job) return;
    setUsers([]);
    setLoading(true);
    setError(null);
    return watchAssignableUsers(
      role,
      (u) => {
        setUsers(u);
        setLoading(false);
      },
      () => {
        setError('Could not load users. Your permissions may have changed.');
        setLoading(false);
      },
    );
  }, [job, role]);

  const canUnassign = job?.status === 'pending' && job.assignedToUid !== '';

  return (
    <Modal open={job !== null} title={job?.assignedToUid ? 'Reassign job' : 'Assign job'} onClose={onClose}>
      {job && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <strong className="text-slate-700 dark:text-slate-200">{job.name}</strong> for {job.customer}
            {job.assignedToName ? ` — currently assigned to ${job.assignedToName}` : ' — currently unassigned'}
          </p>

          <div>
            <label htmlFor="assign-role" className="mb-1 block text-sm font-medium">Role</label>
            <select
              id="assign-role"
              className="field"
              value={role}
              disabled={!isAdmin}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {(isAdmin ? adminRoles : (['staff'] as UserRole[])).map((r) => (
                <option key={r} value={r}>{roleLabels[r]}</option>
              ))}
            </select>
          </div>

          {error ? (
            <p className="text-sm font-medium text-danger" role="alert">{error}</p>
          ) : loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No active {roleLabels[role].toLowerCase()} users to assign.
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {users.map((u) => (
                <li key={u.uid}>
                  <button
                    className="btn-ghost w-full justify-between"
                    onClick={() => onAssign(job, u)}
                  >
                    <span className="truncate">{u.name || u.email}</span>
                    {u.uid === job.assignedToUid && (
                      <span className="text-xs text-slate-400">current</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2">
            {canUnassign && (
              <button className="btn-secondary" onClick={() => onUnassign(job)}>
                Leave unassigned
              </button>
            )}
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
