import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '../types';

const firestore = vi.hoisted(() => {
  const transactionGet = vi.fn(async (_ref: unknown) => ({
    exists: () => true,
    data: () => ({}) as Record<string, unknown>,
  }));
  const transactionUpdate = vi.fn((_ref: unknown, _patch: unknown) => undefined);

  return {
    collection: vi.fn((_db: unknown, name: string) => ({ kind: 'collection', name })),
    // doc(db, collection, id) addresses an existing document; doc(collection)
    // generates a reference — and its ID — before the first write.
    doc: vi.fn((target: unknown, collectionName?: string, id?: string) =>
      typeof collectionName === 'string' && typeof id === 'string'
        ? { kind: 'doc', collectionName, id }
        : {
            kind: 'doc',
            collectionName: (target as { name?: string } | null)?.name ?? '',
            id: 'abc123xyz789',
          },
    ),
    addDoc: vi.fn(async (_collection: unknown, _data: unknown) => ({ id: 'new-job' })),
    setDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined),
    deleteDoc: vi.fn(async (_ref: unknown) => undefined),
    updateDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined),
    getDocs: vi.fn(async (_query: unknown) => ({ docs: [] })),
    onSnapshot: vi.fn(
      (_query: unknown, _next: unknown, _error: unknown) => vi.fn(() => undefined),
    ),
    query: vi.fn((source: unknown, ...constraints: unknown[]) => ({
      kind: 'query',
      source,
      constraints,
    })),
    orderBy: vi.fn(() => ({ kind: 'orderBy' })),
    where: vi.fn(() => ({ kind: 'where' })),
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
  setDoc: firestore.setDoc,
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

import {
  autoCompleteJob,
  completeJob,
  parseJob,
  restoreJob,
  NOT_DUE_FOR_AUTO_COMPLETION_MESSAGE,
  type Actor,
  type Assigner,
} from '../services/jobService';

const actor: Actor = {
  uid: 'manager-1',
  firstName: 'Renee',
  displayName: 'Renee Bailey',
  email: 'renee@example.com',
};

function self(role: UserRole = 'manager'): Assigner {
  return { uid: actor.uid, name: 'Renee Bailey', role };
}

const NOW = new Date(2026, 9, 21, 8, 30);
const YESTERDAY_AFTERNOON = new Date(2026, 9, 20, 15);

function jobDoc(data: Record<string, unknown> = {}) {
  firestore.transactionGet.mockResolvedValue({
    exists: () => true,
    data: () => ({
      status: 'started',
      name: 'Keychains',
      category: 'manufacturing',
      quantity: 12,
      completedQuantity: 12,
      repairProcesses: [{ name: 'Printing', progress: 100, collaboratorUid: 'staff-1' }],
      collaboratorUids: ['staff-1'],
      updatedAt: { toDate: () => YESTERDAY_AFTERNOON },
      updatedByUid: 'staff-1',
      updatedByName: 'Alex Griffith',
      ...data,
    }),
  });
}

function lastTransactionPatch() {
  return firestore.transactionUpdate.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  firestore.getDocs.mockResolvedValue({ docs: [] });
});

describe('autoCompleteJob', () => {
  it('dates the completion to the end of the day the work was finished', async () => {
    jobDoc();
    await autoCompleteJob(actor, self(), 'job-1', NOW);
    expect(firestore.timestampFromDate).toHaveBeenCalledWith(new Date(2026, 9, 20, 23, 59, 59, 999));
    expect(lastTransactionPatch()).toMatchObject({
      status: 'completed',
      completedQuantity: 12,
      completedAt: { kind: 'timestamp', date: new Date(2026, 9, 20, 23, 59, 59, 999) },
      autoCompleted: true,
      updatedAt: { kind: 'serverTimestamp' },
      updatedByUid: 'manager-1',
    });
  });

  it('credits whoever made the last update', async () => {
    jobDoc();
    await autoCompleteJob(actor, self(), 'job-1', NOW);
    expect(lastTransactionPatch()).toMatchObject({
      completedByUid: 'staff-1',
      completedByName: 'Alex Griffith',
    });
  });

  it('falls back to the caller on a job with no recorded updater', async () => {
    jobDoc({ updatedByUid: undefined, updatedByName: undefined });
    await autoCompleteJob(actor, self(), 'job-1', NOW);
    expect(lastTransactionPatch()).toMatchObject({
      completedByUid: 'manager-1',
      completedByName: 'Renee Bailey',
    });
  });

  it('refuses a job that was touched today', async () => {
    jobDoc({ updatedAt: { toDate: () => new Date(2026, 9, 21, 7) } });
    await expect(autoCompleteJob(actor, self(), 'job-1', NOW)).rejects.toThrow(
      NOT_DUE_FOR_AUTO_COMPLETION_MESSAGE,
    );
    expect(lastTransactionPatch()).toBeUndefined();
  });

  it('refuses a job with no recorded update time', async () => {
    jobDoc({ updatedAt: undefined });
    await expect(autoCompleteJob(actor, self(), 'job-1', NOW)).rejects.toThrow(
      NOT_DUE_FOR_AUTO_COMPLETION_MESSAGE,
    );
  });

  it('keeps the completion gate', async () => {
    jobDoc({ completedQuantity: 11 });
    await expect(autoCompleteJob(actor, self(), 'job-1', NOW)).rejects.toThrow(
      'This job is not finished yet: 1 of 12 units still to finish.',
    );
  });

  it('refuses a job another client has already completed', async () => {
    jobDoc({ status: 'completed' });
    await expect(autoCompleteJob(actor, self(), 'job-1', NOW)).rejects.toThrow(
      'Only started jobs can be completed.',
    );
  });

  it('keeps who may complete', async () => {
    jobDoc();
    await expect(autoCompleteJob(actor, self('staff'), 'job-1', NOW)).rejects.toThrow(
      'Only a collaborator, manager, or admin can complete this job.',
    );
  });

  it('leaves a tapped completion stamped now, by the caller, unflagged', async () => {
    jobDoc({ collaboratorUids: ['manager-1'] });
    await completeJob(actor, self(), 'job-1');
    const patch = lastTransactionPatch();
    expect(patch).toMatchObject({
      completedAt: { kind: 'serverTimestamp' },
      completedByUid: 'manager-1',
    });
    expect(patch).not.toHaveProperty('autoCompleted');
  });

  it('restoring clears the flag', async () => {
    jobDoc({ status: 'completed', autoCompleted: true });
    await restoreJob(actor, 'job-1');
    expect(lastTransactionPatch()).toMatchObject({ autoCompleted: { kind: 'deleteField' } });
  });

  it('reads the flag back', () => {
    expect(parseJob('job-1', { autoCompleted: true }).autoCompleted).toBe(true);
    expect(parseJob('job-1', {}).autoCompleted).toBe(false);
  });
});
