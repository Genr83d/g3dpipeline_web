import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobTag } from '../types';

/** Stands in for the ID Firestore generates for a new job document. */
const GENERATED_JOB_ID = 'abc123xyz789';

/** Shapes the mocks return. Declared so `mockImplementation` in a test can
 *  widen what a stub yields without TypeScript pinning it to the default. */
interface StubSnapshot {
  exists: () => boolean;
  data: () => Record<string, unknown>;
}
interface StubQuerySnapshot {
  docs: Array<{ id: string; ref?: unknown; data: () => Record<string, unknown> }>;
}

const firestore = vi.hoisted(() => {
  const transactionGet = vi.fn(
    async (_ref: unknown): Promise<{ exists: () => boolean; data: () => Record<string, unknown> }> => ({
      exists: () => true,
      data: () => ({}),
    }),
  );
  const transactionUpdate = vi.fn((_ref: unknown, _patch: unknown) => undefined);

  return {
    collection: vi.fn((_db: unknown, name: string) => ({ kind: 'collection', name })),
    doc: vi.fn((target: unknown, collectionName?: string, id?: string) =>
      typeof collectionName === 'string' && typeof id === 'string'
        ? { kind: 'doc', collectionName, id }
        : {
            kind: 'doc',
            collectionName: (target as { name?: string } | null)?.name ?? '',
            id: GENERATED_JOB_ID,
          },
    ),
    addDoc: vi.fn(async (_collection: unknown, _data: unknown) => ({ id: 'new-job' })),
    setDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined),
    deleteDoc: vi.fn(async (_ref: unknown) => undefined),
    updateDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined),
    getDocs: vi.fn(
      async (
        _query: unknown,
      ): Promise<{
        docs: Array<{ id: string; ref?: unknown; data: () => Record<string, unknown> }>;
      }> => ({ docs: [] }),
    ),
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

const INVENTORY_COL = { kind: 'collection', name: 'inventory' };
vi.mock('../services/inventoryService', () => ({
  inventoryCol: { kind: 'collection', name: 'inventory' },
}));

import { addJob, completeJob, editJob, type Actor, type Assigner } from '../services/jobService';

const actor: Actor = {
  uid: 'current-user',
  firstName: 'Avery',
  displayName: 'Avery Example',
  email: 'avery@example.com',
};

const admin: Assigner = { uid: actor.uid, name: 'Avery Example', role: 'admin' };

const JOB_ID = 'job-1';

interface MaterialSeed {
  name: string;
  quantity: number;
}

interface CompletedSeed {
  id: string;
  name: string;
  quantity: number;
  /** Omit entirely to model a document written before tags existed. */
  tags?: string[];
}

/** Wires the two pre-transaction queries and the in-transaction reads so a
 *  completion runs against a known board and a known stock room. */
function shop({
  job,
  materials = [],
  alreadyCompleted = [],
}: {
  job: Record<string, unknown>;
  materials?: MaterialSeed[];
  alreadyCompleted?: CompletedSeed[];
}) {
  const materialRef = (name: string) => ({ kind: 'materialRef', name });

  firestore.getDocs.mockImplementation(async (source: unknown): Promise<StubQuerySnapshot> => {
    const target = source as { kind?: string; source?: unknown };
    const isInventory =
      target?.kind === 'collection' && (source as { name?: string }).name === INVENTORY_COL.name;
    if (isInventory) {
      return {
        docs: materials.map((material) => ({
          id: `material-${material.name}`,
          ref: materialRef(material.name),
          data: () => ({ name: material.name, quantity: material.quantity }),
        })),
      };
    }
    return {
      docs: alreadyCompleted.map((completed) => ({
        id: completed.id,
        data: () => ({
          name: completed.name,
          quantity: completed.quantity,
          ...(completed.tags === undefined ? {} : { tags: completed.tags }),
        }),
      })),
    };
  });

  firestore.transactionGet.mockImplementation(async (ref: unknown): Promise<StubSnapshot> => {
    const target = ref as { kind?: string; name?: string };
    if (target?.kind === 'materialRef') {
      const material = materials.find((entry) => entry.name === target.name);
      return {
        exists: () => material !== undefined,
        data: () => ({ name: target.name, quantity: material?.quantity ?? 0 }),
      };
    }
    return { exists: () => true, data: () => job };
  });
}

/** A started job the current admin is allowed to complete. */
function startedJob(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'started',
    name: 'Bracket set',
    quantity: 12,
    category: 'manufacturing',
    collaborators: [],
    collaboratorUids: [],
    ...overrides,
  };
}

/** Material writes only, keyed by material name. */
function stockWrites(): Record<string, number> {
  const written: Record<string, number> = {};
  for (const [ref, patch] of firestore.transactionUpdate.mock.calls) {
    const target = ref as { kind?: string; name?: string };
    if (target?.kind === 'materialRef') {
      written[target.name!] = (patch as { quantity: number }).quantity;
    }
  }
  return written;
}

function jobPatch(): Record<string, unknown> | undefined {
  const call = firestore.transactionUpdate.mock.calls.find(
    ([ref]) => (ref as { kind?: string }).kind !== 'materialRef',
  );
  return call?.[1] as Record<string, unknown> | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  firestore.getDocs.mockResolvedValue({ docs: [] });
  firestore.transactionGet.mockResolvedValue({ exists: () => true, data: () => ({}) });
});

describe('completing a tagged job moves stock', () => {
  it('deducts one Pin Back per pin and leaves Lamina alone inside a batch', async () => {
    shop({
      job: startedJob({ name: 'Enamel widgets', tags: ['pins'], quantity: 12 }),
      materials: [
        { name: 'Pin Backs', quantity: 100 },
        { name: 'Lamina', quantity: 10 },
      ],
    });

    await completeJob(actor, admin, JOB_ID);

    expect(stockWrites()).toEqual({ 'Pin Backs': 88 });
    expect(jobPatch()).toMatchObject({ status: 'completed' });
  });

  it('takes a Lamina sheet when the shop total crosses 50 pins', async () => {
    shop({
      job: startedJob({ name: 'Lapel run', tags: ['pins'], quantity: 58 }),
      materials: [
        { name: 'Pin Backs', quantity: 100 },
        { name: 'Lamina', quantity: 10 },
      ],
    });

    await completeJob(actor, admin, JOB_ID);

    expect(stockWrites()).toEqual({ 'Pin Backs': 42, Lamina: 9 });
  });

  it('counts pins already completed, including jobs written before tags existed', async () => {
    shop({
      job: startedJob({ name: 'Second run', tags: ['pins'], quantity: 42 }),
      materials: [
        { name: 'Pin Backs', quantity: 100 },
        { name: 'Lamina', quantity: 10 },
      ],
      // No tags field: a legacy pin job, recognised by name so the running
      // total — and therefore the next sheet — lands where it always would.
      alreadyCompleted: [{ id: 'old-job', name: 'Pin order', quantity: 58 }],
    });

    await completeJob(actor, admin, JOB_ID);

    expect(stockWrites()).toEqual({ 'Pin Backs': 58, Lamina: 9 });
  });

  it('ignores the completing job itself when totalling previous pins', async () => {
    shop({
      job: startedJob({ name: 'Pin run', tags: ['pins'], quantity: 58 }),
      materials: [
        { name: 'Pin Backs', quantity: 100 },
        { name: 'Lamina', quantity: 10 },
      ],
      alreadyCompleted: [{ id: JOB_ID, name: 'Pin run', quantity: 58, tags: ['pins'] }],
    });

    await completeJob(actor, admin, JOB_ID);

    expect(stockWrites()).toEqual({ 'Pin Backs': 42, Lamina: 9 });
  });
});

describe('the tag decides, not the job name', () => {
  it('deducts for a tagged job the old name match would have missed', async () => {
    // "Pinbacks" as one word failed /\bpins?\b/, so this job used to complete
    // clean and move nothing. That is the bug tags exist to close.
    shop({
      job: startedJob({ name: 'Pinbacks for Acme', tags: ['pins'], quantity: 20 }),
      materials: [
        { name: 'Pin Backs', quantity: 100 },
        { name: 'Lamina', quantity: 10 },
      ],
    });

    await completeJob(actor, admin, JOB_ID);

    expect(stockWrites()).toEqual({ 'Pin Backs': 80 });
  });

  it('deducts nothing for an untagged job whose name happens to say pins', async () => {
    shop({
      job: startedJob({ name: '100 pins (customer supplies backs)', tags: [], quantity: 100 }),
      materials: [
        { name: 'Pin Backs', quantity: 100 },
        { name: 'Lamina', quantity: 10 },
      ],
    });

    await completeJob(actor, admin, JOB_ID);

    expect(stockWrites()).toEqual({});
    expect(jobPatch()).toMatchObject({ status: 'completed' });
  });

  it('still deducts for a legacy job that has no tags field at all', async () => {
    shop({
      job: startedJob({ name: 'Pin order', quantity: 12 }),
      materials: [
        { name: 'Pin Backs', quantity: 100 },
        { name: 'Lamina', quantity: 10 },
      ],
    });

    await completeJob(actor, admin, JOB_ID);

    expect(stockWrites()).toEqual({ 'Pin Backs': 88 });
  });

  it('ignores a tag written by a client this app does not know about', async () => {
    shop({
      job: startedJob({ name: 'Sublimated mugs', tags: ['sublimation'], quantity: 10 }),
      materials: [{ name: 'Pin Backs', quantity: 100 }],
    });

    await completeJob(actor, admin, JOB_ID);

    expect(stockWrites()).toEqual({});
  });
});

describe('a completion that cannot pay for its materials changes nothing', () => {
  it('refuses when the material is not in inventory, naming it', async () => {
    shop({
      job: startedJob({ name: 'Pin run', tags: ['pins'], quantity: 12 }),
      materials: [{ name: 'Lamina', quantity: 10 }],
    });

    await expect(completeJob(actor, admin, JOB_ID)).rejects.toThrow(
      'No “Pin Backs” material found in inventory.',
    );
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('refuses when stock is short, and reports what it needed', async () => {
    shop({
      job: startedJob({ name: 'Pin run', tags: ['pins'], quantity: 12 }),
      materials: [
        { name: 'Pin Backs', quantity: 5 },
        { name: 'Lamina', quantity: 10 },
      ],
    });

    await expect(completeJob(actor, admin, JOB_ID)).rejects.toThrow(
      'Not enough Pin Backs in stock (need 12, have 5).',
    );
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it('spends no Pin Backs when the Lamina the same job needs is missing', async () => {
    // Every material is checked before any is written, so a job cannot be left
    // having paid for one material and failed on the next.
    shop({
      job: startedJob({ name: 'Pin run', tags: ['pins'], quantity: 58 }),
      materials: [{ name: 'Pin Backs', quantity: 100 }],
    });

    await expect(completeJob(actor, admin, JOB_ID)).rejects.toThrow(
      'No “Lamina” material found in inventory.',
    );
    expect(firestore.transactionUpdate).not.toHaveBeenCalled();
  });
});

describe('tags are stored explicitly', () => {
  it('writes a tags array on create, so nothing falls back to the name', async () => {
    await addJob(actor, admin, {
      name: 'Pin order',
      customer: 'Receiver',
      quantity: 12,
      dueDate: new Date('2030-01-02T23:59:59.000Z'),
      category: 'manufacturing',
      sectionNames: ['Design'],
    });

    expect(firestore.setDoc.mock.calls.at(-1)?.[1]).toMatchObject({ tags: [] });
  });

  it('stores the tags it is given, dropping unknown ones', async () => {
    await addJob(actor, admin, {
      name: 'Pinbacks for Acme',
      customer: 'Receiver',
      quantity: 12,
      dueDate: new Date('2030-01-02T23:59:59.000Z'),
      category: 'manufacturing',
      sectionNames: ['Design'],
      tags: ['pins', 'sublimation' as JobTag],
    });

    expect(firestore.setDoc.mock.calls.at(-1)?.[1]).toMatchObject({ tags: ['pins'] });
  });

  it('lets an edit turn a deduction on or off', async () => {
    await editJob(actor, admin, JOB_ID, { tags: ['pins'] });
    expect(firestore.updateDoc.mock.calls.at(-1)?.[1]).toMatchObject({ tags: ['pins'] });

    await editJob(actor, admin, JOB_ID, { tags: [] });
    expect(firestore.updateDoc.mock.calls.at(-1)?.[1]).toMatchObject({ tags: [] });
  });

  it('leaves tags alone when an edit does not mention them', async () => {
    await editJob(actor, admin, JOB_ID, { customer: 'Someone else' });
    expect(firestore.updateDoc.mock.calls.at(-1)?.[1]).not.toHaveProperty('tags');
  });
});
