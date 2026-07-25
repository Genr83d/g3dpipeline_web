import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairProcess, UserRole } from '../types';

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

import {
  applyRepairProgressUpdates,
  mergeRepairProcesses,
  overallRepairProgress,
  parseRepairProcesses,
  repairProcessesForCategory,
  validateRepairProcesses,
  REPAIR_PROCESS_REQUIRED_MESSAGE,
} from '../lib/repairProcesses';
import {
  addJob,
  completeJob,
  editJob,
  parseJob,
  restoreJob,
  updateRepairProgress,
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
  category: 'repair',
};

const ACTUATOR_PROCESSES = [
  { name: 'Cleaning', progress: 100 },
  { name: 'Welding', progress: 50 },
  { name: 'Machining', progress: 25 },
  { name: 'Spraying', progress: 0 },
];

function self(role: UserRole): Assigner {
  return { uid: actor.uid, name: 'Avery Example', role };
}

function storedJob(data: Record<string, unknown>) {
  firestore.transactionGet.mockResolvedValueOnce({ exists: () => true, data: () => data });
}

function createdPayload() {
  return firestore.setDoc.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

function transactionPayload() {
  return firestore.transactionUpdate.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  firestore.transactionGet.mockResolvedValue({ exists: () => true, data: () => ({}) });
});

describe('repair-process parsing and maths', () => {
  it('treats a missing or malformed list as empty', () => {
    expect(parseJob('job-1', {}).repairProcesses).toEqual([]);
    expect(parseRepairProcesses(undefined)).toEqual([]);
    expect(parseRepairProcesses('Cleaning')).toEqual([]);
  });

  it('trims names, drops blanks, collapses duplicates, and clamps progress', () => {
    expect(
      parseRepairProcesses([
        { name: '  Cleaning  ', progress: 140 },
        { name: 'cleaning', progress: 10 },
        { name: '   ', progress: 50 },
        { name: 'Welding', progress: -20 },
        { name: 'Machining', progress: 'nonsense' },
        { name: 'Spraying', progress: 33.4 },
        'not an object',
      ]),
    ).toEqual([
      { name: 'Cleaning', progress: 100 },
      { name: 'Welding', progress: 0 },
      { name: 'Machining', progress: 0 },
      { name: 'Spraying', progress: 33 },
    ]);
  });

  it('averages the percentages and rounds: (100 + 50 + 25 + 0) / 4 = 44%', () => {
    expect(overallRepairProgress(ACTUATOR_PROCESSES)).toBe(44);
    expect(overallRepairProgress([])).toBe(0);
    expect(overallRepairProgress([{ name: 'Cleaning', progress: 100 }])).toBe(100);
  });

  it('keeps percentages for unchanged names and starts new ones at 0%', () => {
    expect(
      mergeRepairProcesses(ACTUATOR_PROCESSES, ['cleaning', 'Welding', 'Painting']),
    ).toEqual([
      { name: 'cleaning', progress: 100 },
      { name: 'Welding', progress: 50 },
      { name: 'Painting', progress: 0 },
    ]);
  });

  it('stores nothing for non-repair categories and requires one process for repair', () => {
    expect(repairProcessesForCategory('manufacturing', ACTUATOR_PROCESSES)).toEqual([]);
    expect(validateRepairProcesses('manufacturing', [])).toBeNull();
    expect(validateRepairProcesses('repair', [])).toBe(REPAIR_PROCESS_REQUIRED_MESSAGE);
    expect(validateRepairProcesses('repair', ACTUATOR_PROCESSES)).toBeNull();
  });

  it('applies submitted percentages onto the stored definitions only', () => {
    expect(
      applyRepairProgressUpdates(ACTUATOR_PROCESSES, [
        { name: 'welding', progress: 75 },
        { name: 'Deleted process', progress: 100 },
      ]),
    ).toEqual([
      { name: 'Cleaning', progress: 100 },
      { name: 'Welding', progress: 75 },
      { name: 'Machining', progress: 25 },
      { name: 'Spraying', progress: 0 },
    ]);
  });
});

describe('creating repair jobs', () => {
  it('requires at least one process', async () => {
    await expect(addJob(actor, self('manager'), input)).rejects.toThrow(
      REPAIR_PROCESS_REQUIRED_MESSAGE,
    );
    await expect(
      addJob(actor, self('manager'), { ...input, repairProcessNames: ['   '] }),
    ).rejects.toThrow(REPAIR_PROCESS_REQUIRED_MESSAGE);
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('stores each named process at 0%', async () => {
    await addJob(actor, self('manager'), {
      ...input,
      repairProcessNames: ['Cleaning', 'Welding', 'Machining', 'Spraying'],
    });

    expect(createdPayload()).toMatchObject({
      category: 'repair',
      repairProcesses: [
        { name: 'Cleaning', progress: 0 },
        { name: 'Welding', progress: 0 },
        { name: 'Machining', progress: 0 },
        { name: 'Spraying', progress: 0 },
      ],
    });
  });

  it('stores an empty list for every other category', async () => {
    await addJob(actor, self('manager'), {
      ...input,
      category: 'manufacturing',
      repairProcessNames: ['Cleaning'],
    });
    expect(createdPayload()).toMatchObject({ category: 'manufacturing', repairProcesses: [] });
  });
});

describe('editing repair jobs', () => {
  it('keeps existing percentages, adds new processes at 0%, and drops removed ones', async () => {
    storedJob({
      status: 'started',
      category: 'repair',
      quantity: 1,
      repairProcesses: ACTUATOR_PROCESSES,
    });

    await editJob(actor, self('manager'), 'job-1', {
      category: 'repair',
      repairProcessNames: ['cleaning', 'Welding', 'Polishing'],
    });

    expect(transactionPayload()).toMatchObject({
      repairProcesses: [
        { name: 'cleaning', progress: 100 },
        { name: 'Welding', progress: 50 },
        { name: 'Polishing', progress: 0 },
      ],
    });
  });

  it('rejects an edit that would leave a repair job without a process', async () => {
    storedJob({ status: 'pending', category: 'repair', quantity: 1, repairProcesses: ACTUATOR_PROCESSES });

    await expect(
      editJob(actor, self('manager'), 'job-1', { category: 'repair', repairProcessNames: [] }),
    ).rejects.toThrow(REPAIR_PROCESS_REQUIRED_MESSAGE);
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('clears the list when the job changes to another category', async () => {
    storedJob({
      status: 'pending',
      category: 'repair',
      quantity: 1,
      repairProcesses: ACTUATOR_PROCESSES,
    });

    await editJob(actor, self('manager'), 'job-1', { category: 'manufacturing' });

    expect(transactionPayload()).toMatchObject({ category: 'manufacturing', repairProcesses: [] });
  });

  it('leaves the stored list untouched when the edit does not mention it', async () => {
    storedJob({
      status: 'pending',
      category: 'repair',
      quantity: 1,
      repairProcesses: ACTUATOR_PROCESSES,
    });

    await editJob(actor, self('manager'), 'job-1', { category: 'repair', name: 'Renamed' });

    expect(transactionPayload()).toMatchObject({ repairProcesses: ACTUATOR_PROCESSES });
  });
});

describe('completing and restoring repair jobs', () => {
  it('finishes every process when the job is completed', async () => {
    storedJob({
      status: 'started',
      name: 'Actuator repair',
      category: 'repair',
      quantity: 1,
      collaboratorUids: [actor.uid],
      repairProcesses: ACTUATOR_PROCESSES,
    });

    await completeJob(actor, self('staff'), 'job-1');

    expect(transactionPayload()).toMatchObject({
      status: 'completed',
      repairProcesses: [
        { name: 'Cleaning', progress: 100 },
        { name: 'Welding', progress: 100 },
        { name: 'Machining', progress: 100 },
        { name: 'Spraying', progress: 100 },
      ],
    });
  });

  it('restores every process to 0% without losing its name', async () => {
    storedJob({
      status: 'completed',
      category: 'repair',
      quantity: 4,
      repairProcesses: ACTUATOR_PROCESSES.map((process) => ({ ...process, progress: 100 })),
    });

    await restoreJob(actor, 'job-1');

    expect(transactionPayload()).toMatchObject({
      status: 'pending',
      completedQuantity: 0,
      repairProcesses: [
        { name: 'Cleaning', progress: 0 },
        { name: 'Welding', progress: 0 },
        { name: 'Machining', progress: 0 },
        { name: 'Spraying', progress: 0 },
      ],
    });
  });

  it('leaves non-repair jobs without a repairProcesses write', async () => {
    storedJob({ status: 'completed', category: 'manufacturing', quantity: 4 });
    await restoreJob(actor, 'job-1');
    expect(transactionPayload()).not.toHaveProperty('repairProcesses');
  });
});

describe('updating repair progress', () => {
  const started = {
    status: 'started',
    category: 'repair',
    quantity: 1,
    collaboratorUids: ['worker-1'],
    collaborators: [{ uid: 'worker-1', name: 'Worker', role: 'staff' }],
    repairProcesses: ACTUATOR_PROCESSES,
  };

  const submitted: RepairProcess[] = [
    { name: 'Cleaning', progress: 100 },
    { name: 'Welding', progress: 75 },
    { name: 'Machining', progress: 25 },
    { name: 'Spraying', progress: 5 },
  ];

  function update(uid: string, role: UserRole) {
    return updateRepairProgress({
      jobId: 'job-1',
      processes: submitted,
      currentUser: { ...actor, uid, role },
    });
  }

  it('writes the whole array with the standard audit fields for a collaborator', async () => {
    storedJob(started);
    await update('worker-1', 'staff');

    expect(transactionPayload()).toMatchObject({
      repairProcesses: submitted,
      updatedByUid: 'worker-1',
      updatedByName: 'Avery Example',
      updatedAt: { kind: 'serverTimestamp' },
    });
  });

  it.each(['manager', 'admin'] as const)('allows a %s who is not a collaborator', async (role) => {
    storedJob(started);
    await update('boss-1', role);
    expect(transactionPayload()).toMatchObject({ repairProcesses: submitted });
  });

  it('rejects staff who are not assigned to the job', async () => {
    storedJob(started);
    await expect(update('someone-else', 'staff')).rejects.toThrow(
      'Only a collaborator, manager, or admin can update repair progress.',
    );
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('rejects a completed job', async () => {
    storedJob({ ...started, status: 'completed' });
    await expect(update('worker-1', 'staff')).rejects.toThrow(
      'Completed jobs cannot have their repair progress updated.',
    );
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('rejects a job that is not a repair job', async () => {
    storedJob({ ...started, category: 'manufacturing', repairProcesses: [] });
    await expect(update('worker-1', 'staff')).rejects.toThrow(
      'Only repair jobs track repair processes.',
    );
  });

  it('accepts a pending job and clamps out-of-range percentages', async () => {
    storedJob({ ...started, status: 'pending' });
    await updateRepairProgress({
      jobId: 'job-1',
      processes: [
        { name: 'Cleaning', progress: 250 },
        { name: 'Welding', progress: -5 },
      ],
      currentUser: { ...actor, uid: 'worker-1', role: 'staff' },
    });

    expect(transactionPayload()).toMatchObject({
      repairProcesses: [
        { name: 'Cleaning', progress: 100 },
        { name: 'Welding', progress: 0 },
        { name: 'Machining', progress: 25 },
        { name: 'Spraying', progress: 0 },
      ],
    });
  });
});
