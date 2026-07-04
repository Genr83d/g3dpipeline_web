import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthProvider';
import { PendingApproval, AccountInactive } from '../pages/AccountStatus';
import { Skeleton } from '../components/Skeleton';
import { BrandMark } from '../components/BrandMark';

function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="w-full max-w-sm space-y-3 p-6">
        <BrandMark className="h-10 w-10" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
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
