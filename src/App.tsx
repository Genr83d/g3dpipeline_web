import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthProvider';
import { AppearanceProvider } from './context/AppearanceProvider';
import { ToastProvider } from './components/Toast';
import { AuthGate } from './routes/AuthGate';
import { Workspace } from './routes/Workspace';
import { PageHeaderSkeleton, Skeleton } from './components/Skeleton';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import Jobs from './pages/Jobs';
import Inventory from './pages/Inventory';
import Maintenance from './pages/Maintenance';
import Summary from './pages/Summary';
import Archive from './pages/Archive';

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

export default function App() {
  return (
    <AppearanceProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AuthGate
              signedOut={
                <Routes>
                  <Route path="/sign-in" element={<SignIn />} />
                  <Route path="/sign-up" element={<SignUp />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="*" element={<Navigate to="/sign-in" replace />} />
                </Routes>
              }
            >
              <Routes>
                <Route element={<Workspace />}>
                  <Route index element={<Jobs />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="maintenance" element={<Maintenance />} />
                  <Route path="summary" element={<Summary />} />
                  <Route path="archive" element={<Archive />} />
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
