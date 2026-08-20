import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobSection, UserRole } from '../types';

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
  applySectionProgressUpdates,
  clearRemovedCollaborators,
  mergeJobSections,
  overallSectionProgress,
  parseJobSections,
  sectionRequiredMessage,
  validateJobSections,
  validateSectionAssignments,
  SECTION_ASSIGNMENT_REQUIRED_MESSAGE,
} from '../lib/jobSections';
import {
  addJob,
  assignJob,
  completeJob,
  editJob,
  parseJob,
  restoreJob,
  unassignJob,
  updateSectionProgress,
  FOREIGN_SECTION_MESSAGE,
  SECTION_NAMES_LOCKED_MESSAGE,
  SECTION_OWNERS_LOCKED_MESSAGE,
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

const REPAIR_REQUIRED = sectionRequiredMessage('repair');
const SECTIONS_REQUIRED = sectionRequiredMessage('manufacturing');

const input: JobInput = {
  name: 'Actuator repair',
  customer: 'Receiver',
  quantity: 1,
  dueDate: new Date('2030-01-02T23:59:59.000Z'),
  category: 'repair',
};

/** Stored shape: an unassigned section omits collaboratorUid entirely, exactly
 *  as the Flutter writer leaves it. */
const ACTUATOR_PROCESSES: JobSection[] = [
  { name: 'Cleaning', progress: 100, collaboratorUid: 'worker-1' },
  { name: 'Welding', progress: 50, collaboratorUid: 'worker-1' },
  { name: 'Machining', progress: 25, collaboratorUid: 'worker-2' },
  { name: 'Spraying', progress: 0, collaboratorUid: '' },
];

const CHAIR_SECTIONS: JobSection[] = [
  { name: 'Design', progress: 40, collaboratorUid: 'worker-1' },
  { name: 'Routing', progress: 20, collaboratorUid: 'worker-2' },
  { name: 'Metalworking', progress: 0, collaboratorUid: 'worker-2' },
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

describe('job-section parsing and maths', () => {
  it('treats a missing or malformed list as empty', () => {
    expect(parseJob('job-1', {}).repairProcesses).toEqual([]);
    expect(parseJobSections(undefined)).toEqual([]);
    expect(parseJobSections('Cleaning')).toEqual([]);
  });

  it('trims names, drops blanks, collapses duplicates, and clamps progress', () => {
    expect(
      parseJobSections([
        { name: '  Cleaning  ', progress: 140 },
        { name: 'cleaning', progress: 10 },
        { name: '   ', progress: 50 },
        { name: 'Welding', progress: -20 },
        { name: 'Machining', progress: 'nonsense' },
        { name: 'Spraying', progress: 33.4 },
        'not an object',
      ]),
    ).toEqual([
      { name: 'Cleaning', progress: 100, collaboratorUid: '' },
      { name: 'Welding', progress: 0, collaboratorUid: '' },
      { name: 'Machining', progress: 0, collaboratorUid: '' },
      { name: 'Spraying', progress: 33, collaboratorUid: '' },
    ]);
  });

  it('reads collaboratorUid, trimming it and defaulting legacy sections to ""', () => {
    expect(
      parseJob('job-1', {
        repairProcesses: [
          { name: 'Design', progress: 40, collaboratorUid: '  worker-1  ' },
          // Written before section ownership existed.
          { name: 'Routing', progress: 20 },
          { name: 'Metalworking', progress: 0, collaboratorUid: 7 },
        ],
      }).repairProcesses,
    ).toEqual([
      { name: 'Design', progress: 40, collaboratorUid: 'worker-1' },
      { name: 'Routing', progress: 20, collaboratorUid: '' },
      { name: 'Metalworking', progress: 0, collaboratorUid: '' },
    ]);
  });

  it('omits collaboratorUid from the stored map while a section is unassigned', async () => {
    await addJob(actor, self('manager'), {
      ...input,
      category: 'manufacturing',
      sectionNames: ['Design'],
    });
    expect(createdPayload().repairProcesses).toEqual([{ name: 'Design', progress: 0 }]);
    expect(createdPayload().repairProcesses).not.toHaveProperty('0.collaboratorUid');
  });

  it('averages the percentages and rounds: (100 + 50 + 25 + 0) / 4 = 44%', () => {
    expect(overallSectionProgress(ACTUATOR_PROCESSES)).toBe(44);
    expect(overallSectionProgress([])).toBe(0);
    expect(overallSectionProgress([{ name: 'Cleaning', progress: 100, collaboratorUid: '' }])).toBe(100);
  });

  it('keeps percentage and owner for unchanged names and starts new ones fresh', () => {
    expect(
      mergeJobSections(ACTUATOR_PROCESSES, ['cleaning', 'Machining', 'Painting']),
    ).toEqual([
      { name: 'cleaning', progress: 100, collaboratorUid: 'worker-1' },
      { name: 'Machining', progress: 25, collaboratorUid: 'worker-2' },
      { name: 'Painting', progress: 0, collaboratorUid: '' },
    ]);
  });

  it('requires at least one section for every category, with per-category wording', () => {
    expect(validateJobSections('manufacturing', [])).toBe(SECTIONS_REQUIRED);
    expect(validateJobSections('repair', [])).toBe(REPAIR_REQUIRED);
    expect(SECTIONS_REQUIRED).toBe('Add at least one job section.');
    expect(REPAIR_REQUIRED).toBe('Add at least one repair process.');
    expect(validateJobSections('manufacturing', CHAIR_SECTIONS)).toBeNull();
    expect(validateJobSections('repair', ACTUATOR_PROCESSES)).toBeNull();
  });

  it('applies submitted percentages onto the stored definitions only, owners intact', () => {
    expect(
      applySectionProgressUpdates(ACTUATOR_PROCESSES, [
        { name: 'welding', progress: 75, collaboratorUid: 'impostor' },
        { name: 'Deleted section', progress: 100, collaboratorUid: 'worker-1' },
      ]),
    ).toEqual([
      { name: 'Cleaning', progress: 100, collaboratorUid: 'worker-1' },
      { name: 'Welding', progress: 75, collaboratorUid: 'worker-1' },
      { name: 'Machining', progress: 25, collaboratorUid: 'worker-2' },
      { name: 'Spraying', progress: 0, collaboratorUid: '' },
    ]);
  });

  it('unassigns sections whose collaborator left the job', () => {
    expect(clearRemovedCollaborators(CHAIR_SECTIONS, ['worker-2'])).toEqual([
      { name: 'Design', progress: 40, collaboratorUid: '' },
      { name: 'Routing', progress: 20, collaboratorUid: 'worker-2' },
      { name: 'Metalworking', progress: 0, collaboratorUid: 'worker-2' },
    ]);
  });

  it('rejects a section left unassigned or handed to a non-collaborator', () => {
    expect(validateSectionAssignments(CHAIR_SECTIONS, ['worker-1', 'worker-2'])).toBeNull();
    expect(validateSectionAssignments(CHAIR_SECTIONS, ['worker-1'])).toBe(
      SECTION_ASSIGNMENT_REQUIRED_MESSAGE,
    );
    expect(
      validateSectionAssignments(
        [{ name: 'Design', progress: 0, collaboratorUid: '' }],
        ['worker-1'],
      ),
    ).toBe(SECTION_ASSIGNMENT_REQUIRED_MESSAGE);
  });
});

describe('creating jobs with sections', () => {
  it('requires at least one section, whatever the category', async () => {
    await expect(addJob(actor, self('manager'), input)).rejects.toThrow(REPAIR_REQUIRED);
    await expect(
      addJob(actor, self('manager'), { ...input, sectionNames: ['   '] }),
    ).rejects.toThrow(REPAIR_REQUIRED);
    await expect(
      addJob(actor, self('manager'), { ...input, category: 'manufacturing' }),
    ).rejects.toThrow(SECTIONS_REQUIRED);
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('stores each named section at 0% and unassigned', async () => {
    await addJob(actor, self('manager'), {
      ...input,
      sectionNames: ['Cleaning', 'Welding', 'Machining', 'Spraying'],
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

  it('stores sections for a non-repair category too', async () => {
    await addJob(actor, self('manager'), {
      ...input,
      name: 'Chairs',
      category: 'manufacturing',
      sectionNames: ['Design', 'Routing', 'Metalworking'],
    });
    expect(createdPayload()).toMatchObject({
      category: 'manufacturing',
      repairProcesses: [
        { name: 'Design', progress: 0 },
        { name: 'Routing', progress: 0 },
        { name: 'Metalworking', progress: 0 },
      ],
    });
  });
});

describe('editing job sections', () => {
  it('keeps existing percentages and owners, adds new sections unassigned at 0%', async () => {
    storedJob({
      status: 'started',
      category: 'repair',
      quantity: 1,
      repairProcesses: ACTUATOR_PROCESSES,
    });

    await editJob(actor, self('manager'), 'job-1', {
      category: 'repair',
      sectionNames: ['cleaning', 'Machining', 'Polishing'],
    });

    expect(transactionPayload()).toMatchObject({
      repairProcesses: [
        { name: 'cleaning', progress: 100, collaboratorUid: 'worker-1' },
        { name: 'Machining', progress: 25, collaboratorUid: 'worker-2' },
        { name: 'Polishing', progress: 0 },
      ],
    });
  });

  it('rejects an edit that would leave a job without a section', async () => {
    storedJob({ status: 'pending', category: 'repair', quantity: 1, repairProcesses: ACTUATOR_PROCESSES });

    await expect(
      editJob(actor, self('manager'), 'job-1', { category: 'repair', sectionNames: [] }),
    ).rejects.toThrow(REPAIR_REQUIRED);
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('keeps the list when the job changes to another category', async () => {
    storedJob({
      status: 'pending',
      category: 'repair',
      quantity: 1,
      repairProcesses: ACTUATOR_PROCESSES,
    });

    await editJob(actor, self('manager'), 'job-1', { category: 'manufacturing' });

    expect(transactionPayload()).toMatchObject({ category: 'manufacturing' });
    expect(transactionPayload()).not.toHaveProperty('repairProcesses');
  });

  it('leaves the stored list untouched when the edit does not mention it', async () => {
    storedJob({
      status: 'pending',
      category: 'repair',
      quantity: 1,
      repairProcesses: ACTUATOR_PROCESSES,
    });

    await editJob(actor, self('manager'), 'job-1', { name: 'Renamed', quantity: 1 });

    expect(transactionPayload()).not.toHaveProperty('repairProcesses');
  });
});

describe('assigning collaborators to sections', () => {
  const collaborators = [
    { uid: 'worker-1', name: 'Worker One', role: 'staff' as UserRole },
    { uid: 'worker-2', name: 'Worker Two', role: 'staff' as UserRole },
  ];

  it('saves the section assignments alongside the collaborator list', async () => {
    await assignJob(actor, self('manager'), 'job-1', collaborators, CHAIR_SECTIONS);

    expect(updatePayload()).toMatchObject({
      collaboratorUids: ['worker-1', 'worker-2'],
      repairProcesses: [
        { name: 'Design', progress: 40, collaboratorUid: 'worker-1' },
        { name: 'Routing', progress: 20, collaboratorUid: 'worker-2' },
        { name: 'Metalworking', progress: 0, collaboratorUid: 'worker-2' },
      ],
    });
  });

  it('lets one collaborator own several sections', async () => {
    await assignJob(
      actor,
      self('manager'),
      'job-1',
      [collaborators[0]],
      CHAIR_SECTIONS.map((section) => ({ ...section, collaboratorUid: 'worker-1' })),
    );

    expect(updatePayload().repairProcesses).toEqual([
      { name: 'Design', progress: 40, collaboratorUid: 'worker-1' },
      { name: 'Routing', progress: 20, collaboratorUid: 'worker-1' },
      { name: 'Metalworking', progress: 0, collaboratorUid: 'worker-1' },
    ]);
  });

  it('refuses a save that leaves a section unassigned or owned by an outsider', async () => {
    await expect(
      assignJob(actor, self('manager'), 'job-1', [collaborators[0]], CHAIR_SECTIONS),
    ).rejects.toThrow(SECTION_ASSIGNMENT_REQUIRED_MESSAGE);
    await expect(
      assignJob(actor, self('manager'), 'job-1', collaborators, [
        { name: 'Design', progress: 0, collaboratorUid: '' },
      ]),
    ).rejects.toThrow(SECTION_ASSIGNMENT_REQUIRED_MESSAGE);
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('clears every owner when the whole team is cleared', async () => {
    await unassignJob(actor, 'job-1', CHAIR_SECTIONS);

    expect(updatePayload()).toMatchObject({
      collaboratorUids: [],
      repairProcesses: [
        { name: 'Design', progress: 40 },
        { name: 'Routing', progress: 20 },
        { name: 'Metalworking', progress: 0 },
      ],
    });
    for (const section of updatePayload().repairProcesses as Record<string, unknown>[]) {
      expect(section).not.toHaveProperty('collaboratorUid');
    }
  });
});

describe('completing and restoring jobs with sections', () => {
  it('finishes every section when the job is completed, keeping owners', async () => {
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
        { name: 'Cleaning', progress: 100, collaboratorUid: 'worker-1' },
        { name: 'Welding', progress: 100, collaboratorUid: 'worker-1' },
        { name: 'Machining', progress: 100, collaboratorUid: 'worker-2' },
        { name: 'Spraying', progress: 100 },
      ],
    });
  });

  it('restores every section to 0% and unassigned, without losing its name', async () => {
    storedJob({
      status: 'completed',
      category: 'repair',
      quantity: 4,
      repairProcesses: ACTUATOR_PROCESSES.map((section) => ({ ...section, progress: 100 })),
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
    for (const section of transactionPayload().repairProcesses as Record<string, unknown>[]) {
      expect(section).not.toHaveProperty('collaboratorUid');
    }
  });

  it('leaves sectionless legacy jobs without a repairProcesses write', async () => {
    storedJob({ status: 'completed', category: 'manufacturing', quantity: 4 });
    await restoreJob(actor, 'job-1');
    expect(transactionPayload()).not.toHaveProperty('repairProcesses');
  });
});

describe('updating section progress', () => {
  const started = {
    status: 'started',
    category: 'repair',
    quantity: 1,
    collaboratorUids: ['worker-1', 'worker-2'],
    collaborators: [
      { uid: 'worker-1', name: 'Worker One', role: 'staff' },
      { uid: 'worker-2', name: 'Worker Two', role: 'staff' },
    ],
    repairProcesses: ACTUATOR_PROCESSES,
  };

  /** Only Welding — one of worker-1's own sections — moves. */
  const submitted: JobSection[] = [
    { name: 'Cleaning', progress: 100, collaboratorUid: 'worker-1' },
    { name: 'Welding', progress: 75, collaboratorUid: 'worker-1' },
    { name: 'Machining', progress: 25, collaboratorUid: 'worker-2' },
    { name: 'Spraying', progress: 0, collaboratorUid: '' },
  ];

  function update(uid: string, role: UserRole, sections: readonly JobSection[] = submitted) {
    return updateSectionProgress({
      jobId: 'job-1',
      sections,
      currentUser: { ...actor, uid, role },
    });
  }

  it('writes the whole array with the standard audit fields for a collaborator', async () => {
    storedJob(started);
    await update('worker-1', 'staff');

    expect(transactionPayload()).toMatchObject({
      repairProcesses: [
        { name: 'Cleaning', progress: 100, collaboratorUid: 'worker-1' },
        { name: 'Welding', progress: 75, collaboratorUid: 'worker-1' },
        { name: 'Machining', progress: 25, collaboratorUid: 'worker-2' },
        { name: 'Spraying', progress: 0 },
      ],
      updatedByUid: 'worker-1',
      updatedByName: 'Avery Example',
      updatedAt: { kind: 'serverTimestamp' },
    });
  });

  it.each(['manager', 'admin'] as const)(
    'lets a %s who is not a collaborator move any section',
    async (role) => {
      storedJob(started);
      await update('boss-1', role, [
        { name: 'Machining', progress: 90, collaboratorUid: 'worker-2' },
        { name: 'Spraying', progress: 10, collaboratorUid: '' },
      ]);
      expect(transactionPayload()).toMatchObject({
        repairProcesses: [
          { name: 'Cleaning', progress: 100, collaboratorUid: 'worker-1' },
          { name: 'Welding', progress: 50, collaboratorUid: 'worker-1' },
          { name: 'Machining', progress: 90, collaboratorUid: 'worker-2' },
          { name: 'Spraying', progress: 10 },
        ],
      });
    },
  );

  it('rejects a collaborator moving a section assigned to someone else', async () => {
    storedJob(started);
    await expect(
      update('worker-1', 'staff', [
        { name: 'Machining', progress: 90, collaboratorUid: 'worker-2' },
      ]),
    ).rejects.toThrow(FOREIGN_SECTION_MESSAGE);
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('rejects a collaborator moving an unassigned section', async () => {
    storedJob(started);
    await expect(
      update('worker-1', 'staff', [{ name: 'Spraying', progress: 30, collaboratorUid: '' }]),
    ).rejects.toThrow(FOREIGN_SECTION_MESSAGE);
  });

  it('rejects a collaborator renaming or adding a section', async () => {
    storedJob(started);
    await expect(
      update('worker-1', 'staff', [{ name: 'Wleding', progress: 75, collaboratorUid: 'worker-1' }]),
    ).rejects.toThrow(SECTION_NAMES_LOCKED_MESSAGE);
  });

  it('rejects a collaborator reassigning a section to themselves', async () => {
    storedJob(started);
    await expect(
      update('worker-1', 'staff', [
        { name: 'Machining', progress: 25, collaboratorUid: 'worker-1' },
      ]),
    ).rejects.toThrow(SECTION_OWNERS_LOCKED_MESSAGE);
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('rejects staff who are not on the job at all', async () => {
    storedJob(started);
    await expect(update('someone-else', 'staff')).rejects.toThrow(
      'Only a collaborator, manager, or admin can update section progress.',
    );
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('rejects a completed job', async () => {
    storedJob({ ...started, status: 'completed' });
    await expect(update('worker-1', 'staff')).rejects.toThrow(
      'Completed jobs cannot have their section progress updated.',
    );
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('accepts a non-repair job — every category tracks sections', async () => {
    storedJob({
      ...started,
      status: 'pending',
      category: 'manufacturing',
      repairProcesses: CHAIR_SECTIONS,
    });

    await update('worker-2', 'staff', [
      { name: 'Routing', progress: 60, collaboratorUid: 'worker-2' },
    ]);

    expect(transactionPayload()).toMatchObject({
      repairProcesses: [
        { name: 'Design', progress: 40, collaboratorUid: 'worker-1' },
        { name: 'Routing', progress: 60, collaboratorUid: 'worker-2' },
        { name: 'Metalworking', progress: 0, collaboratorUid: 'worker-2' },
      ],
    });
  });

  it('clamps out-of-range percentages on the sections the caller owns', async () => {
    storedJob({ ...started, status: 'pending' });
    await update('worker-1', 'staff', [
      { name: 'Cleaning', progress: 250, collaboratorUid: 'worker-1' },
      { name: 'Welding', progress: -5, collaboratorUid: 'worker-1' },
    ]);

    expect(transactionPayload()).toMatchObject({
      repairProcesses: [
        { name: 'Cleaning', progress: 100, collaboratorUid: 'worker-1' },
        { name: 'Welding', progress: 0, collaboratorUid: 'worker-1' },
        { name: 'Machining', progress: 25, collaboratorUid: 'worker-2' },
        { name: 'Spraying', progress: 0 },
      ],
    });
  });
});
