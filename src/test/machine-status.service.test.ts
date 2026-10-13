import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(() => ({ kind: 'collection' })),
  doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({ collectionName, id })),
  updateDoc: vi.fn(async (_ref: unknown, _patch: unknown) => undefined),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
  deleteField: vi.fn(() => ({ kind: 'deleteField' })),
}));

vi.mock('firebase/firestore', () => ({
  collection: firestore.collection,
  doc: firestore.doc,
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: firestore.updateDoc,
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: firestore.serverTimestamp,
  deleteField: firestore.deleteField,
  runTransaction: vi.fn(),
  Timestamp: { now: vi.fn() },
}));

vi.mock('../lib/firebase', () => ({ db: {} }));

import {
  assignMachineRepair,
  markMachineRepaired,
  reportMachineDown,
} from '../services/machineService';
import { OPERATIONAL_MACHINE_FIELDS } from '../lib/machineStatus';
import type { AppUser, Machine, UserRole } from '../types';

const SERVER_TIME = { kind: 'serverTimestamp' };
const DELETE = { kind: 'deleteField' };

function actor(role: UserRole, uid = `${role}-1`) {
  return { uid, firstName: 'Pat', displayName: `Pat ${role}`, email: `${uid}@test.dev`, role };
}

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: 'm1',
    name: 'Laser cutter',
    location: 'Workshop',
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

function user(overrides: Partial<AppUser> = {}): AppUser {
  return {
    uid: 'staff-2',
    name: 'Sam Staff',
    email: 'sam@test.dev',
    role: 'staff',
    status: 'active',
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function patch(): Record<string, unknown> {
  return firestore.updateDoc.mock.calls[0][1] as Record<string, unknown>;
}

beforeEach(() => {
  firestore.updateDoc.mockClear();
});

describe('reportMachineDown', () => {
  it('marks the machine down with who reported it and when', async () => {
    await reportMachineDown(actor('staff'), machine(), '  Hotend clogged  ');
    expect(firestore.updateDoc.mock.calls[0][0]).toEqual({ collectionName: 'machines', id: 'm1' });
    expect(patch()).toMatchObject({
      status: 'down',
      downReason: 'Hotend clogged',
      downSince: SERVER_TIME,
      downReportedByUid: 'staff-1',
      downReportedByName: 'Pat staff',
      updatedAt: SERVER_TIME,
      updatedByUid: 'staff-1',
    });
  });

  it('keeps the original down-since time when the fault is reported again', async () => {
    await reportMachineDown(actor('manager'), machine({ status: 'down' }), 'Still broken');
    const written = patch();
    expect(written.downReason).toBe('Still broken');
    expect(written).not.toHaveProperty('downSince');
    expect(written).not.toHaveProperty('downReportedByUid');
  });

  it('requires a reason', async () => {
    await expect(reportMachineDown(actor('staff'), machine(), '   ')).rejects.toThrow(
      /what is wrong/i,
    );
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('refuses AWF accounts', async () => {
    await expect(reportMachineDown(actor('awf'), machine(), 'Broken')).rejects.toThrow(
      /cannot report/i,
    );
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });
});

describe('assignMachineRepair', () => {
  const down = machine({ status: 'down' });

  it('records the assignee, who assigned them and when', async () => {
    await assignMachineRepair(actor('manager'), down, user());
    expect(patch()).toMatchObject({
      repairAssignedToUid: 'staff-2',
      repairAssignedToName: 'Sam Staff',
      repairAssignedByUid: 'manager-1',
      repairAssignedByName: 'Pat manager',
      repairAssignedAt: SERVER_TIME,
      updatedByUid: 'manager-1',
    });
  });

  it('falls back to the email when the account has no name', async () => {
    await assignMachineRepair(actor('admin'), down, user({ name: ' ' }));
    expect(patch().repairAssignedToName).toBe('sam@test.dev');
  });

  it('clears the assignment when given nobody', async () => {
    await assignMachineRepair(actor('manager'), machine({ status: 'down', repairAssignedToUid: 'x' }), null);
    expect(patch()).toMatchObject({
      repairAssignedToUid: '',
      repairAssignedToName: '',
      repairAssignedByUid: DELETE,
      repairAssignedByName: DELETE,
      repairAssignedAt: DELETE,
    });
  });

  it('refuses staff, inactive assignees and machines that are not down', async () => {
    await expect(assignMachineRepair(actor('staff'), down, user())).rejects.toThrow(
      /only managers and admins/i,
    );
    await expect(
      assignMachineRepair(actor('manager'), down, user({ status: 'disabled' })),
    ).rejects.toThrow(/active accounts/i);
    await expect(assignMachineRepair(actor('manager'), machine(), user())).rejects.toThrow(
      /needs a repair/i,
    );
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });
});

describe('markMachineRepaired', () => {
  it('returns the machine to operational and clears the down and assignee fields', async () => {
    await markMachineRepaired(
      actor('staff'),
      machine({ status: 'down', repairAssignedToUid: 'staff-1' }),
    );
    expect(patch()).toMatchObject({
      status: 'operational',
      downReason: '',
      downSince: DELETE,
      repairAssignedToUid: '',
      repairAssignedToName: '',
      repairAssignedByUid: DELETE,
      repairAssignedAt: DELETE,
      lastRepairedAt: SERVER_TIME,
      lastRepairedByName: 'Pat staff',
      updatedByUid: 'staff-1',
    });
  });

  it('refuses AWF accounts', async () => {
    await expect(markMachineRepaired(actor('awf'), machine({ status: 'down' }))).rejects.toThrow(
      /cannot mark/i,
    );
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });
});
