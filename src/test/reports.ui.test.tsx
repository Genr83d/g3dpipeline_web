import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../context/AuthProvider';
import type { AppUser, UserRole } from '../types';
import { AccountMenu } from '../components/AccountMenu';
import Reports from '../pages/Reports';
import { fixtureJobs, fixtureMachines, fixtureMaterials, fixtureNow } from './reportFixture';

const testState = vi.hoisted(() => ({
  auth: null as unknown,
  toast: vi.fn(),
  render: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../context/AuthProvider', () => ({ useAuth: () => testState.auth }));
vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));
vi.mock('../components/Toast', () => ({ useToast: () => ({ toast: testState.toast }) }));
vi.mock('../services/authService', () => ({ signOut: vi.fn() }));
vi.mock('../routes/Workspace', async () => {
  const f = await import('./reportFixture');
  const retry = () => {};
  return {
    useJobsOutlet: () => ({ jobs: f.fixtureJobs, loading: false, error: null, retry }),
    useInventoryOutlet: () => ({ materials: f.fixtureMaterials, loading: false, error: null, retry }),
    useMachinesOutlet: () => ({ machines: f.fixtureMachines, loading: false, error: null, retry }),
  };
});
vi.mock('../reports/renderReportPdf', () => ({
  renderReportPdf: (...args: unknown[]) => testState.render(...args),
  saveBlob: (...args: unknown[]) => testState.save(...args),
}));

function setRole(role: UserRole) {
  const profile: AppUser = {
    uid: 'u-kim',
    name: 'Kimberly Reid',
    email: 'kim@example.com',
    role,
    status: 'active',
    createdAt: null,
    updatedAt: null,
  };
  testState.auth = {
    authUser: { uid: profile.uid, email: profile.email } as AuthState['authUser'],
    profile,
    firstName: 'Kimberly',
    profileError: false,
    isActive: true,
    isAdmin: role === 'admin',
    isManagerOrAdmin: role === 'manager' || role === 'admin',
    actor: { uid: profile.uid, firstName: 'Kimberly', displayName: profile.name, email: profile.email },
    assigner: { uid: profile.uid, name: profile.name, role },
  } satisfies AuthState;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(fixtureNow);
  setRole('manager');
  testState.render.mockResolvedValue(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Reports page', () => {
  it('opens on the current month, marked as in progress', () => {
    render(<Reports />);
    expect(screen.getByRole('radio', { name: 'Month' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('October 2026')).toBeInTheDocument();
    expect(screen.getAllByText('Overdue now').length).toBeGreaterThan(0);
  });

  it('previews the chosen month', async () => {
    const user = userEvent.setup();
    render(<Reports />);
    await user.selectOptions(screen.getByLabelText('Month'), 'September');
    expect(screen.getByText('September 2026')).toBeInTheDocument();
    expect(screen.getByText(/The shop completed 16 jobs \(185 units\) for 8 customers/)).toBeInTheDocument();
    expect(screen.getAllByText('Overdue at period end').length).toBeGreaterThan(0);
  });

  it('never offers a month or quarter that has not started', async () => {
    const user = userEvent.setup();
    render(<Reports />);
    const months = screen.getByLabelText('Month') as HTMLSelectElement;
    expect([...months.options].map((o) => o.text).at(-1)).toBe('October');
    await user.click(screen.getByRole('radio', { name: 'Quarter' }));
    const quarters = screen.getByLabelText('Quarter') as HTMLSelectElement;
    expect([...quarters.options].map((o) => o.value)).toEqual(['1', '2', '3', '4']);
    await user.selectOptions(screen.getByLabelText('Year'), '2025');
    expect(screen.getByText('Q4 2025')).toBeInTheDocument();
  });

  it('rejects a backwards custom range and disables the download', async () => {
    const user = userEvent.setup();
    render(<Reports />);
    await user.click(screen.getByRole('radio', { name: 'Custom' }));
    const from = screen.getByLabelText('From');
    await user.clear(from);
    await user.type(from, '2026-09-20');
    const to = screen.getByLabelText('To');
    await user.clear(to);
    await user.type(to, '2026-09-10');
    expect(screen.getByRole('alert')).toHaveTextContent('The start date must be on or before the end date.');
    expect(screen.getByTestId('download-report')).toBeDisabled();
  });

  it('renders and saves the PDF under the period filename', async () => {
    const user = userEvent.setup();
    render(<Reports />);
    await user.selectOptions(screen.getByLabelText('Month'), 'September');
    await user.click(screen.getByTestId('download-report'));
    await waitFor(() => expect(testState.save).toHaveBeenCalled());
    const [report] = testState.render.mock.calls[0];
    expect(report).toMatchObject({ periodLabel: 'September 2026', generatedBy: 'Kimberly Reid' });
    expect(report.kpis.completed).toBe(16);
    expect(testState.save.mock.calls[0][1]).toBe('G3D-Operations-Report-2026-09.pdf');
    expect(testState.toast).toHaveBeenCalledWith('September 2026 report downloaded.', 'success');
  });

  it('reports a failed render without leaving the button stuck', async () => {
    testState.render.mockRejectedValueOnce(new Error('Font failed to load'));
    const user = userEvent.setup();
    render(<Reports />);
    await user.click(screen.getByTestId('download-report'));
    await waitFor(() =>
      expect(testState.toast).toHaveBeenCalledWith(
        "Couldn't create the report. Font failed to load",
        'error',
      ),
    );
    expect(screen.getByTestId('download-report')).toBeEnabled();
    expect(testState.save).not.toHaveBeenCalled();
  });
});

describe('Reports entry point', () => {
  it.each([
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['awf', false],
  ] as const)('%s sees Reports in the account menu: %s', async (role, visible) => {
    setRole(role);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountMenu />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await screen.findByRole('menu');
    expect(screen.queryByRole('menuitem', { name: 'Reports' }) !== null).toBe(visible);
  });
});

// Keep fixture imports referenced for the mocked module above.
void fixtureJobs;
void fixtureMachines;
void fixtureMaterials;
