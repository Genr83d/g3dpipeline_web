import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => {
  const transactionGet = vi.fn(async (_ref: unknown) => ({
    exists: () => true,
    id: 'machine-1',
    data: () => ({}) as Record<string, unknown>,
  }));
  const transactionUpdate = vi.fn((_ref: unknown, _patch: unknown) => undefined);
  return {
    collection: vi.fn(() => ({ kind: 'collection' })),
    doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({ collectionName, id })),
    addDoc: vi.fn(async () => ({ id: 'new' })),
    deleteDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
    onSnapshot: vi.fn(() => vi.fn()),
    query: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
    timestampNow: vi.fn(() => ({ kind: 'timestamp-now' })),
    arrayUnion: vi.fn((...items: unknown[]) => ({ kind: 'arrayUnion', items })),
    transactionGet,
    transactionUpdate,
    runTransaction: vi.fn(
      async (
        _db: unknown,
        callback: (transaction: {
          get: typeof transactionGet;
          update: typeof transactionUpdate;
        }) => Promise<unknown>,
      ) => callback({ get: transactionGet, update: transactionUpdate }),
    ),
  };
});

vi.mock('firebase/firestore', () => ({
  collection: firestore.collection,
  doc: firestore.doc,
  addDoc: firestore.addDoc,
  deleteDoc: firestore.deleteDoc,
  updateDoc: firestore.updateDoc,
  onSnapshot: firestore.onSnapshot,
  query: firestore.query,
  orderBy: firestore.orderBy,
  serverTimestamp: firestore.serverTimestamp,
  runTransaction: firestore.runTransaction,
  arrayUnion: firestore.arrayUnion,
  Timestamp: { now: firestore.timestampNow },
}));

vi.mock('../lib/firebase', () => ({ db: {} }));

import { logCheckedMaintenance, parseMachine } from '../services/machineService';
import { maintenanceAttribution } from '../lib/maintenanceLog';

const actor = {
  uid: 'tech-1',
  firstName: 'Terry',
  displayName: 'Technician Name',
  email: 'tech@example.com',
};

function updatePatch(): Record<string, unknown> {
  return firestore.transactionUpdate.mock.calls[0][1] as Record<string, unknown>;
}

/** The records a log appends with arrayUnion. */
function appended(): Array<Record<string, unknown>> {
  const history = updatePatch().maintenanceHistory as { kind: string; items: unknown[] };
  expect(history.kind).toBe('arrayUnion');
  return history.items as Array<Record<string, unknown>>;
}

const sam = { uid: 'staff-2', name: 'Sam Staff' };

beforeEach(() => {
  firestore.transactionGet.mockClear();
  firestore.transactionUpdate.mockClear();
});

describe('maintenance history notes data model', () => {
  it('treats legacy history records without a notes property as empty notes', () => {
    const machine = parseMachine('machine-1', {
      name: 'Laser cutter',
      maintenanceHistory: [
        {
          completedAt: new Date('2025-01-05T09:00:00'),
          procedureTitles: ['Check belts'],
          completedByName: 'Old Tech',
        },
      ],
    });
    expect(machine.maintenanceHistory).toHaveLength(1);
    expect(machine.maintenanceHistory[0].notes).toBe('');
  });

  it('saves trimmed notes on the new record and preserves procedures, user, and reset behavior', async () => {
    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      id: 'machine-1',
      data: () => ({
        name: 'Laser cutter',
        notes: 'General machine notes',
        procedures: [
          { id: 'p1', title: 'Clean lens', isDone: true },
          { id: 'p2', title: 'Check alignment', isDone: true },
          { id: 'p3', title: 'Grease rails', isDone: false },
        ],
        maintenanceHistory: [
          {
            completedAt: new Date('2025-01-05T09:00:00'),
            procedureTitles: ['Check belts'],
            completedByName: 'Old Tech',
          },
        ],
      }),
    });

    const titles = await logCheckedMaintenance(actor, 'machine-1', sam, '  Cleaned and aligned.  ');
    expect(titles).toEqual(['Clean lens', 'Check alignment']);

    const patch = updatePatch();
    // Only the new record is sent; the stored history is left as it is.
    expect(appended()).toEqual([
      {
        completedAt: { kind: 'timestamp-now' },
        procedureTitles: ['Clean lens', 'Check alignment'],
        completedByName: 'Sam Staff',
        completedByUid: 'staff-2',
        loggedByUid: 'tech-1',
        loggedByName: 'Technician Name',
        notes: 'Cleaned and aligned.',
      },
    ]);
    // Checked procedures reset after logging.
    expect(patch.procedures).toEqual([
      { id: 'p1', title: 'Clean lens', isDone: false },
      { id: 'p2', title: 'Check alignment', isDone: false },
      { id: 'p3', title: 'Grease rails', isDone: false },
    ]);
    // The machine's general-purpose notes field is not touched.
    expect(patch).not.toHaveProperty('notes');
  });

  it('defaults to empty notes when none are provided', async () => {
    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      id: 'machine-1',
      data: () => ({
        name: 'Laser cutter',
        procedures: [{ id: 'p1', title: 'Clean lens', isDone: true }],
        maintenanceHistory: [],
      }),
    });

    await logCheckedMaintenance(actor, 'machine-1', sam);
    expect(appended()[0].notes).toBe('');
  });
});

describe('who did the maintenance', () => {
  it('credits someone outside the team by name, with no uid', async () => {
    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      id: 'machine-1',
      data: () => ({
        name: 'Laser cutter',
        procedures: [{ id: 'p1', title: 'Clean lens', isDone: true }],
        maintenanceHistory: [],
      }),
    });

    await logCheckedMaintenance(actor, 'machine-1', { uid: '', name: '  Dale (Epson)  ' });
    expect(appended()[0]).toMatchObject({
      completedByName: 'Dale (Epson)',
      completedByUid: '',
      loggedByUid: 'tech-1',
    });
  });

  it('refuses a log that does not say who did the work', async () => {
    await expect(
      logCheckedMaintenance(actor, 'machine-1', { uid: '', name: '   ' }),
    ).rejects.toThrow('Say who did the maintenance.');
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('reads who did it and who logged it, and treats older records as logger-only', () => {
    const machine = parseMachine('machine-1', {
      name: 'Laser cutter',
      maintenanceHistory: [
        {
          completedAt: new Date('2026-10-20T09:00:00'),
          procedureTitles: ['Clean lens'],
          completedByName: 'Sam Staff',
          completedByUid: 'staff-2',
          loggedByUid: 'manager-1',
          loggedByName: 'Mia Manager',
        },
        {
          completedAt: new Date('2025-01-05T09:00:00'),
          procedureTitles: ['Check belts'],
          completedByName: 'Old Tech',
        },
      ],
    });
    const [latest, older] = machine.maintenanceHistory;
    expect(latest).toMatchObject({
      completedByUid: 'staff-2',
      loggedByUid: 'manager-1',
      loggedByName: 'Mia Manager',
    });
    expect(maintenanceAttribution(latest)).toBe('Completed by Sam Staff · logged by Mia Manager');
    expect(older).toMatchObject({ completedByUid: '', loggedByUid: '', loggedByName: '' });
    expect(maintenanceAttribution(older)).toBe('Logged by Old Tech');
  });
});

describe('maintenanceAttribution', () => {
  const record = (overrides: Partial<Parameters<typeof maintenanceAttribution>[0]>) => ({
    completedByName: 'Sam Staff',
    completedByUid: 'staff-2',
    loggedByUid: 'staff-2',
    loggedByName: 'Sam Staff',
    ...overrides,
  });

  it('names one person when they logged their own work', () => {
    expect(maintenanceAttribution(record({}))).toBe('Completed by Sam Staff');
  });

  it('names an outside technician and who logged them', () => {
    expect(maintenanceAttribution(record({ completedByName: 'Dale (Epson)', completedByUid: '' }))).toBe(
      'Completed by Dale (Epson) · logged by Sam Staff',
    );
  });

  it('says nothing for an older record with no name', () => {
    expect(
      maintenanceAttribution(record({ completedByName: '', loggedByUid: '', loggedByName: '' })),
    ).toBe('');
  });
});
