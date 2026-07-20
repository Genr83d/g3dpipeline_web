import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '../types';

const firestore = vi.hoisted(() => {
  const transactionGet = vi.fn(async (_ref: unknown) => ({
    exists: () => true,
    data: () => ({}),
  }));
  const transactionUpdate = vi.fn((_ref: unknown, _patch: unknown) => undefined);

  return {
    collection: vi.fn((_db: unknown, name: string) => ({ kind: 'collection', name })),
    doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({
      kind: 'doc',
      collectionName,
      id,
    })),
    addDoc: vi.fn(async (_collection: unknown, _data: unknown) => ({ id: 'new-job' })),
    deleteDoc: vi.fn(async (_ref: unknown) => undefined),
    updateDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined),
    getDocs: vi.fn(async (_query: unknown) => ({ docs: [] })),
    onSnapshot: vi.fn((_query: unknown, _next: unknown, _error: unknown) => vi.fn(() => undefined)),
    query: vi.fn((source: unknown, ...constraints: unknown[]) => ({ kind: 'query', source, constraints })),
    orderBy: vi.fn((field: string, direction?: string) => ({ kind: 'orderBy', field, direction })),
    where: vi.fn((field: string, operator: string, value: unknown) => ({ kind: 'where', field, operator, value })),
    serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
    deleteField: vi.fn(() => ({ kind: 'deleteField' })),
    timestampFromDate: vi.fn((date: Date) => ({ kind: 'timestamp', date })),
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
  getDocs: firestore.getDocs,
  onSnapshot: firestore.onSnapshot,
  query: firestore.query,
  orderBy: firestore.orderBy,
  where: firestore.where,
  runTransaction: firestore.runTransaction,
  serverTimestamp: firestore.serverTimestamp,
  deleteField: firestore.deleteField,
  Timestamp: { fromDate: firestore.timestampFromDate },
}));

vi.mock('../lib/firebase', () => ({ db: { kind: 'db' } }));
vi.mock('../services/inventoryService', () => ({
  inventoryCol: { kind: 'collection', name: 'inventory' },
}));

import { editJob, parseJob, type Actor, type Assigner } from '../services/jobService';

const actor: Actor = {
  uid: 'current-user',
  firstName: 'Avery',
  displayName: 'Avery Example',
  email: 'avery@example.com',
};

function self(role: UserRole): Assigner {
  return { uid: actor.uid, name: 'Avery Example', role };
}

/** A stored job snapshot as the transaction reads it (dueDate is a Timestamp). */
function storedJob(dueDate: Date, extra: Record<string, unknown> = {}) {
  return {
    exists: () => true as const,
    data: () => ({
      status: 'pending',
      category: 'manufacturing',
      quantity: 12,
      dueDate: { toDate: () => dueDate },
      ...extra,
    }),
  };
}

function transactionPayload() {
  return firestore.transactionUpdate.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

const AUDIT_FIELDS = [
  'previousDueDate',
  'dueDateChangeNote',
  'dueDateChangedAt',
  'dueDateChangedByUid',
  'dueDateChangedByName',
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  firestore.transactionGet.mockResolvedValue({ exists: () => true, data: () => ({}) });
});

describe('parseJob due-date audit defaults', () => {
  it('reads safe defaults for legacy jobs without any audit fields', () => {
    const job = parseJob('legacy-job', {});
    expect(job.dueDateChangeNote).toBe('');
    expect(job.previousDueDate).toBeNull();
    expect(job.dueDateChangedAt).toBeNull();
    expect(job.dueDateChangedByUid).toBe('');
    expect(job.dueDateChangedByName).toBe('');
  });

  it('parses stored audit fields when present', () => {
    const changedAt = new Date('2030-02-01T10:00:00.000Z');
    const previous = new Date('2030-01-01T23:59:59.000Z');
    const job = parseJob('job-1', {
      dueDateChangeNote: 'Client pushed delivery',
      previousDueDate: { toDate: () => previous },
      dueDateChangedAt: { toDate: () => changedAt },
      dueDateChangedByUid: 'manager-1',
      dueDateChangedByName: 'Morgan',
    });
    expect(job.dueDateChangeNote).toBe('Client pushed delivery');
    expect(job.previousDueDate).toEqual(previous);
    expect(job.dueDateChangedAt).toEqual(changedAt);
    expect(job.dueDateChangedByUid).toBe('manager-1');
    expect(job.dueDateChangedByName).toBe('Morgan');
  });
});

describe('editJob due-date change enforcement', () => {
  it('re-reads the job in a transaction and persists the reason plus audit trail', async () => {
    const stored = new Date('2030-01-01T23:59:59');
    firestore.transactionGet.mockResolvedValueOnce(storedJob(stored));
    const newDueDate = new Date('2030-02-01T23:59:59');

    await editJob(actor, self('manager'), 'job-1', {
      dueDate: newDueDate,
      dueDateChangeNote: '  Client pushed delivery  ',
    });

    expect(firestore.transactionGet).toHaveBeenCalledOnce();
    expect(firestore.updateDoc).not.toHaveBeenCalled();

    const payload = transactionPayload();
    expect(payload).toMatchObject({
      dueDate: { kind: 'timestamp', date: newDueDate },
      dueDateChangeNote: 'Client pushed delivery',
      dueDateChangedAt: { kind: 'serverTimestamp' },
      dueDateChangedByUid: 'current-user',
      dueDateChangedByName: 'Avery Example',
      updatedByUid: 'current-user',
    });
    // previousDueDate is the exact stored deadline read inside the transaction.
    expect((payload.previousDueDate as { toDate: () => Date }).toDate()).toEqual(stored);
  });

  it('rejects a due-date change with no explanation', async () => {
    firestore.transactionGet.mockResolvedValueOnce(storedJob(new Date('2030-01-01T23:59:59')));

    await expect(
      editJob(actor, self('manager'), 'job-1', { dueDate: new Date('2030-03-01T23:59:59') }),
    ).rejects.toThrow('Add a reason for changing the deadline.');
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only explanation even if client validation was bypassed', async () => {
    firestore.transactionGet.mockResolvedValueOnce(storedJob(new Date('2030-01-01T23:59:59')));

    await expect(
      editJob(actor, self('manager'), 'job-1', {
        dueDate: new Date('2030-03-01T23:59:59'),
        dueDateChangeNote: '   \n  ',
      }),
    ).rejects.toThrow('Add a reason for changing the deadline.');
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('treats a same-day edit as unchanged: no audit fields, deadline untouched', async () => {
    // Stored at 09:00, re-submitted as end-of-day the same calendar day.
    firestore.transactionGet.mockResolvedValueOnce(storedJob(new Date('2030-01-01T09:00:00')));

    await editJob(actor, self('manager'), 'job-1', {
      dueDate: new Date('2030-01-01T23:59:59'),
      name: 'Renamed order',
    });

    const payload = transactionPayload();
    expect(payload).toMatchObject({ name: 'Renamed order' });
    expect(payload).not.toHaveProperty('dueDate');
    for (const field of AUDIT_FIELDS) expect(payload).not.toHaveProperty(field);
  });

  it('does not require a note or write audit fields when the deadline is not part of the edit', async () => {
    await editJob(actor, self('manager'), 'job-1', { name: 'Renamed order' });

    expect(firestore.runTransaction).not.toHaveBeenCalled();
    const payload = firestore.updateDoc.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({ name: 'Renamed order', updatedByUid: 'current-user' });
    for (const field of AUDIT_FIELDS) expect(payload).not.toHaveProperty(field);
  });

  it('still enforces the existing manager/admin permission', async () => {
    await expect(
      editJob(actor, self('staff'), 'job-1', {
        dueDate: new Date('2030-03-01T23:59:59'),
        dueDateChangeNote: 'Anything',
      }),
    ).rejects.toThrow('Only managers and admins can edit jobs.');
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });
});
