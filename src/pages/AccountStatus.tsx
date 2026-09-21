import { signOut } from '../services/authService';
import { AuthShell } from './authShared';
import { IconAlert, IconClock, IconCloudOff } from '../components/icons';

export function PendingApproval() {
  return (
    <AuthShell title="Account pending" subtitle="Waiting on admin approval">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-amber-300/40 bg-amber-50/80 p-3 text-amber-800 dark:border-amber-400/20 dark:bg-amber-950/45 dark:text-amber-200">
          <IconClock className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">
            Your account was created and is waiting for an administrator to approve it. This page
            updates automatically the moment you're approved — no need to refresh.
          </p>
        </div>
        <button className="btn-ghost w-full" onClick={() => void signOut()}>Sign out</button>
      </div>
    </AuthShell>
  );
}

export function AccountInactive() {
  return (
    <AuthShell title="Account inactive" subtitle="Access has been turned off">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-danger/20 bg-danger-soft/80 p-3 text-danger dark:border-red-400/20 dark:bg-red-950/45 dark:text-red-200">
          <IconAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">
            This account has been disabled or removed. If you think this is a mistake, contact a
            GENR8 administrator.
          </p>
        </div>
        <button className="btn-ghost w-full" onClick={() => void signOut()}>Sign out</button>
      </div>
    </AuthShell>
  );
}

/** Shown when the profile read failed outright. Telling an approved user that
 *  their account is "pending approval" because the database was unreachable
 *  sends them to an administrator who has nothing to fix, so a failed read
 *  gets its own screen with a way to retry. */
export function AccountUnavailable() {
  return (
    <AuthShell title="Account unavailable" subtitle="We could not load your account">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-amber-300/40 bg-amber-50/80 p-3 text-amber-800 dark:border-amber-400/20 dark:bg-amber-950/45 dark:text-amber-200">
          <IconCloudOff className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">
            Your account details could not be loaded. This is usually a connection problem, not a
            problem with your account. Check your connection and try again.
          </p>
        </div>
        <button className="btn-primary w-full" onClick={() => window.location.reload()}>
          Try again
        </button>
        <button className="btn-ghost w-full" onClick={() => void signOut()}>Sign out</button>
      </div>
    </AuthShell>
  );
}
