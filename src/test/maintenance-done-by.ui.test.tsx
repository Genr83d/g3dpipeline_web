import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../context/AuthProvider';
import type { AppUser, Machine, MaintenanceHistoryRecord } from '../types';
import Maintenance from '../pages/Maintenance';
import { OPERATIONAL_MACHINE_FIELDS } from '../lib/machineStatus';

/** A maintenance log names who did the work, which is not always the person
 *  who entered it. */
const testState = vi.hoisted(() => ({
  auth: null as unknown,
  machines: null as unknown,
  toast: vi.fn(),
  logCheckedMaintenance: vi.fn(async () => ['Clean lens']),
}));

vi.mock('../context/AuthProvider', () => ({ useAuth: () => testState.auth }));
vi.mock('../context/AppearanceProvider', () => ({ useAppearance: () => ({ motionReduced: true }) }));
vi.mock('../routes/Workspace', () => ({ useMachinesOutlet: () => testState.machines }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ toast: testState.toast }) }));

const people: AppUser[] = [
  { uid: 'staff-2', name: 'Sam Staff', email: 'sam@test.dev', role: 'staff', status: 'active', createdAt: null, updatedAt: null },
  // The team list includes the signed-in person too.
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
  assignMachineRepair: vi.fn(),
  deleteMachine: vi.fn(),
  editMachine: vi.fn(),
  filterMachines: (machines: Machine[]) => machines,
  logCheckedMaintenance: (...args: unknown[]) =>
    (testState.logCheckedMaintenance as (...a: unknown[]) => unknown)(...args),
  markMachineRepaired: vi.fn(),
  removeProcedure: vi.fn(),
  reportMachineDown: vi.fn(),
  setProcedureDone: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({ db: {} }));

function signInAsMia() {
  const uid = 'manager-1';
  testState.auth = {
    authUser: { uid, email: 'mia@test.dev' } as AuthState['authUser'],
    profile: {
      uid,
      name: 'Mia Manager',
      email: 'mia@test.dev',
      role: 'manager',
      status: 'active',
      createdAt: null,
      updatedAt: null,
    },
    firstName: 'Mia',
    profileError: false,
    isActive: true,
    isAdmin: false,
    isManagerOrAdmin: true,
    actor: { uid, firstName: 'Mia', displayName: 'Mia Manager', email: 'mia@test.dev' },
    assigner: { uid, name: 'Mia Manager', role: 'manager' },
  } satisfies AuthState;
}

function record(overrides: Partial<MaintenanceHistoryRecord>): MaintenanceHistoryRecord {
  return {
    completedAt: new Date('2026-10-20T10:00:00'),
    procedureTitles: ['Clean lens'],
    completedByName: 'Sam Staff',
    completedByUid: 'staff-2',
    loggedByUid: 'manager-1',
    loggedByName: 'Mia Manager',
    notes: '',
    ...overrides,
  };
}

function setMachine(history: MaintenanceHistoryRecord[] = []) {
  const machine: Machine = {
    id: 'machine-1',
    name: 'Laser cutter',
    location: 'Workshop A',
    notes: '',
    procedures: [{ id: 'p1', title: 'Clean lens', isDone: true }],
    maintenanceHistory: history,
    createdAt: null,
    createdByUid: '',
    createdByName: '',
    updatedAt: null,
    updatedByUid: '',
    updatedByName: '',
    ...OPERATIONAL_MACHINE_FIELDS,
  };
  testState.machines = { machines: [machine], loading: false, error: null, retry: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  signInAsMia();
  setMachine();
});

async function openConfirm(user: ReturnType<typeof userEvent.setup>) {
  render(<Maintenance />);
  await user.click(screen.getByRole('button', { name: /Log Checked Maintenance/ }));
  const dialog = await screen.findByRole('dialog');
  return {
    dialog,
    doneBy: within(dialog).getByLabelText('Who did the maintenance?'),
    confirm: within(dialog).getByRole('button', { name: 'Confirm' }),
  };
}

describe('logging who did the maintenance', () => {
  it('credits nobody until someone is picked', async () => {
    const user = userEvent.setup();
    const { doneBy, confirm } = await openConfirm(user);
    expect(doneBy).toHaveValue('');
    expect(confirm).toBeDisabled();
  });

  it('lists the logger first as Me, once, then the rest of the team', async () => {
    const user = userEvent.setup();
    const { doneBy } = await openConfirm(user);
    const options = within(doneBy)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'Choose who did the work',
      'Me (Mia Manager)',
      'Sam Staff',
      'Someone else',
    ]);
  });

  it('credits a teammate for the work Mia logs', async () => {
    const user = userEvent.setup();
    const { dialog, doneBy, confirm } = await openConfirm(user);
    await user.selectOptions(doneBy, 'Sam Staff');
    await user.type(within(dialog).getByLabelText('Maintenance notes'), 'Sam cleaned it.');
    await user.click(confirm);

    await waitFor(() =>
      expect(testState.logCheckedMaintenance).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'manager-1' }),
        'machine-1',
        { uid: 'staff-2', name: 'Sam Staff' },
        'Sam cleaned it.',
      ),
    );
  });

  it('credits someone outside the team once their name is typed', async () => {
    const user = userEvent.setup();
    const { dialog, doneBy, confirm } = await openConfirm(user);
    await user.selectOptions(doneBy, 'Someone else');
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Their name'), '  Dale (Epson)  ');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() =>
      expect(testState.logCheckedMaintenance).toHaveBeenCalledWith(
        expect.anything(),
        'machine-1',
        { uid: '', name: 'Dale (Epson)' },
        '',
      ),
    );
  });

  it('starts fresh each time the dialog opens', async () => {
    const user = userEvent.setup();
    const first = await openConfirm(user);
    await user.selectOptions(first.doneBy, 'Sam Staff');
    await user.click(within(first.dialog).getByRole('button', { name: 'Cancel' }));
    expect(testState.logCheckedMaintenance).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Log Checked Maintenance/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Who did the maintenance?')).toHaveValue('');
  });
});

describe('showing who did the maintenance', () => {
  it('names both people on the card when someone else logged the work', () => {
    setMachine([record({})]);
    render(<Maintenance />);
    expect(screen.getByText('Completed by Sam Staff · logged by Mia Manager')).toBeInTheDocument();
  });

  it('shows the full attribution in the history panel', async () => {
    const user = userEvent.setup();
    setMachine([
      record({}),
      record({
        completedAt: new Date('2026-09-01T10:00:00'),
        completedByName: 'Old Tech',
        completedByUid: '',
        loggedByUid: '',
        loggedByName: '',
      }),
    ]);
    render(<Maintenance />);
    await user.click(screen.getByRole('button', { name: /History/ }));
    const panel = await screen.findByRole('dialog');

    expect(within(panel).getByText('Completed by Sam Staff · logged by Mia Manager')).toBeInTheDocument();
    // Older records only ever saved the logger's name.
    expect(within(panel).getByText('Logged by Old Tech')).toBeInTheDocument();
    expect(within(panel).queryByText(/Completed by Old Tech/)).not.toBeInTheDocument();
  });
});
