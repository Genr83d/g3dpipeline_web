import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../context/AuthProvider';
import { AuthGate } from '../routes/AuthGate';

const testState = vi.hoisted(() => ({ auth: {} as AuthState }));

vi.mock('../context/AuthProvider', () => ({ useAuth: () => testState.auth }));
vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));
vi.mock('../services/authService', () => ({ signOut: vi.fn() }));

function authState(patch: Partial<AuthState>): AuthState {
  return {
    authUser: { uid: 'u1', email: 'worker@example.com' } as AuthState['authUser'],
    profile: undefined,
    profileError: false,
    firstName: 'Worker',
    isActive: false,
    isAdmin: false,
    isManagerOrAdmin: false,
    actor: null,
    assigner: null,
    ...patch,
  };
}

function renderGate() {
  return render(
    <AuthGate signedOut={<p>signed out</p>}>
      <p>workspace</p>
    </AuthGate>,
  );
}

describe('AuthGate', () => {
  it('shows the workspace to an active account', () => {
    testState.auth = authState({
      profile: { status: 'active' } as AuthState['profile'],
      isActive: true,
    });
    renderGate();
    expect(screen.getByText('workspace')).toBeInTheDocument();
  });

  it('treats a missing profile document as awaiting approval', () => {
    testState.auth = authState({ profile: null });
    renderGate();
    expect(screen.getByRole('heading', { name: 'Account pending' })).toBeInTheDocument();
  });

  /** Regression: a failed profile read used to be indistinguishable from a
   *  missing document, so a connection problem told an approved user their
   *  account was waiting on an administrator who had nothing to approve. */
  it('reports a failed profile read as unavailable, not as pending approval', () => {
    testState.auth = authState({ profile: null, profileError: true });
    renderGate();

    expect(screen.getByRole('heading', { name: 'Account unavailable' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Account pending' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('keeps disabled accounts out', () => {
    testState.auth = authState({ profile: { status: 'disabled' } as AuthState['profile'] });
    renderGate();
    expect(screen.getByRole('heading', { name: 'Account inactive' })).toBeInTheDocument();
  });

  it('renders the signed-out tree when there is no user', () => {
    testState.auth = authState({ authUser: null });
    renderGate();
    expect(screen.getByText('signed out')).toBeInTheDocument();
  });
});
