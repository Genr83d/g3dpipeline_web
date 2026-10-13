import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  deleteField: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(),
  runTransaction: vi.fn(),
  Timestamp: { now: vi.fn() },
}));

import {
  OPERATIONAL_MACHINE_FIELDS,
  canAssignMachineRepair,
  canMarkMachineRepaired,
  canReportMachineDown,
  compareMachines,
  hasRepairAssignee,
  isMachineDown,
  isRepairAssignedTo,
  machineDownLabel,
} from '../lib/machineStatus';
import { filterMachines, parseMachine } from '../services/machineService';
import type { Machine, UserRole } from '../types';

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

const viewer = (role: UserRole) => ({ uid: `${role}-1`, role });

describe('machine status permissions', () => {
  it('lets everyone outside AWF report down and mark repaired', () => {
    for (const role of ['staff', 'manager', 'admin'] as const) {
      expect(canReportMachineDown(viewer(role))).toBe(true);
      expect(canMarkMachineRepaired(viewer(role))).toBe(true);
    }
    expect(canReportMachineDown(viewer('awf'))).toBe(false);
    expect(canMarkMachineRepaired(viewer('awf'))).toBe(false);
  });

  it('lets only managers and admins assign the repair', () => {
    expect(canAssignMachineRepair(viewer('admin'))).toBe(true);
    expect(canAssignMachineRepair(viewer('manager'))).toBe(true);
    expect(canAssignMachineRepair(viewer('staff'))).toBe(false);
    expect(canAssignMachineRepair(viewer('awf'))).toBe(false);
  });
});

describe('machine status helpers', () => {
  it('reads a machine without status fields as operational and unassigned', () => {
    const legacy = parseMachine('m1', { name: 'Lathe', location: 'Bay 1' });
    expect(legacy.status).toBe('operational');
    expect(isMachineDown(legacy)).toBe(false);
    expect(legacy.downReason).toBe('');
    expect(legacy.downSince).toBeNull();
    expect(hasRepairAssignee(legacy)).toBe(false);
    expect(legacy.lastRepairedAt).toBeNull();
  });

  it('parses a down machine with its repair assignee', () => {
    const parsed = parseMachine('m1', {
      name: 'Lathe',
      status: 'down',
      downReason: 'Spindle seized',
      downSince: new Date('2026-10-01T09:00:00'),
      repairAssignedToUid: 'staff-1',
      repairAssignedToName: 'Sam',
      repairAssignedByName: 'Mia',
      repairAssignedAt: new Date('2026-10-02T09:00:00'),
    });
    expect(parsed.status).toBe('down');
    expect(parsed.downReason).toBe('Spindle seized');
    expect(parsed.downSince).toEqual(new Date('2026-10-01T09:00:00'));
    expect(parsed.repairAssignedToName).toBe('Sam');
    expect(isRepairAssignedTo(parsed, 'staff-1')).toBe(true);
    expect(isRepairAssignedTo(parsed, 'manager-1')).toBe(false);
    expect(isRepairAssignedTo(parsed, '')).toBe(false);
  });

  it('ignores unknown status values and wrongly typed fields', () => {
    const parsed = parseMachine('m1', { name: 'Lathe', status: 'broken', downReason: 42 });
    expect(parsed.status).toBe('operational');
    expect(parsed.downReason).toBe('');
  });

  it('labels the pill with the repairer, or Unassigned', () => {
    expect(machineDownLabel(machine({ status: 'down' }))).toBe('Down · Unassigned');
    expect(
      machineDownLabel(
        machine({ status: 'down', repairAssignedToUid: 'u', repairAssignedToName: 'Sam' }),
      ),
    ).toBe('Down · Sam');
  });

  it('sorts machines that are down first, then by name', () => {
    const sorted = [
      machine({ id: 'b', name: 'Bandsaw' }),
      machine({ id: 'z', name: 'Zund', status: 'down' }),
      machine({ id: 'a', name: 'Anvil' }),
      machine({ id: 'c', name: 'Cutter', status: 'down' }),
    ].sort(compareMachines);
    expect(sorted.map((m) => m.id)).toEqual(['c', 'z', 'a', 'b']);
  });

  it('searches by fault and repairer', () => {
    const machines = [
      machine({ id: 'a', name: 'Anvil' }),
      machine({
        id: 'b',
        name: 'Bandsaw',
        status: 'down',
        downReason: 'Blade snapped',
        repairAssignedToUid: 'u',
        repairAssignedToName: 'Sam Staff',
      }),
    ];
    expect(filterMachines(machines, 'snapped').map((m) => m.id)).toEqual(['b']);
    expect(filterMachines(machines, 'sam staff').map((m) => m.id)).toEqual(['b']);
  });
});
