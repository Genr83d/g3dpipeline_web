import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../context/AuthProvider';
import type { JobsState } from '../hooks/useJobs';
import type { AppUser, Job, UserRole } from '../types';
import { JobCard } from '../components/JobCard';
import Archive from '../pages/Archive';
import Jobs from '../pages/Jobs';
import Summary from '../pages/Summary';

const testState = vi.hoisted(() => ({
  auth: null as unknown,
  jobs: null as unknown,
  toast: vi.fn(),
}));

vi.mock('../context/AuthProvider', () => ({ useAuth: () => testState.auth }));
vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));
vi.mock('../routes/Workspace', () => ({
  useJobsOutlet: () => testState.jobs,
  useInventoryOutlet: () => ({ materials: [], loading: false, error: null, retry: vi.fn() }),
}));
vi.mock('../components/Toast', () => ({ useToast: () => ({ toast: testState.toast }) }));
vi.mock('../services/userService', () => ({ watchAssignableUsers: vi.fn() }));
vi.mock('../services/jobService', () => ({
  addJob: vi.fn(),
  assignJob: vi.fn(),
  completeJob: vi.fn(),
  deleteJob: vi.fn(),
  editJob: vi.fn(),
  restoreJob: vi.fn(),
  startJob: vi.fn(),
  unassignJob: vi.fn(),
  updateJobProgress: vi.fn(),
  updateRepairProgress: vi.fn(),
}));
vi.mock('../services/inventoryService', () => ({
  isLowStock: () => false,
  stockRatio: () => 1,
}));

function profile(role: UserRole): AppUser {
  return {
    uid: 'current-user',
    name: 'Alex Worker',
    email: 'alex@example.com',
    role,
    status: 'active',
    createdAt: null,
    updatedAt: null,
  };
}

function setRole(role: UserRole) {
  const currentProfile = profile(role);
  testState.auth = {
    authUser: { uid: currentProfile.uid, email: currentProfile.email } as AuthState['authUser'],
    profile: currentProfile,
    firstName: 'Alex',
    isActive: true,
    isAdmin: role === 'admin',
    isManagerOrAdmin: role === 'manager' || role === 'admin',
    actor: {
      uid: currentProfile.uid,
      firstName: 'Alex',
      displayName: currentProfile.name,
      email: currentProfile.email,
    },
    assigner: { uid: currentProfile.uid, name: currentProfile.name, role },
  } satisfies AuthState;
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'abc123xyz789',
    orderNumber: 'G3D-ABC123XY',
    name: 'Actuator repair',
    customer: 'Receiver',
    quantity: 4,
    completedQuantity: 0,
    dueDate: new Date('2099-06-15T23:59:59'),
    status: 'pending',
    category: 'manufacturing',
    repairProcesses: [],
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
    dueDateChangeNote: '',
    previousDueDate: null,
    dueDateChangedAt: null,
    dueDateChangedByUid: '',
    dueDateChangedByName: '',
    ...overrides,
  };
}

function jobsState(overrides: Partial<JobsState> = {}): JobsState {
  return { jobs: [], loading: false, error: null, retry: vi.fn(), ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  setRole('staff');
  testState.jobs = jobsState();
});

describe('order numbers on job cards', () => {
  it.each(['admin', 'manager', 'staff', 'awf'] as const)('is visible to %s', (role) => {
    setRole(role);
    render(<JobCard job={job()} />);

    expect(screen.getByTestId('job-order-number-abc123xyz789')).toHaveTextContent(
      'Job order • G3D-ABC123XY',
    );
  });

  it('stays on the card after the job is completed and archived', () => {
    render(
      <JobCard
        job={job({ status: 'completed', completedAt: new Date('2099-01-01'), completedQuantity: 4 })}
      />,
    );

    expect(screen.getByTestId('job-order-number-abc123xyz789')).toHaveTextContent('G3D-ABC123XY');
  });

  it('shows a legacy job the number derived from its document ID', () => {
    render(<JobCard job={job({ orderNumber: 'G3D-LEGACY1' })} />);

    expect(screen.getByTestId('job-order-number-abc123xyz789')).toHaveTextContent('G3D-LEGACY1');
  });
});

describe('order numbers across the workspace', () => {
  it('appears on the pipeline board, the Summary urgent list, and the Archive', async () => {
    testState.jobs = jobsState({
      jobs: [
        job({ id: 'active-1', orderNumber: 'G3D-ACTIVE1', name: 'Actuator repair' }),
        job({
          id: 'archived-1',
          orderNumber: 'G3D-ARCHIV1',
          name: 'Badge batch',
          status: 'completed',
          completedQuantity: 4,
          completedAt: new Date('2099-01-01'),
        }),
      ],
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route index element={<Jobs />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('job-order-number-active-1')).toHaveTextContent('G3D-ACTIVE1');
    unmount();

    const summary = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route index element={<Summary />} />
        </Routes>
      </MemoryRouter>,
    );
    const urgent = screen.getByRole('region', { name: 'Urgent jobs' });
    expect(within(urgent).getByText('G3D-ACTIVE1')).toBeInTheDocument();
    expect(within(urgent).queryByText('G3D-ARCHIV1')).not.toBeInTheDocument();
    summary.unmount();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route index element={<Archive />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('job-order-number-archived-1')).toHaveTextContent('G3D-ARCHIV1');
  });
});
