import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  onSnapshot: vi.fn(),
  doc: vi.fn((_db: unknown, collection: string, id: string) => ({ collection, id })),
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
}));

vi.mock('firebase/firestore', () => firestore);
vi.mock('../lib/firebase', () => ({ db: {} }));

import { watchUser } from '../services/userService';

/** Snapshot double: `fromCache` is the part that matters here. */
function snapshot(exists: boolean, fromCache: boolean, data: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    exists: () => exists,
    data: () => data,
    metadata: { fromCache, hasPendingWrites: false },
  };
}

function emit(snap: ReturnType<typeof snapshot>) {
  const next = firestore.onSnapshot.mock.calls.at(-1)?.[1] as (s: unknown) => void;
  next(snap);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('watchUser', () => {
  it('emits the parsed profile when the document exists', () => {
    const onUser = vi.fn();
    watchUser('u1', onUser, vi.fn());

    emit(snapshot(true, false, { name: 'Sam', email: 's@e.test', role: 'staff', status: 'active' }));

    expect(onUser).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'u1', name: 'Sam', role: 'staff', status: 'active' }),
    );
  });

  it('emits null when the server confirms there is no document', () => {
    const onUser = vi.fn();
    watchUser('u1', onUser, vi.fn());

    emit(snapshot(false, false));

    expect(onUser).toHaveBeenCalledWith(null);
  });

  /** Regression: an unreachable backend makes the SDK answer from an empty
   *  cache, which is indistinguishable from a deleted account. Reporting that
   *  as "no profile" told signed-in users their account was awaiting approval
   *  every time the connection dropped. */
  it('stays silent when a missing document came only from the cache', () => {
    const onUser = vi.fn();
    watchUser('u1', onUser, vi.fn());

    emit(snapshot(false, true));

    expect(onUser).not.toHaveBeenCalled();
  });

  it('still emits a cached profile that does exist', () => {
    const onUser = vi.fn();
    watchUser('u1', onUser, vi.fn());

    emit(snapshot(true, true, { name: 'Sam', email: 's@e.test', role: 'staff', status: 'active' }));

    expect(onUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sam' }));
  });
});
