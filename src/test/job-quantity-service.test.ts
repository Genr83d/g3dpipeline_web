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
    doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({
      kind: 'doc',
      collectionName,
      id,
    })),
    addDoc: vi.fn(async (_collection: unknown, _data: unknown) => ({ id: 'new-job' })),
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
  addJob,
  completeJob,
  editJob,
  restoreJob,
  startJob,
  type Actor,
  type Assigner,
  type JobInput,
  updateJobProgress,
} from '../services/jobService';

const actor: Actor = {
  uid: 'current-user',
  firstName: 'Avery',
  displayName: 'Avery Example',
  email: 'avery@example.com',
};

function self(role: UserRole = 'admin'): Assigner {
  return { uid: actor.uid, name: 'Avery Example', role };
}

function input(overrides: Partial<JobInput> = {}): JobInput {
  return {
    name: 'Pin order',
    customer: 'Receiver',
    quantity: 12,
    dueDate: new Date('2030-01-02T23:59:59.000Z'),
    category: 'manufacturing',
    ...overrides,
  };
}

function jobDoc(data: Record<string, unknown>) {
  firestore.transactionGet.mockResolvedValue({
    exists: () => true,
    data: () => data,
  });
}

function lastAddPayload() {
  return firestore.addDoc.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

function lastTransactionPatch() {
  return firestore.transactionUpdate.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  firestore.getDocs.mockResolvedValue({ docs: [] });
});

describe('service-layer quantity enforcement', () => {
  it('rejects invalid category/quantity combinations on create', async () => {
    await expect(addJob(actor, self(), input({ quantity: 0 }))).rejects.toThrow(
      'Quantity must be at least 1.',
    );
    await expect(addJob(actor, self(), input({ quantity: 2.5 }))).rejects.toThrow(
      'Quantity must be a whole number.',
    );
    await expect(addJob(actor, self(), input({ quantity: 1000 }))).rejects.toThrow(
      'Quantity cannot exceed 999.',
    );
    await expect(
      addJob(actor, self(), input({ category: 'design', quantity: 100 })),
    ).rejects.toThrow('Number of deliverables cannot exceed 99.');
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it('accepts 100-unit physical batches and persists them unchanged', async () => {
    await addJob(actor, self(), input({ quantity: 100 }));
    expect(lastAddPayload()).toMatchObject({ quantity: 100, completedQuantity: 0, category: 'manufacturing' });
  });

  it('always persists quantity 1 for Software development jobs', async () => {
    await addJob(actor, self(), input({ category: 'softwareDevelopment', quantity: 40 }));
    expect(lastAddPayload()).toMatchObject({ category: 'softwareDevelopment', quantity: 1 });
  });

  it('validates edits against the effective category/quantity pair', async () => {
    jobDoc({ status: 'pending', category: 'manufacturing', quantity: 5 });
    await expect(
      editJob(actor, self(), 'job-1', { quantity: 1000 }),
    ).rejects.toThrow('Quantity cannot exceed 999.');
    // Changing category to design must also respect the design maximum for the
    // stored quantity.
    jobDoc({ status: 'pending', category: 'manufacturing', quantity: 150 });
    await expect(
      editJob(actor, self(), 'job-1', { category: 'design' }),
    ).rejects.toThrow('Number of deliverables cannot exceed 99.');
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();

    jobDoc({ status: 'pending', category: 'manufacturing', quantity: 5 });
    await editJob(actor, self(), 'job-1', { category: 'softwareDevelopment' });
    expect(lastTransactionPatch()).toMatchObject({
      category: 'softwareDevelopment',
      quantity: 1,
    });
  });

  it('lets legacy over-limit records take non-quantity updates unchanged', async () => {
    // A legacy record with quantity 5000 gets a name-only edit: no quantity
    // validation runs and the stored quantity is untouched.
    await editJob(actor, self(), 'legacy-job', { name: 'Renamed job' });
    expect(firestore.runTransaction).not.toHaveBeenCalled();
    const patch = firestore.updateDoc.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(patch.name).toBe('Renamed job');
    expect(patch).not.toHaveProperty('quantity');
  });
});

describe('service-layer status transition enforcement', () => {
  it('rejects starting a job that is not pending', async () => {
    jobDoc({ status: 'completed' });
    await expect(startJob(actor, self(), 'job-1')).rejects.toThrow(
      'Someone else already started this job.',
    );
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('rejects completing a job that is not started (pending → completed skips)', async () => {
    jobDoc({ status: 'pending' });
    await expect(completeJob(actor, self(), 'job-1')).rejects.toThrow(
      'Only started jobs can be completed.',
    );
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('rejects restoring a job that is not completed', async () => {
    jobDoc({ status: 'started' });
    await expect(restoreJob(actor, 'job-1')).rejects.toThrow(
      'Only completed jobs can be restored.',
    );
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('restores a completed job back to pending', async () => {
    jobDoc({ status: 'completed' });
    await restoreJob(actor, 'job-1');
    expect(lastTransactionPatch()).toMatchObject({ status: 'pending', completedQuantity: 0 });
  });

  it('legacy over-limit jobs can still be started (status-only update)', async () => {
    jobDoc({
      status: 'pending',
      quantity: 5000,
      collaborators: [{ uid: actor.uid, name: 'Avery', role: 'admin' }],
      collaboratorUids: [actor.uid],
    });
    await startJob(actor, self(), 'legacy-job');
    const patch = lastTransactionPatch();
    expect(patch).toMatchObject({ status: 'started' });
    expect(patch).not.toHaveProperty('quantity');
  });
});

describe('transactional progress updates', () => {
  it('updates only progress and audit fields for an authorized collaborator', async () => {
    jobDoc({ status: 'started', quantity: 15, collaboratorUids: [actor.uid] });
    await updateJobProgress({ jobId: 'job-1', completedQuantity: 12, currentUser: { ...actor, role: 'staff' } });
    expect(lastTransactionPatch()).toEqual({
      completedQuantity: 12,
      updatedAt: { kind: 'serverTimestamp' },
      updatedByUid: actor.uid,
      updatedByName: actor.displayName,
    });
  });

  it('rejects unauthorized, completed, and out-of-range updates', async () => {
    jobDoc({ status: 'started', quantity: 15, collaboratorUids: ['other'] });
    await expect(updateJobProgress({ jobId: 'job-1', completedQuantity: 2, currentUser: { ...actor, role: 'staff' } })).rejects.toThrow('Only a collaborator');
    jobDoc({ status: 'completed', quantity: 15, collaboratorUids: [actor.uid] });
    await expect(updateJobProgress({ jobId: 'job-1', completedQuantity: 2, currentUser: { ...actor, role: 'staff' } })).rejects.toThrow('Completed jobs');
    jobDoc({ status: 'pending', quantity: 15, collaboratorUids: [actor.uid] });
    await expect(updateJobProgress({ jobId: 'job-1', completedQuantity: 16, currentUser: { ...actor, role: 'staff' } })).rejects.toThrow('Enter a whole number');
  });

  it('prevents lowering total quantity below completed progress', async () => {
    jobDoc({ status: 'started', category: 'manufacturing', quantity: 15, completedQuantity: 12 });
    await expect(editJob(actor, self(), 'job-1', { quantity: 11 })).rejects.toThrow(
      'The total quantity cannot be less than the completed quantity.',
    );
  });

  it('sets completion to the latest total quantity', async () => {
    jobDoc({ status: 'started', name: 'Regular order', quantity: 15, collaboratorUids: [actor.uid] });
    await completeJob(actor, self('staff'), 'job-1');
    expect(lastTransactionPatch()).toMatchObject({ status: 'completed', completedQuantity: 15 });
  });
});
