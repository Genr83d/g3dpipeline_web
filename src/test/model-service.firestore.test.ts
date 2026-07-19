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
    onSnapshot: vi.fn(
      (_query: unknown, _next: unknown, _error: unknown) => vi.fn(() => undefined),
    ),
    query: vi.fn((source: unknown, ...constraints: unknown[]) => ({
      kind: 'query',
      source,
      constraints,
    })),
    orderBy: vi.fn((field: string, direction?: string) => ({
      kind: 'orderBy',
      field,
      direction,
    })),
    where: vi.fn((field: string, operator: string, value: unknown) => ({
      kind: 'where',
      field,
      operator,
      value,
    })),
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
  assignJob,
  completeJob,
  dedupeCollaborators,
  editJob,
  jobsQueryForRole,
  parseJob,
  restoreJob,
  startJob,
  unassignJob,
  type Actor,
  type Assigner,
  type AssignTarget,
  type JobInput,
} from '../services/jobService';
import { parseUser, watchAssignableUsers } from '../services/userService';

const actor: Actor = {
  uid: 'current-user',
  firstName: 'Avery',
  displayName: 'Avery Example',
  email: 'avery@example.com',
};

const input: JobInput = {
  name: 'AWF order',
  customer: 'Receiver',
  quantity: 12,
  dueDate: new Date('2030-01-02T23:59:59.000Z'),
  category: 'manufacturing',
};

function self(role: UserRole): Assigner {
  return { uid: actor.uid, name: 'Avery Example', role };
}

function lastWritePayload(mock: typeof firestore.addDoc | typeof firestore.updateDoc) {
  return mock.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  firestore.transactionGet.mockResolvedValue({
    exists: () => true,
    data: () => ({}),
  });
});

describe('role-aware Firestore jobs query', () => {
  it('uses isAwf == true followed by dueDate ascending for AWF Staff', () => {
    expect(jobsQueryForRole('awf')).toEqual({
      kind: 'query',
      source: { kind: 'collection', name: 'jobs' },
      constraints: [
        { kind: 'where', field: 'isAwf', operator: '==', value: true },
        { kind: 'orderBy', field: 'dueDate', direction: 'asc' },
      ],
    });
  });

  it.each(['staff', 'manager', 'admin'] as const)(
    'uses only dueDate ordering for %s',
    (role) => {
      expect(jobsQueryForRole(role)).toEqual({
        kind: 'query',
        source: { kind: 'collection', name: 'jobs' },
        constraints: [{ kind: 'orderBy', field: 'dueDate', direction: 'asc' }],
      });
    },
  );
});

describe('user role queries and legacy defaults', () => {
  it('queries only active users in the selected AWF role', () => {
    watchAssignableUsers('awf', vi.fn(), vi.fn());

    expect(firestore.onSnapshot.mock.calls.at(-1)?.[0]).toEqual({
      kind: 'query',
      source: { kind: 'collection', name: 'users' },
      constraints: [
        { kind: 'where', field: 'status', operator: '==', value: 'active' },
        { kind: 'where', field: 'role', operator: '==', value: 'awf' },
      ],
    });
  });

  it('defaults invalid legacy user roles to Staff and statuses to pending', () => {
    expect(parseUser('legacy-user', { role: 'operator', status: 'unknown' })).toMatchObject({
      uid: 'legacy-user',
      role: 'staff',
      status: 'pending',
    });
  });
});

describe('legacy job parsing and collaborator normalization', () => {
  it('treats jobs without a category as Miscellaneous', () => {
    expect(parseJob('legacy-job', {}).category).toBe('miscellaneous');
  });

  it('falls back to the legacy primary AWF assignee when collaborators are absent', () => {
    const dueDate = new Date('2030-01-02T23:59:59.000Z');
    const job = parseJob('legacy-job', {
      dueDate: { toDate: () => dueDate },
      assignedToUid: 'legacy-awf',
      assignedToName: 'Legacy Person',
      assignedToRole: 'awf',
      collaborators: [],
      collaboratorUids: [],
      isAwf: true,
    });

    expect(job.isAwf).toBe(true);
    expect(job.collaborators).toEqual([
      { uid: 'legacy-awf', name: 'Legacy Person', role: 'awf' },
    ]);
    expect(job.collaboratorUids).toEqual(['legacy-awf']);
  });

  it('deduplicates collaborators by trimmed UID and preserves the first as primary', () => {
    const targets: AssignTarget[] = [
      { uid: ' user-1 ', name: ' First Person ', role: 'staff' },
      { uid: 'user-1', name: 'Duplicate', role: 'awf' },
      { uid: 'user-2', name: '', role: 'awf' },
      { uid: '   ', name: 'Ignored', role: 'staff' },
    ];

    expect(dedupeCollaborators(targets)).toEqual([
      { uid: 'user-1', name: 'First Person', role: 'staff' },
      { uid: 'user-2', name: 'User', role: 'awf' },
    ]);
  });
});

describe('job category persistence', () => {
  it('stores the selected category when creating a job', async () => {
    await addJob(actor, self('staff'), { ...input, category: 'softwareDevelopment' });
    expect(lastWritePayload(firestore.addDoc)).toMatchObject({
      category: 'softwareDevelopment',
    });
  });

  it('stores a changed category with the rest of a job edit', async () => {
    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'pending', category: 'manufacturing', quantity: 5 }),
    });
    await editJob(actor, self('manager'), 'job-1', {
      name: 'Updated job',
      category: 'repair',
    });
    expect(firestore.transactionUpdate.mock.calls.at(-1)?.[1]).toMatchObject({
      name: 'Updated job',
      category: 'repair',
    });
  });

  it('does not replace category during assignment or collaborator clearing', async () => {
    await assignJob(actor, self('manager'), 'job-1', [
      { uid: 'staff-1', name: 'Staff One', role: 'staff' },
    ]);
    expect(lastWritePayload(firestore.updateDoc)).not.toHaveProperty('category');

    await unassignJob(actor, 'job-1');
    expect(lastWritePayload(firestore.updateDoc)).not.toHaveProperty('category');
  });

  it('does not replace category while starting or completing a job', async () => {
    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'pending',
        category: 'design',
        collaborators: [],
        collaboratorUids: [],
      }),
    });
    await startJob(actor, self('staff'), 'job-1');
    expect(firestore.transactionUpdate.mock.calls.at(-1)?.[1]).not.toHaveProperty('category');

    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'started',
        name: 'Design review',
        category: 'design',
        collaborators: [{ uid: actor.uid, name: 'Avery Example', role: 'staff' }],
        collaboratorUids: [actor.uid],
      }),
    });
    await completeJob(actor, self('staff'), 'job-1');
    expect(firestore.transactionUpdate.mock.calls.at(-1)?.[1]).not.toHaveProperty('category');
  });

  it('does not replace category while restoring a job', async () => {
    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'completed' }),
    });
    await restoreJob(actor, 'job-1');
    expect(firestore.transactionUpdate.mock.calls.at(-1)?.[1]).not.toHaveProperty('category');
  });
});

describe('persistent AWF classification writes', () => {
  it('forces AWF-created jobs to true even when false is requested', async () => {
    await addJob(actor, self('awf'), { ...input, isAwf: false });
    expect(lastWritePayload(firestore.addDoc)).toMatchObject({ isAwf: true });
  });

  it.each([
    ['manager', true, true],
    ['manager', false, false],
    ['admin', true, true],
    ['admin', false, false],
    ['staff', true, false],
    ['staff', false, false],
  ] as const)('%s creation with requested=%s writes isAwf=%s', async (role, requested, expected) => {
    await addJob(actor, self(role), { ...input, isAwf: requested });
    expect(lastWritePayload(firestore.addDoc)).toMatchObject({ isAwf: expected });
  });

  it('allows managers and admins to explicitly change classification while editing', async () => {
    await editJob(actor, self('manager'), 'job-1', { isAwf: false });
    expect(lastWritePayload(firestore.updateDoc)).toMatchObject({ isAwf: false });

    await editJob(actor, self('admin'), 'job-1', { isAwf: true });
    expect(lastWritePayload(firestore.updateDoc)).toMatchObject({ isAwf: true });
  });

  it('promotes an assignment containing AWF Staff', async () => {
    await assignJob(actor, self('manager'), 'job-1', [
      { uid: 'staff-1', name: 'Staff One', role: 'staff' },
      { uid: 'awf-1', name: 'AWF One', role: 'awf' },
    ]);

    expect(lastWritePayload(firestore.updateDoc)).toMatchObject({
      isAwf: true,
      assignedToUid: 'staff-1',
      assignedToRole: 'staff',
      collaboratorUids: ['staff-1', 'awf-1'],
    });
  });

  it('does not clear classification when an AWF collaborator is removed', async () => {
    await assignJob(actor, self('manager'), 'job-1', [
      { uid: 'staff-1', name: 'Staff One', role: 'staff' },
    ]);

    expect(lastWritePayload(firestore.updateDoc)).not.toHaveProperty('isAwf');
  });
});

describe('AWF transactional self-start', () => {
  it('atomically starts, self-assigns, audits, and promotes an unassigned job', async () => {
    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'pending',
        isAwf: true,
        collaborators: [],
        collaboratorUids: [],
        assignedToUid: '',
      }),
    });

    await startJob(actor, self('awf'), 'job-1');

    expect(firestore.transactionUpdate).toHaveBeenCalledOnce();
    expect(firestore.transactionUpdate.mock.calls[0][1]).toMatchObject({
      status: 'started',
      isAwf: true,
      assignedToUid: actor.uid,
      assignedToName: 'Avery Example',
      assignedToRole: 'awf',
      collaborators: [{ uid: actor.uid, name: 'Avery Example', role: 'awf' }],
      collaboratorUids: [actor.uid],
      assignedByUid: actor.uid,
      assignedByName: 'Avery Example',
    });
  });

  it('rejects AWF Staff when a pending job belongs to another collaborator', async () => {
    firestore.transactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'pending',
        isAwf: true,
        collaborators: [{ uid: 'someone-else', name: 'Other Person', role: 'awf' }],
        collaboratorUids: ['someone-else'],
        assignedToUid: 'someone-else',
      }),
    });

    await expect(startJob(actor, self('awf'), 'job-1')).rejects.toThrow(
      'This job is assigned to someone else.',
    );
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });
});
