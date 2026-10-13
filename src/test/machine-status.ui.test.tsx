import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../context/AuthProvider';
import type { AppUser, Machine, UserRole } from '../types';
import Maintenance from '../pages/Maintenance';
import { OPERATIONAL_MACHINE_FIELDS } from '../lib/machineStatus';

const testState = vi.hoisted(() => ({
  auth: null as unknown,
  machines: null as unknown,
  toast: vi.fn(),
  reportMachineDown: vi.fn(async () => undefined),
  assignMachineRepair: vi.fn(async () => undefined),
  markMachineRepaired: vi.fn(async () => undefined),
}));

vi.mock('../context/AuthProvider', () => ({ useAuth: () => testState.auth }));
vi.mock('../context/AppearanceProvider', () => ({ useAppearance: () => ({ motionReduced: true }) }));
vi.mock('../routes/Workspace', () => ({ useMachinesOutlet: () => testState.machines }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ toast: testState.toast }) }));

const people: AppUser[] = [
  { uid: 'staff-2', name: 'Sam Staff', email: 'sam@test.dev', role: 'staff', status: 'active', createdAt: null, updatedAt: null },
  { uid: 'manager-1', name: 'Mia Manager', email: 'mia@test.dev', role: 'manager', status: 'active', createdAt: null, updatedAt: null },
];
vi.mock('../services/userService', () => ({
  watchActiveUsers: (onUsers: (users: AppUser[]) => void) => {
    onUsers(people);
    return () => undefined;
  },
}));

vi.mock('../services/machineService', () => ({
  addMachine: vi.fn(),
  addProcedure: vi.fn(),
  assignMachineRepair: (...args: unknown[]) => (testState.assignMachineRepair as (...a: unknown[]) => unknown)(...args),
  deleteMachine: vi.fn(),
  editMachine: vi.fn(),
  filterMachines: (machines: Machine[]) => machines,
  logCheckedMaintenance: vi.fn(),
  markMachineRepaired: (...args: unknown[]) => (testState.markMachineRepaired as (...a: unknown[]) => unknown)(...args),
  removeProcedure: vi.fn(),
  reportMachineDown: (...args: unknown[]) => (testState.reportMachineDown as (...a: unknown[]) => unknown)(...args),
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

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: 'machine-1',
    name: 'Laser cutter',
    location: 'Workshop A',
    notes: '',
    procedures: [],
    maintenanceHistory: [],
    createdAt: null,
    createdByUid: '',
    createdByName: '',
    updatedAt: null,
    updatedByUid: '',
    updatedByName: '',
    ...OPERATIONAL_MACHINE_FIELDS,
    ...overrides,
  };
}

function setMachines(machines: Machine[]) {
  testState.machines = { machines, loading: false, error: null, retry: vi.fn() };
}

const DOWN = {
  status: 'down',
  downReason: 'Tube not firing',
  downSince: new Date('2026-10-01T09:00:00'),
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  setRole('staff');
  setMachines([machine()]);
});

describe('machine status on the Maintenance page', () => {
  it('shows no down pill for a working machine, and offers Report down', () => {
    render(<Maintenance />);
    expect(screen.queryByTestId('machine-down-pill')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report down/i })).toBeInTheDocument();
  });

  it('shows the pill, fault and a Down count for a machine that is down', () => {
    setMachines([machine(), machine({ id: 'machine-2', name: 'Bandsaw', ...DOWN })]);
    render(<Maintenance />);
    expect(screen.getByTestId('machine-down-pill')).toHaveTextContent('Down · Unassigned');
    expect(screen.getByText('Tube not firing')).toBeInTheDocument();
    const tile = screen.getByText('Down', { selector: 'p.technical-label' }).parentElement!;
    expect(tile).toHaveTextContent('1');
  });

  it('lists machines that are down first', () => {
    setMachines([machine({ id: 'a', name: 'Anvil' }), machine({ id: 'z', name: 'Zund', ...DOWN })]);
    render(<Maintenance />);
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(['Zund', 'Anvil']);
  });

  it('flags a repair assigned to the signed-in user', () => {
    setRole('staff', 'staff-2');
    setMachines([
      machine({ ...DOWN, repairAssignedToUid: 'staff-2', repairAssignedToName: 'Sam Staff' }),
    ]);
    render(<Maintenance />);
    expect(screen.getByTestId('machine-down-pill')).toHaveTextContent('Down · Sam Staff');
    expect(screen.getByText('Assigned to you')).toBeInTheDocument();
  });

  it('requires a reason before reporting down, then reports the trimmed text', async () => {
    const user = userEvent.setup();
    render(<Maintenance />);
    await user.click(screen.getByRole('button', { name: /report down/i }));
    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Report down' });
    expect(submit).toBeDisabled();

    await user.type(within(dialog).getByLabelText('What is wrong?'), '  Hotend clogged  ');
    await user.click(submit);

    await waitFor(() =>
      expect(testState.reportMachineDown).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'current-user', role: 'staff' }),
        expect.objectContaining({ id: 'machine-1' }),
        'Hotend clogged',
      ),
    );
  });

  it('hides Assign repair from staff but lets them mark repaired after confirming', async () => {
    const user = userEvent.setup();
    setMachines([machine(DOWN)]);
    render(<Maintenance />);
    expect(screen.queryByRole('button', { name: /assign repair/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark repaired' }));
    const dialog = await screen.findByRole('dialog');
    expect(testState.markMachineRepaired).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Mark repaired' }));

    await waitFor(() =>
      expect(testState.markMachineRepaired).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'current-user' }),
        expect.objectContaining({ id: 'machine-1' }),
      ),
    );
  });

  it('lets a manager pick who repairs it', async () => {
    const user = userEvent.setup();
    setRole('manager');
    setMachines([machine(DOWN)]);
    render(<Maintenance />);

    await user.click(screen.getByRole('button', { name: /assign repair/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Sam Staff/ }));

    await waitFor(() =>
      expect(testState.assignMachineRepair).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'current-user', role: 'manager' }),
        expect.objectContaining({ id: 'machine-1' }),
        expect.objectContaining({ uid: 'staff-2' }),
      ),
    );
  });

  it('lets a manager unassign an assigned repair', async () => {
    const user = userEvent.setup();
    setRole('admin');
    setMachines([
      machine({ ...DOWN, repairAssignedToUid: 'staff-2', repairAssignedToName: 'Sam Staff' }),
    ]);
    render(<Maintenance />);

    await user.click(screen.getByRole('button', { name: /reassign repair/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Unassign/ }));

    await waitFor(() =>
      expect(testState.assignMachineRepair).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: 'machine-1' }),
        null,
      ),
    );
  });
});
