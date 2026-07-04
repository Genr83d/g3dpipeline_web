import { signOut } from '../services/authService';
import { AuthShell } from './authShared';
import { IconClock, IconAlert } from '../components/icons';

export function PendingApproval() {
  return (
    <AuthShell title="Account pending" subtitle="Waiting on admin approval">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
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
        <div className="flex items-start gap-3 rounded-xl bg-danger-soft p-3 text-danger dark:bg-red-950 dark:text-red-200">
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
