import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthProvider';
import { PendingApproval, AccountInactive } from '../pages/AccountStatus';
import { BrandMark } from '../components/BrandMark';
import { Skeleton } from '../components/Skeleton';

function FullPageLoader() {
  return (
    <div className="auth-backdrop flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <div className="surface flex h-16 w-16 items-center justify-center p-2">
        <BrandMark className="h-full w-full" />
      </div>
      <div className="w-full max-w-xs space-y-3" aria-label="Loading account">
        <Skeleton className="mx-auto h-4 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Wraps the signed-in app: pending/disabled users never reach children. */
export function AuthGate({ children, signedOut }: { children: ReactNode; signedOut: ReactNode }) {
  const { authUser, profile } = useAuth();

  if (authUser === undefined) return <FullPageLoader />;
  if (authUser === null) return <>{signedOut}</>;
  if (profile === undefined) return <FullPageLoader />;
  if (profile === null || profile.status === 'pending') return <PendingApproval />;
  if (profile.status !== 'active') return <AccountInactive />;
  return <>{children}</>;
}
