import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '../types';

/** Stands in for the ID Firestore generates for a new job document. */
const GENERATED_JOB_ID = 'abc123xyz789';

const firestore = vi.hoisted(() => {
  const transactionGet = vi.fn(async (_ref: unknown) => ({
    exists: () => true,
    data: () => ({}) as Record<string, unknown>,
  }));
  const transactionUpdate = vi.fn((_ref: unknown, _patch: unknown) => undefined);

  return {
    collection: vi.fn((_db: unknown, name: string) => ({ kind: 'collection', name })),
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

import { jobOrderNumber, orderNumberFromDocumentId } from '../lib/jobOrderNumber';
import {
  addJob,
  assignJob,
  completeJob,
  editJob,
  parseJob,
  restoreJob,
  startJob,
  unassignJob,
  updateJobProgress,
  type Actor,
  type Assigner,
  type JobInput,
} from '../services/jobService';

const actor: Actor = {
  uid: 'current-user',
  firstName: 'Avery',
  displayName: 'Avery Example',
  email: 'avery@example.com',
};

const input: JobInput = {
  name: 'Actuator repair',
  customer: 'Receiver',
  quantity: 1,
  dueDate: new Date('2030-01-02T23:59:59.000Z'),
  category: 'manufacturing',
};

function self(role: UserRole): Assigner {
  return { uid: actor.uid, name: 'Avery Example', role };
}

function createdPayload() {
  return firestore.setDoc.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

function updatePayload() {
  return firestore.updateDoc.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

function transactionPayload() {
  return firestore.transactionUpdate.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  firestore.transactionGet.mockResolvedValue({ exists: () => true, data: () => ({}) });
});

describe('order-number helper', () => {
  it('takes the first eight characters of the document ID, uppercased', () => {
    expect(orderNumberFromDocumentId('abc123xyz789')).toBe('G3D-ABC123XY');
  });

  it('trims the document ID and tolerates short IDs', () => {
    expect(orderNumberFromDocumentId('  abc123xyz789  ')).toBe('G3D-ABC123XY');
    expect(orderNumberFromDocumentId('ab12')).toBe('G3D-AB12');
  });

  it('prefers a stored order number over the derived one', () => {
    expect(jobOrderNumber('G3D-LEGACY1', 'abc123xyz789')).toBe('G3D-LEGACY1');
    expect(jobOrderNumber('  G3D-LEGACY1  ', 'abc123xyz789')).toBe('G3D-LEGACY1');
  });

  it('derives one whenever the stored value is missing or blank', () => {
    expect(jobOrderNumber(undefined, 'abc123xyz789')).toBe('G3D-ABC123XY');
    expect(jobOrderNumber('   ', 'abc123xyz789')).toBe('G3D-ABC123XY');
    expect(jobOrderNumber(42, 'abc123xyz789')).toBe('G3D-ABC123XY');
  });

  it('is empty only when the stored value and the document ID are both empty', () => {
    expect(jobOrderNumber('', '')).toBe('');
    expect(jobOrderNumber('', '   ')).toBe('');
  });
});

describe('order numbers on stored jobs', () => {
  it('derives one for a legacy job with no stored field', () => {
    expect(parseJob('abc123xyz789', {}).orderNumber).toBe('G3D-ABC123XY');
  });

  it('reads the stored value when the job already has one', () => {
    expect(parseJob('abc123xyz789', { orderNumber: 'G3D-OLDREF1' }).orderNumber).toBe('G3D-OLDREF1');
  });
});

describe('order numbers are written once, at creation', () => {
  it('derives the number from the generated document reference', async () => {
    await addJob(actor, self('manager'), input);

    const ref = firestore.setDoc.mock.calls.at(-1)?.[0] as { id: string };
    expect(ref.id).toBe(GENERATED_JOB_ID);
    expect(createdPayload()).toMatchObject({
      orderNumber: 'G3D-ABC123XY',
      repairProcesses: [],
      completedQuantity: 0,
      status: 'pending',
    });
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it('never rewrites the number while editing, assigning, or clearing a team', async () => {
    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'pending', category: 'manufacturing', quantity: 5 }),
    });
    await editJob(actor, self('manager'), 'job-1', { name: 'Renamed job', category: 'manufacturing' });
    expect(transactionPayload()).not.toHaveProperty('orderNumber');

    await editJob(actor, self('manager'), 'job-1', { name: 'Renamed again' });
    expect(updatePayload()).not.toHaveProperty('orderNumber');

    await assignJob(actor, self('manager'), 'job-1', [
      { uid: 'staff-1', name: 'Staff One', role: 'staff' },
    ]);
    expect(updatePayload()).not.toHaveProperty('orderNumber');

    await unassignJob(actor, 'job-1');
    expect(updatePayload()).not.toHaveProperty('orderNumber');
  });

  it('never rewrites the number while starting, progressing, completing, or restoring', async () => {
    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'pending', collaborators: [], collaboratorUids: [] }),
    });
    await startJob(actor, self('staff'), 'job-1');
    expect(transactionPayload()).not.toHaveProperty('orderNumber');

    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'started', quantity: 10, collaboratorUids: [actor.uid] }),
    });
    await updateJobProgress({
      jobId: 'job-1',
      completedQuantity: 4,
      currentUser: { ...actor, role: 'staff' },
    });
    expect(transactionPayload()).not.toHaveProperty('orderNumber');

    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'started',
        name: 'Actuator repair',
        quantity: 1,
        collaboratorUids: [actor.uid],
      }),
    });
    await completeJob(actor, self('staff'), 'job-1');
    expect(transactionPayload()).not.toHaveProperty('orderNumber');

    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'completed' }),
    });
    await restoreJob(actor, 'job-1');
    expect(transactionPayload()).not.toHaveProperty('orderNumber');
  });
});
