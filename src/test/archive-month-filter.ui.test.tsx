import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../context/AuthProvider';
import type { JobsState } from '../hooks/useJobs';
import type { AppUser, Job, UserRole } from '../types';
import Archive from '../pages/Archive';

const testState = vi.hoisted(() => ({
  auth: null as unknown,
  jobs: null as unknown,
  retry: vi.fn(),
  toast: vi.fn(),
  restoreJob: vi.fn(),
  deleteJob: vi.fn(),
}));

vi.mock('../context/AuthProvider', () => ({ useAuth: () => testState.auth }));
vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));
vi.mock('../routes/Workspace', () => ({ useJobsOutlet: () => testState.jobs }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ toast: testState.toast }) }));
vi.mock('../services/jobService', () => ({
  restoreJob: (...args: unknown[]) => testState.restoreJob(...args),
  deleteJob: (...args: unknown[]) => testState.deleteJob(...args),
}));

function setRole(role: UserRole) {
  const currentProfile: AppUser = {
    uid: 'current-user',
    name: 'Alex Worker',
    email: 'alex@example.com',
    role,
    status: 'active',
    createdAt: null,
    updatedAt: null,
  };
  testState.auth = {
    authUser: { uid: currentProfile.uid, email: currentProfile.email } as AuthState['authUser'],
    profile: currentProfile,
    firstName: 'Alex',
    profileError: false,
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

/** Local constructors: `new Date(2026, 8, 15)` is September 2026 wherever the
 *  suite runs, while an ISO string near a month boundary is not. */
function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    orderNumber: 'G3D-JOB-1',
    name: 'Event badges',
    customer: 'Receiver',
    quantity: 10,
    completedQuantity: 10,
    dueDate: new Date(2026, 5, 15, 23, 59, 59),
    status: 'completed',
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
    completedAt: new Date(2026, 8, 15, 12, 0, 0),
    completedByUid: 'current-user',
    completedByName: 'Alex Worker',
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
  return { jobs: [], loading: false, error: null, retry: testState.retry, ...overrides };
}

/** The reader's own locale, formatted exactly as the page formats it. */
function monthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex, 1),
  );
}

const SEPT_2026 = monthLabel(2026, 8);
const SEPT_2025 = monthLabel(2025, 8);
const AUG_2026 = monthLabel(2026, 7);

function monthFilter(): HTMLSelectElement {
  return screen.getByLabelText('Filter by completion month') as HTMLSelectElement;
}

function cardNames(): string[] {
  return screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent ?? '');
}

const archiveJobs: Job[] = [
  job({
    id: 'sept-2026',
    name: 'September 2026 job',
    completedAt: new Date(2026, 8, 20, 9, 0, 0),
  }),
  job({
    id: 'due-august-shipped-september',
    name: 'Late badge run',
    dueDate: new Date(2026, 7, 28, 23, 59, 59),
    completedAt: new Date(2026, 8, 3, 16, 0, 0),
  }),
  job({
    id: 'sept-2025',
    name: 'September 2025 job',
    completedAt: new Date(2025, 8, 4, 11, 0, 0),
  }),
  job({
    id: 'aug-2026',
    name: 'August 2026 job',
    completedAt: new Date(2026, 7, 30, 8, 0, 0),
  }),
  job({
    id: 'undated',
    name: 'Undated job',
    completedAt: null,
    dueDate: new Date(2026, 3, 10, 23, 59, 59),
  }),
];

beforeEach(() => {
  setRole('manager');
  testState.jobs = jobsState({ jobs: archiveJobs });
  testState.restoreJob.mockResolvedValue(undefined);
  testState.deleteJob.mockResolvedValue(undefined);
});

describe('Archive completion-month filter', () => {
  it('defaults to All months and lists every completed job, newest completion first', () => {
    render(<Archive />);

    expect(monthFilter()).toHaveValue('all');
    expect(within(monthFilter()).getByRole('option', { name: 'All months' })).toBeInTheDocument();
    expect(cardNames()).toEqual([
      'September 2026 job',
      'Late badge run',
      'August 2026 job',
      'September 2025 job',
      // No completion date: last, whatever its deadline.
      'Undated job',
    ]);
  });

  it('offers only months that hold completed jobs, newest first, Unknown month last', () => {
    render(<Archive />);

    expect(
      within(monthFilter())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All months', SEPT_2026, AUG_2026, SEPT_2025, 'Unknown month']);
  });

  it('shows the same month in two different years as two options', async () => {
    const user = userEvent.setup();
    render(<Archive />);

    await user.selectOptions(monthFilter(), '2026-09');
    await waitFor(() => {
      expect(cardNames()).toEqual(['September 2026 job', 'Late badge run']);
    });

    await user.selectOptions(monthFilter(), '2025-09');
    await waitFor(() => {
      expect(cardNames()).toEqual(['September 2025 job']);
    });
  });

  it('files a job due in August but completed in September under September', async () => {
    const user = userEvent.setup();
    render(<Archive />);

    await user.selectOptions(monthFilter(), '2026-09');
    expect(await screen.findByRole('heading', { name: 'Late badge run' })).toBeInTheDocument();

    await user.selectOptions(monthFilter(), '2026-08');
    await waitFor(() => {
      expect(cardNames()).toEqual(['August 2026 job']);
    });
  });

  it('keeps undated jobs reachable under Unknown month', async () => {
    const user = userEvent.setup();
    render(<Archive />);

    await user.selectOptions(monthFilter(), 'unknown');
    await waitFor(() => {
      expect(cardNames()).toEqual(['Undated job']);
    });
  });

  it('omits Unknown month while every completed job carries a timestamp', () => {
    testState.jobs = jobsState({ jobs: archiveJobs.filter((j) => j.completedAt !== null) });
    render(<Archive />);

    expect(within(monthFilter()).queryByRole('option', { name: 'Unknown month' })).toBeNull();
  });

  it('never lists a pending or in-progress job, whatever the filter', async () => {
    const user = userEvent.setup();
    testState.jobs = jobsState({
      jobs: [
        ...archiveJobs,
        job({ id: 'pending', name: 'Pending job', status: 'pending', completedAt: null }),
        job({
          id: 'started',
          name: 'In-progress job',
          status: 'started',
          completedAt: new Date(2026, 8, 18, 9, 0, 0),
        }),
      ],
    });
    render(<Archive />);

    expect(cardNames()).not.toContain('Pending job');
    expect(cardNames()).not.toContain('In-progress job');

    await user.selectOptions(monthFilter(), '2026-09');
    await waitFor(() => {
      expect(cardNames()).toEqual(['September 2026 job', 'Late badge run']);
    });

    await user.selectOptions(monthFilter(), 'unknown');
    await waitFor(() => {
      expect(cardNames()).toEqual(['Undated job']);
    });
  });

  it('counts the selected month in the subtitle and returns to the full count', async () => {
    const user = userEvent.setup();
    render(<Archive />);

    expect(screen.getByText('5 completed jobs, newest first')).toBeInTheDocument();

    await user.selectOptions(monthFilter(), '2025-09');
    expect(
      await screen.findByText(`1 completed job in ${SEPT_2025}`),
    ).toBeInTheDocument();

    await user.selectOptions(monthFilter(), 'all');
    expect(await screen.findByText('5 completed jobs, newest first')).toBeInTheDocument();
  });
});

describe('Archive filter under live data', () => {
  it('adds a month as soon as a job completes into it', () => {
    const { rerender } = render(<Archive />);
    expect(within(monthFilter()).queryByRole('option', { name: monthLabel(2026, 9) })).toBeNull();

    testState.jobs = jobsState({
      jobs: [
        ...archiveJobs,
        job({ id: 'oct-2026', name: 'October 2026 job', completedAt: new Date(2026, 9, 5) }),
      ],
    });
    rerender(<Archive />);

    expect(
      within(monthFilter())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All months', monthLabel(2026, 9), SEPT_2026, AUG_2026, SEPT_2025, 'Unknown month']);
  });

  it('falls back to All months when the selected month loses its last job', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Archive />);

    await user.selectOptions(monthFilter(), '2025-09');
    await waitFor(() => {
      expect(cardNames()).toEqual(['September 2025 job']);
    });

    // The live listener reports the restore: that job is pending again.
    testState.jobs = jobsState({
      jobs: archiveJobs.map((j) =>
        j.id === 'sept-2025' ? { ...j, status: 'pending', completedAt: null } : j,
      ),
    });
    rerender(<Archive />);

    expect(monthFilter()).toHaveValue('all');
    expect(within(monthFilter()).queryByRole('option', { name: SEPT_2025 })).toBeNull();
    // The restored card animates out before it unmounts.
    await waitFor(() => {
      expect(cardNames()).toEqual([
        'September 2026 job',
        'Late badge run',
        'August 2026 job',
        'Undated job',
      ]);
    });
  });

  it('keeps the selection when the month merely loses one of several jobs', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Archive />);

    await user.selectOptions(monthFilter(), '2026-09');
    await waitFor(() => {
      expect(cardNames()).toEqual(['September 2026 job', 'Late badge run']);
    });

    testState.jobs = jobsState({ jobs: archiveJobs.filter((j) => j.id !== 'sept-2026') });
    rerender(<Archive />);

    expect(monthFilter()).toHaveValue('2026-09');
    await waitFor(() => {
      expect(cardNames()).toEqual(['Late badge run']);
    });
  });

  it('shows the empty state, and no filter, once the archive holds nothing', () => {
    testState.jobs = jobsState({ jobs: [job({ id: 'pending', status: 'pending' })] });
    render(<Archive />);

    expect(screen.getByRole('heading', { name: 'Nothing shipped yet' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Filter by completion month')).toBeNull();
  });

  it('hides the filter while jobs are loading and while they fail to load', () => {
    testState.jobs = jobsState({ loading: true });
    const { rerender } = render(<Archive />);
    expect(screen.queryByLabelText('Filter by completion month')).toBeNull();

    testState.jobs = jobsState({ error: 'Unable to load shared jobs right now.' });
    rerender(<Archive />);
    expect(screen.queryByLabelText('Filter by completion month')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Unable to Load Jobs' })).toBeInTheDocument();
  });
});

describe('Archive filter accessibility and permissions', () => {
  it('is a labelled combobox that can be operated from the keyboard alone', async () => {
    const user = userEvent.setup();
    render(<Archive />);

    const filter = screen.getByRole('combobox', { name: 'Filter by completion month' });
    expect(filter).toHaveAttribute('id', 'archive-month-filter');

    await user.tab();
    expect(filter).toHaveFocus();

    // selectOptions on a focused select is the keyboard path a native select
    // exposes; the point is that no pointer was needed to reach it.
    await user.selectOptions(filter, '2026-08');
    await waitFor(() => {
      expect(cardNames()).toEqual(['August 2026 job']);
    });
  });

  it('keeps restore for managers and admins, and withholds it from staff', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Archive />);

    await user.selectOptions(monthFilter(), '2025-09');
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument();

    setRole('staff');
    rerender(<Archive />);
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();

    setRole('admin');
    rerender(<Archive />);
    expect(screen.getAllByRole('button', { name: 'Restore' }).length).toBeGreaterThan(0);
  });

  it('only offers delete to admins', () => {
    const { rerender } = render(<Archive />);
    expect(screen.queryByRole('button', { name: 'Delete job' })).toBeNull();

    setRole('admin');
    rerender(<Archive />);
    expect(screen.getAllByRole('button', { name: 'Delete job' })).toHaveLength(archiveJobs.length);
  });

  it('restores the filtered job through the service and reports it', async () => {
    const user = userEvent.setup();
    render(<Archive />);

    await user.selectOptions(monthFilter(), '2025-09');
    await user.click(await screen.findByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(testState.restoreJob).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'current-user' }),
        'sept-2025',
      );
    });
    expect(testState.toast).toHaveBeenCalledWith(
      '“September 2025 job” is back in the pipeline.',
      'success',
    );
  });
});
