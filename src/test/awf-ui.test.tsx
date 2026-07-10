import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../context/AuthProvider';
import type { JobsState } from '../hooks/useJobs';
import type { AppUser, Job, UserRole } from '../types';
import { AccountMenu } from '../components/AccountMenu';
import { AssignJobModal } from '../components/AssignJobModal';
import { JobCard } from '../components/JobCard';
import { JobForm } from '../components/JobForm';
import Jobs from '../pages/Jobs';
import { Workspace } from '../routes/Workspace';

const testState = vi.hoisted(() => ({
  auth: null as unknown,
  jobs: null as unknown,
  retry: vi.fn(),
  toast: vi.fn(),
  watchAssignableUsers: vi.fn(),
  addJob: vi.fn(),
  assignJob: vi.fn(),
  completeJob: vi.fn(),
  deleteJob: vi.fn(),
  editJob: vi.fn(),
  restoreJob: vi.fn(),
  startJob: vi.fn(),
  unassignJob: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../context/AuthProvider', () => ({
  useAuth: () => testState.auth,
}));

vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));

vi.mock('../routes/Workspace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../routes/Workspace')>();
  return { ...actual, useJobsOutlet: () => testState.jobs };
});

vi.mock('../hooks/useJobs', () => ({
  useJobs: () => testState.jobs,
}));

vi.mock('../hooks/useInventory', () => ({
  useInventory: () => ({ materials: [], loading: false, error: null, retry: vi.fn() }),
}));

vi.mock('../hooks/useMachines', () => ({
  useMachines: () => ({ machines: [], loading: false, error: null, retry: vi.fn() }),
}));

vi.mock('../components/Toast', () => ({
  useToast: () => ({ toast: testState.toast }),
}));

vi.mock('../services/userService', () => ({
  watchAssignableUsers: (...args: unknown[]) => testState.watchAssignableUsers(...args),
}));

vi.mock('../services/jobService', () => ({
  addJob: (...args: unknown[]) => testState.addJob(...args),
  assignJob: (...args: unknown[]) => testState.assignJob(...args),
  completeJob: (...args: unknown[]) => testState.completeJob(...args),
  deleteJob: (...args: unknown[]) => testState.deleteJob(...args),
  editJob: (...args: unknown[]) => testState.editJob(...args),
  restoreJob: (...args: unknown[]) => testState.restoreJob(...args),
  startJob: (...args: unknown[]) => testState.startJob(...args),
  unassignJob: (...args: unknown[]) => testState.unassignJob(...args),
}));

vi.mock('../services/authService', () => ({
  signOut: () => testState.signOut(),
}));

function profile(role: UserRole, uid = 'current-user'): AppUser {
  return {
    uid,
    name: 'Alex Worker',
    email: 'alex@example.com',
    role,
    status: 'active',
    createdAt: null,
    updatedAt: null,
  };
}

function setRole(role: UserRole, uid = 'current-user') {
  const currentProfile = profile(role, uid);
  testState.auth = {
    authUser: { uid, email: currentProfile.email } as AuthState['authUser'],
    profile: currentProfile,
    firstName: 'Alex',
    isActive: true,
    isAdmin: role === 'admin',
    isManagerOrAdmin: role === 'manager' || role === 'admin',
    actor: {
      uid,
      firstName: 'Alex',
      displayName: currentProfile.name,
      email: currentProfile.email,
    },
    assigner: { uid, name: currentProfile.name, role },
  } satisfies AuthState;
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    name: 'Event badges',
    customer: 'Receiver',
    quantity: 10,
    dueDate: new Date('2099-06-15T23:59:59'),
    status: 'pending',
    isAwf: false,
    createdByUid: 'creator',
    createdByName: 'Creator',
    createdByEmail: 'creator@example.com',
    assignedToUid: '',
    assignedToName: '',
    assignedToRole: '',
    assignedByUid: '',
    assignedByName: '',
    assignedAt: null,
    collaborators: [],
    collaboratorUids: [],
    createdAt: null,
    updatedAt: null,
    startedAt: null,
    completedAt: null,
    completedByUid: '',
    completedByName: '',
    updatedByUid: '',
    updatedByName: '',
    ...overrides,
  };
}

function jobsState(overrides: Partial<JobsState> = {}): JobsState {
  return {
    jobs: [],
    loading: false,
    error: null,
    retry: testState.retry,
    ...overrides,
  };
}

beforeEach(() => {
  setRole('staff');
  testState.jobs = jobsState();
  testState.watchAssignableUsers.mockImplementation(
    (_role: UserRole, onUsers: (users: AppUser[]) => void) => {
      onUsers([]);
      return vi.fn();
    },
  );
  for (const action of [
    testState.addJob,
    testState.assignJob,
    testState.completeJob,
    testState.deleteJob,
    testState.editJob,
    testState.restoreJob,
    testState.startJob,
    testState.unassignJob,
    testState.signOut,
  ]) {
    action.mockResolvedValue(undefined);
  }
});

describe('AWF job form', () => {
  it.each<UserRole>(['manager', 'admin'])('shows the AWF toggle to %s users', (role) => {
    setRole(role);
    render(<JobForm submitLabel="Save" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: /AWF job/i })).toBeInTheDocument();
  });

  it.each<UserRole>(['staff', 'awf'])('hides the AWF toggle from %s users', (role) => {
    setRole(role);
    render(<JobForm submitLabel="Save" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('checkbox', { name: /AWF job/i })).not.toBeInTheDocument();
  });

  it('rejects a deadline in the past', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<JobForm submitLabel="Add job" onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Job Name'), 'Badges');
    await user.type(screen.getByLabelText('Name of Receiver'), 'Conference team');
    await user.type(screen.getByLabelText('Order Quantity'), '25');
    fireEvent.change(screen.getByLabelText('Deadline'), { target: { value: '2000-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Add job' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Deadline cannot be in the past.');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('AWF job card permissions', () => {
  it('shows an AWF badge to managers but not AWF Staff', () => {
    setRole('manager');
    const awfJob = job({ isAwf: true });
    const { rerender } = render(<JobCard job={awfJob} />);
    expect(screen.getByText('AWF')).toBeInTheDocument();

    setRole('awf');
    rerender(<JobCard job={awfJob} />);
    expect(screen.queryByText('AWF')).not.toBeInTheDocument();
  });

  it('applies the unassigned pending-job action matrix', () => {
    const pending = job();
    const callbacks = {
      onStart: vi.fn(),
      onEdit: vi.fn(),
      onAssign: vi.fn(),
      onDelete: vi.fn(),
    };
    setRole('manager');
    const { rerender } = render(<JobCard job={pending} {...callbacks} />);
    expect(screen.queryByRole('button', { name: 'Start Job' })).not.toBeInTheDocument();
    expect(screen.getByText('Add Team')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit Event badges/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete Event badges/ })).not.toBeInTheDocument();

    setRole('admin');
    rerender(<JobCard job={pending} {...callbacks} />);
    expect(screen.getByRole('button', { name: 'Start Job' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Event badges/ })).toBeInTheDocument();
  });

  it('does not let AWF Staff start someone else’s assigned job', () => {
    setRole('awf');
    const assigned = job({
      assignedToUid: 'other-user',
      assignedToName: 'Other User',
      assignedToRole: 'awf',
      collaborators: [{ uid: 'other-user', name: 'Other User', role: 'awf' }],
      collaboratorUids: ['other-user'],
      isAwf: true,
    });
    render(<JobCard job={assigned} onStart={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Start Job' })).not.toBeInTheDocument();
  });

  it('hides restore from AWF Staff and shows it to managers', () => {
    setRole('awf');
    const completed = job({ status: 'completed', isAwf: true });
    const { rerender } = render(<JobCard job={completed} onRestore={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();

    setRole('manager');
    rerender(<JobCard job={completed} onRestore={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });
});

describe('AWF account menu', () => {
  it('uses the compact Staff label for an AWF account', async () => {
    setRole('awf');
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountMenu />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(await screen.findByText('Staff')).toBeInTheDocument();
    expect(screen.queryByText('AWF Staff')).not.toBeInTheDocument();
  });

  it('closes admin-only UI immediately after an Admin to AWF role change', async () => {
    setRole('admin');
    const user = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter>
        <AccountMenu />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(await screen.findByText('User management')).toBeInTheDocument();

    setRole('awf');
    rerender(
      <MemoryRouter>
        <AccountMenu />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.queryByText('User management')).not.toBeInTheDocument();
    });
  });
});

describe('AWF workspace navigation', () => {
  it('contains and navigates between only Jobs, Summary, and Archive', async () => {
    setRole('awf');
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Workspace />}>
            <Route index element={<div>Jobs page</div>} />
            <Route path="summary" element={<div>Summary page</div>} />
            <Route path="archive" element={<div>Archive page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', { name: 'Workspace tabs' });
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Jobs',
      'Summary',
      'Archive',
    ]);
    expect(within(navigation).queryByText('Inventory')).not.toBeInTheDocument();
    expect(within(navigation).queryByText('Maintenance')).not.toBeInTheDocument();

    await user.click(within(navigation).getByRole('link', { name: 'Summary' }));
    expect(await screen.findByText('Summary page')).toBeInTheDocument();

    await user.click(within(navigation).getByRole('link', { name: 'Archive' }));
    expect(await screen.findByText('Archive page')).toBeInTheDocument();
  });
});

describe('shared Jobs states', () => {
  it('shows the shared-jobs loading copy', () => {
    testState.jobs = jobsState({ loading: true });
    render(<Jobs />);

    expect(screen.getAllByText('Loading shared jobs...').length).toBeGreaterThan(0);
  });

  it('shows a friendly retryable error state', async () => {
    const user = userEvent.setup();
    testState.jobs = jobsState({ error: 'Unable to load shared jobs right now. Please try again.' });
    render(<Jobs />);

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to Load Jobs');
    expect(screen.getByText('Unable to load shared jobs right now. Please try again.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(testState.retry).toHaveBeenCalledOnce();
  });

  it('shows the required empty-state copy', () => {
    testState.jobs = jobsState();
    render(<Jobs />);

    expect(screen.getByText('No Jobs In The Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Create a new job to begin tracking production.')).toBeInTheDocument();
  });
});

describe('collaborator role options', () => {
  const pendingJob = job();
  const props = {
    job: pendingJob,
    onSave: vi.fn().mockResolvedValue(undefined),
    onClear: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
  };

  it('lets managers choose active Staff and AWF Staff', () => {
    setRole('manager');
    render(<AssignJobModal {...props} />);

    const options = within(screen.getByLabelText('Role'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(['Staff', 'AWF Staff']);
  });

  it('lets admins choose every active role', () => {
    setRole('admin');
    render(<AssignJobModal {...props} />);

    const options = within(screen.getByLabelText('Role'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(['Staff', 'AWF Staff', 'Manager', 'Admin']);
  });
});
