import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../context/AuthProvider';
import type { Job, Machine, UserRole } from '../types';
import { JobForm } from '../components/JobForm';
import { JobPanel, jobPanelTabs, type JobPanelState } from '../components/JobPanel';
import Maintenance from '../pages/Maintenance';

const testState = vi.hoisted(() => ({
  auth: null as unknown,
  machines: null as unknown,
}));

vi.mock('../context/AuthProvider', () => ({
  useAuth: () => testState.auth,
}));

vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));

vi.mock('../routes/Workspace', () => ({
  useMachinesOutlet: () => testState.machines,
}));

vi.mock('../components/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('../services/userService', () => ({
  watchAssignableUsers: () => () => undefined,
}));

vi.mock('../services/machineService', () => ({
  addMachine: vi.fn(),
  addProcedure: vi.fn(),
  deleteMachine: vi.fn(),
  editMachine: vi.fn(),
  filterMachines: (machines: Machine[]) => machines,
  logCheckedMaintenance: vi.fn(),
  removeProcedure: vi.fn(),
  setProcedureDone: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({ db: {} }));

function setRole(role: UserRole, uid = 'current-user') {
  testState.auth = {
    authUser: { uid, email: 'alex@example.com' } as AuthState['authUser'],
    profile: {
      uid,
      name: 'Alex Worker',
      email: 'alex@example.com',
      role,
      status: 'active',
      createdAt: null,
      updatedAt: null,
    },
    firstName: 'Alex',
    profileError: false,
    isActive: true,
    isAdmin: role === 'admin',
    isManagerOrAdmin: role === 'manager' || role === 'admin',
    actor: { uid, firstName: 'Alex', displayName: 'Alex Worker', email: 'alex@example.com' },
    assigner: { uid, name: 'Alex Worker', role },
  } satisfies AuthState;
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    tags: [],
    id: 'job-1',
    orderNumber: 'G3D-JOB-1',
    name: 'Event badges',
    customer: 'Receiver',
    quantity: 10,
    completedQuantity: 2,
    dueDate: new Date('2099-06-15T23:59:59'),
    status: 'started',
    category: 'manufacturing',
    repairProcesses: [{ name: 'Design', progress: 40, collaboratorUid: 'current-user' }],
    isAwf: false,
    createdByUid: 'creator',
    createdByName: 'Creator',
    createdByEmail: 'creator@example.com',
    assignedToUid: 'current-user',
    assignedToName: 'Alex Worker',
    assignedToRole: 'staff',
    assignedByUid: '',
    assignedByName: '',
    assignedAt: null,
    collaborators: [{ uid: 'current-user', name: 'Alex Worker', role: 'staff' }],
    collaboratorUids: ['current-user'],
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

function renderPanel(state: JobPanelState, onClose = vi.fn()) {
  const handlers = {
    onTabChange: vi.fn(),
    onClose,
    onSaveDetails: vi.fn().mockResolvedValue(undefined),
    onSaveUnits: vi.fn().mockResolvedValue(undefined),
    onSaveSections: vi.fn().mockResolvedValue(undefined),
    onSaveTeam: vi.fn().mockResolvedValue(undefined),
    onClearTeam: vi.fn().mockResolvedValue(undefined),
  };
  render(<JobPanel state={state} {...handlers} />);
  return handlers;
}

beforeEach(() => {
  setRole('manager');
});

describe('editing an overdue job', () => {
  it('saves a rename without forcing a new deadline', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const overdue = job({ dueDate: new Date('2020-03-04T23:59:59'), status: 'pending' });
    render(<JobForm initial={overdue} submitLabel="Save changes" onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText('Job Name'));
    await user.type(screen.getByLabelText('Job Name'), 'Renamed frame');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reason for deadline change')).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Renamed frame', dueDateChangeNote: undefined }),
    );
  });

  it('still refuses moving the deadline to another past day', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const overdue = job({ dueDate: new Date('2020-03-04T23:59:59'), status: 'pending' });
    render(<JobForm initial={overdue} submitLabel="Save changes" onSubmit={onSubmit} onCancel={vi.fn()} />);

    const deadline = screen.getByLabelText('Deadline');
    await user.clear(deadline);
    await user.type(deadline, '2020-03-01');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Deadline cannot be in the past.');
    expect(screen.getByLabelText('Deadline')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a rejected save inside the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue('Missing or insufficient permissions.');
    render(<JobForm initial={job()} submitLabel="Save changes" onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing or insufficient permissions.',
    );
  });

  it('warns before a rename clears a section’s progress and owner', async () => {
    const user = userEvent.setup();
    render(<JobForm initial={job()} submitLabel="Save changes" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const sections = screen.getByLabelText('Job sections');
    await user.clear(sections);
    await user.type(sections, 'Concept');
    expect(screen.getByText(/Saving clears the progress and owner of/)).toHaveTextContent('Design');
  });
});

describe('job panel tabs', () => {
  it('gives a manager details, progress, and team on a started job', () => {
    const tabs = jobPanelTabs(job(), { uid: 'current-user', role: 'manager' }).map((t) => t.id);
    expect(tabs).toEqual(['details', 'units', 'sections', 'team']);
  });

  it('gives a collaborating staff member progress only', () => {
    const tabs = jobPanelTabs(job(), { uid: 'current-user', role: 'staff' }).map((t) => t.id);
    expect(tabs).toEqual(['units', 'sections']);
  });

  it('opens on the requested tab with the job named in its header', () => {
    renderPanel({ job: job(), tab: 'units' });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Event badges' })).toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: /Units/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByLabelText('Units completed')).toHaveValue(2);
  });
});

describe('unsaved changes in the job panel', () => {
  it('asks before closing over edits, and keeps them on "Keep editing"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPanel({ job: job(), tab: 'details' }, onClose);

    await user.type(screen.getByLabelText('Job Name'), ' v2');
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Job Name')).toHaveValue('Event badges v2');

    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes straight away when nothing has changed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPanel({ job: job(), tab: 'details' }, onClose);
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('compact machine card', () => {
  function machine(overrides: Partial<Machine> = {}): Machine {
    return {
      id: 'machine-1',
      name: 'Laser cutter',
      location: 'Workshop A',
      notes: '',
      procedures: [{ id: 'p1', title: 'Clean lens', isDone: false }],
      maintenanceHistory: [
        {
          completedAt: new Date('2026-09-20T10:00:00'),
          procedureTitles: ['Clean lens'],
          completedByName: 'Newest Tech',
          notes: 'Latest service note.',
        },
        {
          completedAt: new Date('2026-08-02T10:00:00'),
          procedureTitles: ['Clean lens'],
          completedByName: 'Older Tech',
          notes: 'Older service note.',
        },
      ],
      createdAt: null,
      createdByUid: '',
      createdByName: '',
      updatedAt: null,
      updatedByUid: '',
      updatedByName: '',
      ...overrides,
    };
  }

  it('shows only the latest log, with the rest in the history panel', async () => {
    const user = userEvent.setup();
    testState.machines = { machines: [machine()], loading: false, error: null, retry: vi.fn() };
    render(<Maintenance />);

    expect(screen.getByText('Latest service note.')).toBeInTheDocument();
    expect(screen.queryByText('Older service note.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /History/ }));
    const panel = await screen.findByRole('dialog');
    await waitFor(() => expect(within(panel).getByText('Older service note.')).toBeInTheDocument());
    expect(within(panel).getByText('Latest service note.')).toBeInTheDocument();
  });
});
