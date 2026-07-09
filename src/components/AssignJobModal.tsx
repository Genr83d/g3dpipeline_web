import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthProvider';
import { watchAssignableUsers } from '../services/userService';
import { IconClose, IconPlus } from './icons';
import type { AssignTarget } from '../services/jobService';
import type { AppUser, Job, UserRole } from '../types';

const roleLabels: Record<UserRole, string> = {
  staff: 'Staff',
  manager: 'Manager',
  admin: 'Admin',
};

const adminRoles: UserRole[] = ['staff', 'manager', 'admin'];

interface SelectedCollaborator extends AssignTarget {
  email?: string;
}

function collaboratorName(collaborator: { name?: string; email?: string }): string {
  return collaborator.name?.trim() || collaborator.email?.trim() || 'User';
}

function saveErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code ?? '';
    if (code === 'permission-denied') return 'Your role cannot change this assignment.';
    if (err.message === 'Add at least one collaborator.') return err.message;
  }
  return 'Unable to update this assignment. It may have changed.';
}

export function AssignJobModal({
  job,
  onSave,
  onClear,
  onClose,
}: {
  job: Job | null;
  onSave: (job: Job, collaborators: AssignTarget[]) => Promise<void>;
  onClear: (job: Job) => Promise<void>;
  onClose: () => void;
}) {
  const { isAdmin } = useAuth();
  const [role, setRole] = useState<UserRole>('staff');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [selected, setSelected] = useState<SelectedCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const allowedRoles = useMemo(() => (isAdmin ? adminRoles : (['staff'] as UserRole[])), [isAdmin]);
  const canClear =
    job !== null && (job.collaborators.length > 0 || job.assignedToUid.trim().length > 0);

  useEffect(() => {
    if (!job) return;
    setRole('staff');
    setSelected(job.collaborators.map((c) => ({ ...c })));
    setSelectedUid('');
    setLoadError(null);
    setSaveError(null);
    setSaving(false);
    setClearing(false);
  }, [job]);

  useEffect(() => {
    if (!job) return;
    setUsers([]);
    setSelectedUid('');
    setLoading(true);
    setLoadError(null);
    return watchAssignableUsers(
      role,
      (u) => {
        setUsers(u);
        setLoading(false);
      },
      () => {
        setLoadError('Unable to load eligible users. Check your permissions and try again.');
        setLoading(false);
      },
    );
  }, [job, role]);

  const availableUsers = users.filter((user) => !selected.some((c) => c.uid === user.uid));

  function addSelected() {
    const user = users.find((u) => u.uid === selectedUid);
    if (!user) return;
    if (selected.some((c) => c.uid === user.uid)) {
      setSaveError(`${collaboratorName(user)} is already a collaborator.`);
      return;
    }
    setSelected((prev) => [
      ...prev,
      {
        uid: user.uid,
        name: collaboratorName(user),
        email: user.email,
        role: user.role,
      },
    ]);
    setSelectedUid('');
    setSaveError(null);
  }

  async function handleSave() {
    if (!job) return;
    if (selected.length === 0) {
      setSaveError('Add at least one collaborator.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(
        job,
        selected.map((c) => ({ uid: c.uid, name: c.name, role: c.role })),
      );
    } catch (err) {
      setSaveError(saveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!job) return;
    setClearing(true);
    setSaveError(null);
    try {
      await onClear(job);
    } catch (err) {
      setSaveError(saveErrorMessage(err));
    } finally {
      setClearing(false);
    }
  }

  return (
    <Modal
      open={job !== null}
      title={job?.collaborators.length ? 'Edit Collaborators' : 'Add Collaborators'}
      onClose={onClose}
    >
      {job && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <strong className="text-slate-700 dark:text-slate-200">{job.name}</strong> for{' '}
            {job.customer}
          </p>

          <div>
            <label htmlFor="assign-role" className="mb-1 block text-sm font-medium">
              Role
            </label>
            <select
              id="assign-role"
              className="field"
              value={role}
              disabled={!isAdmin || saving || clearing}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="assign-user" className="block text-sm font-medium">
              Active Users
            </label>
            {loadError ? (
              <p className="text-sm font-medium text-danger" role="alert">
                {loadError}
              </p>
            ) : loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No active {roleLabels[role].toLowerCase()} users to assign.
              </p>
            ) : (
              <div className="flex gap-2">
                <select
                  id="assign-user"
                  className="field"
                  value={selectedUid}
                  disabled={saving || clearing || availableUsers.length === 0}
                  onChange={(e) => setSelectedUid(e.target.value)}
                >
                  <option value="">
                    {availableUsers.length === 0 ? 'All users added' : 'Select user'}
                  </option>
                  {availableUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {collaboratorName(u)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary shrink-0 px-3"
                  disabled={!selectedUid || saving || clearing}
                  onClick={addSelected}
                >
                  <IconPlus className="h-4 w-4" /> Add
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Selected Collaborators</p>
            {selected.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No collaborators selected.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selected.map((collaborator) => (
                  <span
                    key={collaborator.uid}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-sm font-semibold text-primary dark:border-indigo-300/20 dark:bg-indigo-950 dark:text-indigo-200"
                  >
                    <span className="truncate">
                      {collaboratorName(collaborator)} ({roleLabels[collaborator.role]})
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${collaboratorName(collaborator)}`}
                      title="Remove collaborator"
                      disabled={saving || clearing}
                      className="rounded-full p-0.5 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() =>
                        setSelected((prev) => prev.filter((c) => c.uid !== collaborator.uid))
                      }
                    >
                      <IconClose className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {saveError && (
            <p className="text-sm font-medium text-danger" role="alert">
              {saveError}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {canClear && (
              <button
                type="button"
                className="btn-secondary"
                disabled={saving || clearing}
                onClick={() => void handleClear()}
              >
                {clearing ? 'Clearing...' : 'Clear Collaborators'}
              </button>
            )}
            <button type="button" className="btn-ghost" disabled={saving || clearing} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={saving || clearing || selected.length === 0}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving...' : 'Save Collaborators'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
