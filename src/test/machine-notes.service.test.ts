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
  Timestamp: { now: firestore.timestampNow },
}));

vi.mock('../lib/firebase', () => ({ db: {} }));

import { logCheckedMaintenance, parseMachine } from '../services/machineService';

const actor = {
  uid: 'tech-1',
  firstName: 'Terry',
  displayName: 'Technician Name',
  email: 'tech@example.com',
};

function updatePatch(): Record<string, unknown> {
  return firestore.transactionUpdate.mock.calls[0][1] as Record<string, unknown>;
}

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

    const titles = await logCheckedMaintenance(actor, 'machine-1', '  Cleaned and aligned.  ');
    expect(titles).toEqual(['Clean lens', 'Check alignment']);

    const patch = updatePatch();
    const history = patch.maintenanceHistory as Array<Record<string, unknown>>;
    expect(history[0]).toMatchObject({
      procedureTitles: ['Clean lens', 'Check alignment'],
      completedByName: 'Technician Name',
      notes: 'Cleaned and aligned.',
    });
    // Legacy record stays valid with empty-string notes.
    expect(history[1]).toMatchObject({ procedureTitles: ['Check belts'], notes: '' });
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

    await logCheckedMaintenance(actor, 'machine-1');
    const history = updatePatch().maintenanceHistory as Array<Record<string, unknown>>;
    expect(history[0].notes).toBe('');
  });
});
