import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthProvider';
import { AppearanceProvider } from './context/AppearanceProvider';
import { ToastProvider } from './components/Toast';
import { AuthGate } from './routes/AuthGate';
import { Workspace } from './routes/Workspace';
import { PageHeaderSkeleton, Skeleton } from './components/Skeleton';

const SignIn = lazy(() => import('./pages/SignIn'));
const SignUp = lazy(() => import('./pages/SignUp'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const Summary = lazy(() => import('./pages/Summary'));
const Archive = lazy(() => import('./pages/Archive'));
const Profile = lazy(() => import('./pages/settings/Profile'));
const PersonalInfo = lazy(() => import('./pages/settings/PersonalInfo'));
const Security = lazy(() => import('./pages/settings/Security'));
const Appearance = lazy(() => import('./pages/settings/Appearance'));
const UserManagement = lazy(() => import('./pages/settings/UserManagement'));
const Help = lazy(() => import('./pages/settings/Help'));
const About = lazy(() => import('./pages/settings/About'));

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

function NonAwfOnly({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  return profile?.role === 'awf' ? <Navigate to="/" replace /> : <>{children}</>;
}

/** A live role change remounts the complete listener/UI subtree. */
function RoleScopedWorkspace() {
  const { profile } = useAuth();
  if (!profile) return null;
  return <Workspace key={`${profile.uid}:${profile.role}`} />;
}

function SettingsFallback() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeaderSkeleton />
      <div className="surface space-y-4 p-5">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}

function WorkspaceRouteFallback() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

function AuthRouteFallback() {
  return (
    <div className="auth-backdrop flex min-h-dvh items-center justify-center p-4">
      <div className="surface-strong w-full max-w-sm space-y-5 p-6 sm:p-8">
        <Skeleton className="mx-auto h-16 w-16" />
        <div className="space-y-2">
          <Skeleton className="mx-auto h-5 w-36" />
          <Skeleton className="mx-auto h-4 w-48" />
        </div>
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    </div>
  );
}

function RouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<WorkspaceRouteFallback />}>{children}</Suspense>;
}

function AuthSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AuthRouteFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <AppearanceProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AuthGate
              signedOut={
                <Routes>
                  <Route path="/sign-in" element={<AuthSuspense><SignIn /></AuthSuspense>} />
                  <Route path="/sign-up" element={<AuthSuspense><SignUp /></AuthSuspense>} />
                  <Route path="/forgot-password" element={<AuthSuspense><ForgotPassword /></AuthSuspense>} />
                  <Route path="*" element={<Navigate to="/sign-in" replace />} />
                </Routes>
              }
            >
              <Routes>
                <Route element={<RoleScopedWorkspace />}>
                  <Route index element={<RouteSuspense><Jobs /></RouteSuspense>} />
                  <Route
                    path="inventory"
                    element={
                      <NonAwfOnly>
                        <RouteSuspense><Inventory /></RouteSuspense>
                      </NonAwfOnly>
                    }
                  />
                  <Route
                    path="maintenance"
                    element={
                      <NonAwfOnly>
                        <RouteSuspense><Maintenance /></RouteSuspense>
                      </NonAwfOnly>
                    }
                  />
                  <Route path="summary" element={<RouteSuspense><Summary /></RouteSuspense>} />
                  <Route path="archive" element={<RouteSuspense><Archive /></RouteSuspense>} />
                  <Route
                    path="settings/*"
                    element={
                      <Suspense fallback={<SettingsFallback />}>
                        <Routes>
                          <Route path="profile" element={<Profile />} />
                          <Route path="personal" element={<PersonalInfo />} />
                          <Route path="security" element={<Security />} />
                          <Route path="appearance" element={<Appearance />} />
                          <Route path="users" element={<AdminOnly><UserManagement /></AdminOnly>} />
                          <Route path="help" element={<Help />} />
                          <Route path="about" element={<About />} />
                          <Route path="*" element={<Navigate to="/settings/profile" replace />} />
                        </Routes>
                      </Suspense>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </AuthGate>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </AppearanceProvider>
  );
}
