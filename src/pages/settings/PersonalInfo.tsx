import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { updateProfile } from '../../services/userService';
import { useToast } from '../../components/Toast';
import { errorMessage } from '../../lib/format';
import { SettingsShell } from './SettingsShell';

const fields = [
  { key: 'firstName', label: 'First name', autoComplete: 'given-name' },
  { key: 'lastName', label: 'Last name', autoComplete: 'family-name' },
  { key: 'fullName', label: 'Full name', autoComplete: 'name' },
  { key: 'phoneNumber', label: 'Phone number', autoComplete: 'tel' },
  { key: 'jobTitle', label: 'Job title', autoComplete: 'organization-title' },
  { key: 'department', label: 'Department', autoComplete: 'off' },
] as const;

type Key = (typeof fields)[number]['key'];

export default function PersonalInfo() {
  const { authUser, profile } = useAuth();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<Key, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, profile?.[f.key] ?? ''])) as Record<Key, string>,
  );
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!authUser) return;
    setBusy(true);
    try {
      await updateProfile(
        authUser.uid,
        Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])),
      );
      toast('Personal information saved.', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsShell title="Personal information" subtitle="Optional details on your profile">
      <form onSubmit={handleSubmit} className="surface space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.key === 'fullName' ? 'sm:col-span-2' : ''}>
              <label htmlFor={f.key} className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">{f.label}</label>
              <input
                id={f.key}
                className="field"
                autoComplete={f.autoComplete}
                value={values[f.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </SettingsShell>
  );
}
