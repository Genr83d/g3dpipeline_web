import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../context/AuthProvider';
import { OnboardingProvider, useOnboarding } from '../onboarding/OnboardingProvider';
import type { UserRole } from '../types';

const testState = vi.hoisted(() => ({ auth: null as unknown as AuthState }));

vi.mock('../context/AuthProvider', () => ({
  useAuth: () => testState.auth,
}));

function setRole(role: UserRole) {
  testState.auth = {
    authUser: { uid: 'user-1', email: 'alex@example.com' } as AuthState['authUser'],
    profile: {
      uid: 'user-1',
      name: 'Alex Worker',
      email: 'alex@example.com',
      role,
      status: 'active',
      createdAt: null,
      updatedAt: null,
    },
    firstName: 'Alex',
    isActive: true,
    isAdmin: role === 'admin',
    isManagerOrAdmin: role === 'manager' || role === 'admin',
    actor: null,
    assigner: null,
  };
}

function TutorialList() {
  const { tutorials, startTutorial } = useOnboarding();
  return (
    <div>
      <p data-testid="tutorial-list">{tutorials.map((item) => item.id).join(',')}</p>
      <button onClick={() => startTutorial('reports')}>Start reports</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <OnboardingProvider>
        <div data-tour="nav-jobs">Jobs</div>
        <div data-tour="job-filters">Filters</div>
        <TutorialList />
      </OnboardingProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  setRole('staff');
});

describe('interactive onboarding', () => {
  it('automatically starts the application tour for a new user and saves an exit', async () => {
    renderProvider();

    expect(await screen.findByText('Welcome to GENR8 Pipeline', {}, { timeout: 1500 })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 10')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Exit tutorial' }));

    expect(screen.queryByTestId('onboarding-tooltip')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('g3d-onboarding:v1:user-1:staff:application')!)).toEqual({
      step: 1,
      complete: false,
    });
  });

  it('resumes an unfinished tour at its saved step', async () => {
    localStorage.setItem(
      'g3d-onboarding:v1:user-1:staff:application',
      JSON.stringify({ step: 2, complete: false }),
    );
    renderProvider();

    expect(await screen.findByText('Find the right work', {}, { timeout: 1500 })).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 10')).toBeInTheDocument();
  });

  it('marks a skipped application tour complete so it will not auto-open again', async () => {
    renderProvider();
    await screen.findByText('Welcome to GENR8 Pipeline', {}, { timeout: 1500 });
    await userEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));

    expect(JSON.parse(localStorage.getItem('g3d-onboarding:v1:user-1:staff:application')!)).toMatchObject({
      complete: true,
    });
  });

  it('only offers workflow guides that match the current role', () => {
    localStorage.setItem(
      'g3d-onboarding:v1:user-1:awf:application',
      JSON.stringify({ step: 0, complete: true }),
    );
    setRole('awf');
    const { unmount } = renderProvider();
    expect(screen.getByTestId('tutorial-list')).not.toHaveTextContent('assign-job');
    expect(screen.getByTestId('tutorial-list')).not.toHaveTextContent('inventory');
    unmount();

    localStorage.setItem(
      'g3d-onboarding:v1:user-1:manager:application',
      JSON.stringify({ step: 0, complete: true }),
    );
    setRole('manager');
    renderProvider();
    expect(screen.getByTestId('tutorial-list')).toHaveTextContent('assign-job');
    expect(screen.getByTestId('tutorial-list')).toHaveTextContent('inventory');
  });
});
