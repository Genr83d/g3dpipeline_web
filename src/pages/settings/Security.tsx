import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { changePassword, resetPassword } from '../../services/authService';
import { useToast } from '../../components/Toast';
import { errorMessage } from '../../lib/format';
import { SettingsShell } from './SettingsShell';

export default function Security() {
  const { authUser } = useAuth();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleChange(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast('New passwords do not match.', 'error');
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      toast('Password changed.', 'success');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!authUser?.email) return;
    try {
      await resetPassword(authUser.email);
      toast(`Reset link sent to ${authUser.email}.`, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <SettingsShell title="Security" subtitle="Keep your account locked down">
      <form onSubmit={handleChange} className="surface space-y-4 p-5">
        <h2 className="font-display font-bold">Change password</h2>
        <div>
          <label htmlFor="current" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Current password</label>
          <input id="current" type="password" className="field" autoComplete="current-password"
            value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="next" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">New password</label>
            <input id="next" type="password" className="field" autoComplete="new-password"
              minLength={6} value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Confirm new password</label>
            <input id="confirm" type="password" className="field" autoComplete="new-password"
              minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Updating…' : 'Change password'}
          </button>
        </div>
      </form>

      <div className="surface flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-display font-bold">Password reset email</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Prefer a link? We'll email one to {authUser?.email}.
          </p>
        </div>
        <button className="btn-secondary" onClick={() => void handleReset()}>Send reset link</button>
      </div>
    </SettingsShell>
  );
}
