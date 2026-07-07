import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthProvider';
import { PendingApproval, AccountInactive } from '../pages/AccountStatus';
import { Spinner } from '../components/Spinner';
import { BrandMark } from '../components/BrandMark';

function FullPageLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <BrandMark className="h-10 w-10" />
      <Spinner className="h-8 w-8" />
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
