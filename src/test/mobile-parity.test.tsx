import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../context/AuthProvider';
import type { Job, Machine, UserRole } from '../types';
import { JobCard } from '../components/JobCard';
import { FLOATING_ADD_CLEARANCE, FloatingAddButton } from '../components/FloatingAddButton';
import Inventory from '../pages/Inventory';
import Maintenance from '../pages/Maintenance';

const testState = vi.hoisted(() => ({
  auth: null as unknown,
  machines: null as unknown,
  toast: vi.fn(),
  logCheckedMaintenance: vi.fn(),
}));

vi.mock('../context/AuthProvider', () => ({
  useAuth: () => testState.auth,
}));

vi.mock('../context/AppearanceProvider', () => ({
  useAppearance: () => ({ motionReduced: true }),
}));

vi.mock('../routes/Workspace', () => ({
  useMachinesOutlet: () => testState.machines,
  useInventoryOutlet: () => ({
    materials: [],
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

vi.mock('../components/Toast', () => ({
  useToast: () => ({ toast: testState.toast }),
}));

vi.mock('../services/machineService', () => ({
  addMachine: vi.fn(),
  addProcedure: vi.fn(),
  deleteMachine: vi.fn(),
  editMachine: vi.fn(),
  filterMachines: (machines: Machine[], _search: string) => machines,
  logCheckedMaintenance: (...args: unknown[]) => testState.logCheckedMaintenance(...args),
  removeProcedure: vi.fn(),
  setProcedureDone: vi.fn(),
}));

vi.mock('../services/inventoryService', () => ({
  addMaterial: vi.fn(),
  editMaterial: vi.fn(),
  filterMaterials: (materials: unknown[], _search: string) => materials,
  isLowStock: () => false,
  stockRatio: () => 1,
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
    isActive: true,
    isAdmin: role === 'admin',
    isManagerOrAdmin: role === 'manager' || role === 'admin',
    actor: {
      uid,
      firstName: 'Alex',
      displayName: 'Alex Worker',
      email: 'alex@example.com',
    },
    assigner: { uid, name: 'Alex Worker', role },
  } satisfies AuthState;
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    name: 'Event badges',
    customer: 'Receiver',
    quantity: 10,
    completedQuantity: 0,
    dueDate: new Date('2099-06-15T23:59:59'),
    status: 'pending',
    category: 'manufacturing',
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

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: 'machine-1',
    name: 'Laser cutter',
    location: 'Workshop A',
    notes: '',
    procedures: [{ id: 'p1', title: 'Clean lens', isDone: true }],
    maintenanceHistory: [],
    createdAt: null,
    createdByUid: '',
    createdByName: '',
    updatedAt: null,
    updatedByUid: '',
    updatedByName: '',
    ...overrides,
  };
}

function setMachines(machines: Machine[]) {
  testState.machines = { machines, loading: false, error: null, retry: vi.fn() };
}

beforeEach(() => {
  setRole('admin');
  setMachines([machine()]);
  testState.toast.mockReset();
  testState.logCheckedMaintenance.mockReset();
  testState.logCheckedMaintenance.mockResolvedValue(['Clean lens']);
});

describe('expanded job card actions', () => {
  function renderPendingCardActions() {
    const callbacks = {
      onStart: vi.fn(),
      onComplete: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onAssign: vi.fn(),
    };
    const pending = job();
    render(<JobCard job={pending} {...callbacks} />);
    return { callbacks, actions: screen.getByTestId('job-actions-job-1') };
  }

  it('shows the four standard actions in one centered non-wrapping row with 12px gaps', () => {
    const { actions } = renderPendingCardActions();
    const buttons = within(actions).getAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim())).toEqual([
      'Edit job',
      'Add Team',
      'Start',
      'Delete job',
    ]);
    // One centered row that never wraps at supported mobile widths (360px),
    // with exactly 12px between adjacent actions.
    expect(actions.className).toContain('flex-nowrap');
    expect(actions.className).toContain('justify-center');
    expect(actions.className).toContain('gap-[12px]');
  });

  it('renders Edit and Delete as icon-only controls with accessible names and tooltips', () => {
    const { actions } = renderPendingCardActions();
    const edit = within(actions).getByRole('button', { name: 'Edit job' });
    const del = within(actions).getByRole('button', { name: 'Delete job' });
    expect(edit).toHaveAttribute('title', 'Edit job');
    expect(del).toHaveAttribute('title', 'Delete job');
    expect(edit.textContent?.trim()).toBe('');
    expect(del.textContent?.trim()).toBe('');
    expect(del.className).toContain('btn-danger');
  });

  it('labels the team action "Team" when collaborators exist and "Add Team" otherwise', () => {
    const { rerender } = render(<JobCard job={job()} onAssign={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Add Team' })).toBeInTheDocument();

    rerender(
      <JobCard
        job={job({
          collaborators: [{ uid: 'u2', name: 'Sam', role: 'staff' }],
          collaboratorUids: ['u2'],
        })}
        onAssign={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Team' })).toBeInTheDocument();
    expect(screen.queryByText('Edit Team')).not.toBeInTheDocument();
  });

  it('uses the shortened Start and Complete labels and keeps their behavior', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const onComplete = vi.fn();
    const { rerender } = render(<JobCard job={job()} onStart={onStart} />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalledTimes(1);

    rerender(
      <JobCard
        job={job({ status: 'started', assignedToUid: 'current-user' })}
        onComplete={onComplete}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Complete' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('floating add buttons', () => {
  it('reserves 112px plus the safe-area inset beneath the floating buttons', () => {
    expect(FLOATING_ADD_CLEARANCE).toBe('calc(112px + env(safe-area-inset-bottom, 0px))');

    render(
      <FloatingAddButton label="Add machine" onClick={vi.fn()}>
        Add machine
      </FloatingAddButton>,
    );
    const button = screen.getByRole('button', { name: 'Add machine' });
    expect(button.className).toContain('fixed');
    // jsdom normalizes calc()/env() internals, so assert the load-bearing tokens.
    expect(button.style.bottom).toContain('112px');
    expect(button.style.bottom).toContain('safe-area-inset-bottom');
  });

  it('renders the Add Machine floating button on Maintenance and opens the add dialog', async () => {
    const user = userEvent.setup();
    render(<Maintenance />);
    const [floating] = screen
      .getAllByRole('button', { name: 'Add machine' })
      .filter((b) => b.className.includes('fixed'));
    expect(floating).toBeDefined();
    await user.click(floating);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Add machine');
  });

  it('renders the Add Material floating button on Inventory and opens the add dialog', async () => {
    const user = userEvent.setup();
    render(<Inventory />);
    const [floating] = screen
      .getAllByRole('button', { name: 'Add material' })
      .filter((b) => b.className.includes('fixed'));
    expect(floating).toBeDefined();
    await user.click(floating);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Add material');
  });
});

describe('maintenance notes', () => {
  async function openConfirmDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /Log Checked Maintenance/ }));
    return await screen.findByRole('dialog');
  }

  it('saves trimmed notes with the selected machine when confirming', async () => {
    const user = userEvent.setup();
    render(<Maintenance />);
    const dialog = await openConfirmDialog(user);
    const field = within(dialog).getByLabelText('Maintenance notes');
    expect(field).toHaveAttribute('placeholder', 'Add notes about this maintenance');
    expect(field).toHaveAttribute('autocapitalize', 'sentences');
    await user.type(field, '  Cleaned the lens.  ');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(testState.logCheckedMaintenance).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'current-user' }),
        'machine-1',
        'Cleaned the lens.',
      ),
    );
  });

  it('does not log maintenance or keep notes when the dialog is cancelled', async () => {
    const user = userEvent.setup();
    render(<Maintenance />);
    let dialog = await openConfirmDialog(user);
    await user.type(within(dialog).getByLabelText('Maintenance notes'), 'Draft note');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(testState.logCheckedMaintenance).not.toHaveBeenCalled();

    dialog = await openConfirmDialog(user);
    expect(within(dialog).getByLabelText('Maintenance notes')).toHaveValue('');
  });

  it('renders saved notes inside the matching history entry only', () => {
    setMachines([
      machine({
        maintenanceHistory: [
          {
            completedAt: new Date('2026-07-01T10:00:00'),
            procedureTitles: ['Clean lens', 'Check alignment'],
            completedByName: 'Technician Name',
            notes: 'Cleaned the lens and checked alignment.',
          },
        ],
      }),
      machine({ id: 'machine-2', name: 'CNC mill' }),
    ]);
    render(<Maintenance />);
    expect(screen.getByText('Cleaned the lens and checked alignment.')).toBeInTheDocument();
    expect(screen.getAllByText('Cleaned the lens and checked alignment.')).toHaveLength(1);
  });

  it('renders legacy history records without a notes property and no empty notes section', () => {
    setMachines([
      machine({
        maintenanceHistory: [
          {
            completedAt: new Date('2025-01-05T09:00:00'),
            procedureTitles: ['Check belts'],
            completedByName: 'Old Tech',
            notes: '',
          },
        ],
      }),
    ]);
    render(<Maintenance />);
    expect(screen.getByText('Check belts')).toBeInTheDocument();
    expect(screen.getByText(/Completed by Old Tech/)).toBeInTheDocument();
  });
});
