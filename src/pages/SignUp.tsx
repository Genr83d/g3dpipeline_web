import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { signUp } from '../services/authService';
import { errorMessage } from '../lib/format';
import { AuthShell } from './authShared';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Your name is required.');
    setError('');
    setBusy(true);
    try {
      await signUp(name.trim(), email.trim(), password);
      // AuthGate takes over and shows the pending-approval screen.
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create account" subtitle="New accounts need admin approval">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Name</label>
          <input id="name" className="field" autoComplete="name" value={name}
            onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
          <input id="email" type="email" className="field" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</label>
          <input id="password" type="password" className="field" autoComplete="new-password"
            minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="rounded-md border border-danger/20 bg-danger-soft/70 px-3 py-2 text-sm font-medium text-danger dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link to="/sign-in" className="font-medium text-primary hover:underline dark:text-indigo-300">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
