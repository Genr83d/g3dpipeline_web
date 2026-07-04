import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '../services/authService';
import { errorMessage } from '../lib/format';
import { AuthShell } from './authShared';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="We'll email you a reset link">
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm">
            If an account exists for <strong>{email}</strong>, a password reset link is on its way.
            Check your inbox (and spam folder).
          </p>
          <Link to="/sign-in" className="btn-primary w-full">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
            <input id="email" type="email" className="field" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p className="text-sm font-medium text-danger" role="alert">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="text-center text-sm">
            <Link to="/sign-in" className="font-medium text-primary hover:underline dark:text-indigo-300">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
