import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(() => ({ kind: 'collection' })),
  doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({ collectionName, id })),
  addDoc: vi.fn(async (_col: unknown, _data: Record<string, unknown>) => ({ id: 'new' })),
  deleteDoc: vi.fn(async (_ref: unknown) => undefined),
  updateDoc: vi.fn(async (_ref: unknown, _patch: Record<string, unknown>) => undefined),
  onSnapshot: vi.fn(() => vi.fn()),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
  deleteField: vi.fn(() => ({ kind: 'deleteField' })),
}));

vi.mock('firebase/firestore', () => ({
  ...firestore,
  Timestamp: { now: vi.fn(), fromDate: vi.fn() },
}));
vi.mock('../lib/firebase', () => ({ db: {} }));

import {
  canAssignHazard,
  canDeleteHazard,
  canEditHazard,
  canReopenHazard,
  canWorkHazard,
  compareHazards,
  isUrgentHazard,
  parseHazard,
  validateHazardInput,
  validateResolutionNote,
} from '../lib/hazards';
import {
  assignHazard,
  deleteHazard,
  reopenHazard,
  reportHazard,
  resolveHazard,
  startHazard,
  updateHazardDetails,
  type HazardActor,
} from '../services/hazardService';
import type { AppUser, Hazard, UserRole } from '../types';

function hazard(overrides: Partial<Hazard> = {}): Hazard {
  return {
    ...parseHazard('h1', { title: 'Oil on the floor', reportedByUid: 'staff-1', reportedByName: 'Alex' }),
    ...overrides,
  };
}

function actor(role: UserRole, uid = `${role}-1`): HazardActor {
  return { uid, role, firstName: role, displayName: `${role} name`, email: `${uid}@example.com` };
}

const kim: AppUser = {
  uid: 'staff-2',
  name: 'Kim',
  email: 'kim@example.com',
  role: 'staff',
  status: 'active',
  createdAt: null,
  updatedAt: null,
};

function lastUpdate(): Record<string, unknown> {
  return firestore.updateDoc.mock.calls.at(-1)![1];
}

beforeEach(() => vi.clearAllMocks());

describe('parseHazard', () => {
  it('falls back safely on unknown or missing values', () => {
    const parsed = parseHazard('h9', { severity: 'apocalyptic', status: 'archived' });
    expect(parsed).toMatchObject({
      id: 'h9',
      title: '',
      severity: 'medium',
      status: 'open',
      assignedToUid: '',
      createdAt: null,
    });
  });

  it('reads stored values', () => {
    const parsed = parseHazard('h1', {
      title: 'Exposed wiring',
      severity: 'critical',
      status: 'inProgress',
      assignedToUid: 'staff-2',
      assignedToName: 'Kim',
      createdAt: new Date('2026-10-01'),
    });
    expect(parsed).toMatchObject({ severity: 'critical', status: 'inProgress', assignedToName: 'Kim' });
    expect(parsed.createdAt).toEqual(new Date('2026-10-01'));
  });
});

describe('hazard ordering and urgency', () => {
  it('sorts unresolved first, most severe first, newest first', () => {
    const list = [
      hazard({ id: 'resolved', severity: 'critical', status: 'resolved' }),
      hazard({ id: 'low', severity: 'low', createdAt: new Date('2026-10-05') }),
      hazard({ id: 'critical', severity: 'critical', createdAt: new Date('2026-10-01') }),
      hazard({ id: 'high-old', severity: 'high', createdAt: new Date('2026-10-01') }),
      hazard({ id: 'high-new', severity: 'high', createdAt: new Date('2026-10-04') }),
    ];
    expect(list.sort(compareHazards).map((h) => h.id)).toEqual([
      'critical',
      'high-new',
      'high-old',
      'low',
      'resolved',
    ]);
  });

  it('treats only unresolved high and critical hazards as urgent', () => {
    expect(isUrgentHazard(hazard({ severity: 'high' }))).toBe(true);
    expect(isUrgentHazard(hazard({ severity: 'critical', status: 'inProgress' }))).toBe(true);
    expect(isUrgentHazard(hazard({ severity: 'critical', status: 'resolved' }))).toBe(false);
    expect(isUrgentHazard(hazard({ severity: 'medium' }))).toBe(false);
  });
});

describe('hazard permissions', () => {
  const assigned = hazard({ assignedToUid: 'awf-1', assignedToName: 'Sam' });
  const resolved = hazard({ status: 'resolved', assignedToUid: 'awf-1' });

  it('lets only management assign', () => {
    expect(canAssignHazard(assigned, actor('manager'))).toBe(true);
    expect(canAssignHazard(assigned, actor('admin'))).toBe(true);
    expect(canAssignHazard(assigned, actor('staff'))).toBe(false);
    expect(canAssignHazard(resolved, actor('manager'))).toBe(false);
  });

  it('lets the assignee and management work an unresolved hazard', () => {
    expect(canWorkHazard(assigned, actor('awf'))).toBe(true);
    expect(canWorkHazard(assigned, actor('manager'))).toBe(true);
    expect(canWorkHazard(assigned, actor('staff'))).toBe(false);
    expect(canWorkHazard(resolved, actor('awf'))).toBe(false);
  });

  it('lets the reporter edit until someone is assigned', () => {
    expect(canEditHazard(hazard(), actor('staff', 'staff-1'))).toBe(true);
    expect(canEditHazard(assigned, actor('staff', 'staff-1'))).toBe(false);
    expect(canEditHazard(hazard(), actor('staff', 'staff-2'))).toBe(false);
    expect(canEditHazard(assigned, actor('manager'))).toBe(true);
  });

  it('reserves reopening for management and deleting for admins', () => {
    expect(canReopenHazard(resolved, actor('manager'))).toBe(true);
    expect(canReopenHazard(resolved, actor('awf'))).toBe(false);
    expect(canDeleteHazard(actor('admin'))).toBe(true);
    expect(canDeleteHazard(actor('manager'))).toBe(false);
  });
});

describe('hazard validation', () => {
  const valid = { title: 'Loose rail', description: '', location: '', severity: 'medium' as const };

  it('requires a title within the rules limits', () => {
    expect(validateHazardInput(valid)).toBeNull();
    expect(validateHazardInput({ ...valid, title: '   ' })).toBe('Describe the hazard in a few words.');
    expect(validateHazardInput({ ...valid, title: 'x'.repeat(121) })).toMatch(/under 120/);
    expect(validateHazardInput({ ...valid, description: 'x'.repeat(2001) })).toMatch(/under 2000/);
  });

  it('requires a resolution note', () => {
    expect(validateResolutionNote('  ')).toBe('Say what was done to make it safe.');
    expect(validateResolutionNote('Mopped up')).toBeNull();
  });
});

describe('hazard service writes', () => {
  it('reports an open, unassigned hazard stamped with the reporter', async () => {
    await reportHazard(actor('awf', 'awf-1'), {
      title: '  Blocked fire exit ',
      description: '',
      location: ' Loading dock ',
      severity: 'critical',
    });
    expect(firestore.addDoc.mock.calls[0][1]).toEqual({
      title: 'Blocked fire exit',
      description: '',
      location: 'Loading dock',
      severity: 'critical',
      status: 'open',
      reportedByUid: 'awf-1',
      reportedByName: 'awf name',
      assignedToUid: '',
      assignedToName: '',
      createdAt: { kind: 'serverTimestamp' },
      updatedAt: { kind: 'serverTimestamp' },
      updatedByUid: 'awf-1',
      updatedByName: 'awf name',
    });
  });

  it('refuses an empty report before writing', async () => {
    await expect(
      reportHazard(actor('staff'), { title: ' ', description: '', location: '', severity: 'low' }),
    ).rejects.toThrow('Describe the hazard in a few words.');
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it('assigns with an audit trail, and clears it again', async () => {
    await assignHazard(actor('manager'), hazard(), kim);
    expect(lastUpdate()).toMatchObject({
      assignedToUid: 'staff-2',
      assignedToName: 'Kim',
      assignedByUid: 'manager-1',
      assignedAt: { kind: 'serverTimestamp' },
    });

    await assignHazard(actor('manager'), hazard({ assignedToUid: 'staff-2' }), null);
    expect(lastUpdate()).toMatchObject({
      assignedToUid: '',
      assignedToName: '',
      assignedByUid: { kind: 'deleteField' },
      assignedAt: { kind: 'deleteField' },
    });
  });

  it('refuses assignment by staff and to inactive accounts', async () => {
    await expect(assignHazard(actor('staff'), hazard(), kim)).rejects.toThrow(
      'Only managers and admins assign hazards.',
    );
    await expect(
      assignHazard(actor('manager'), hazard(), { ...kim, status: 'disabled' }),
    ).rejects.toThrow('Hazards can only go to active accounts.');
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('lets the assignee start and resolve with a note', async () => {
    const mine = hazard({ assignedToUid: 'staff-2' });
    const kimActor = actor('staff', 'staff-2');
    await startHazard(kimActor, mine);
    expect(lastUpdate()).toMatchObject({ status: 'inProgress', updatedByUid: 'staff-2' });

    await resolveHazard(kimActor, { ...mine, status: 'inProgress' }, '  Fitted a drip tray ');
    expect(lastUpdate()).toMatchObject({
      status: 'resolved',
      resolutionNote: 'Fitted a drip tray',
      resolvedByUid: 'staff-2',
      resolvedAt: { kind: 'serverTimestamp' },
    });
  });

  it('refuses a resolution without a note, or from someone not on it', async () => {
    const mine = hazard({ assignedToUid: 'staff-2' });
    await expect(resolveHazard(actor('staff', 'staff-2'), mine, ' ')).rejects.toThrow(
      'Say what was done to make it safe.',
    );
    await expect(resolveHazard(actor('staff', 'staff-9'), mine, 'Done')).rejects.toThrow(
      'Only the assignee or a manager can resolve this.',
    );
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('reopens by clearing the resolution', async () => {
    await reopenHazard(actor('admin'), hazard({ status: 'resolved' }));
    expect(lastUpdate()).toMatchObject({
      status: 'open',
      resolutionNote: { kind: 'deleteField' },
      resolvedAt: { kind: 'deleteField' },
      resolvedByUid: { kind: 'deleteField' },
      resolvedByName: { kind: 'deleteField' },
    });
  });

  it('lets the reporter correct details, and only admins delete', async () => {
    await updateHazardDetails(actor('staff', 'staff-1'), hazard(), {
      title: 'Oil leak',
      description: '',
      location: '',
      severity: 'high',
    });
    expect(lastUpdate()).toMatchObject({ title: 'Oil leak', severity: 'high' });

    await expect(deleteHazard(actor('manager'), hazard())).rejects.toThrow('Only admins delete hazards.');
    await deleteHazard(actor('admin'), hazard());
    expect(firestore.deleteDoc).toHaveBeenCalledWith({ collectionName: 'hazards', id: 'h1' });
  });
});
