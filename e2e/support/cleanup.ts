import { deleteByName } from './emulator';

/** Records created during one test, removed as soon as it ends.
 *
 *  Deliberately per-test and exact-name: cleanup hooks run once per worker, so
 *  anything broader (an afterAll sweeping a shared name prefix) deletes records
 *  another worker is still using. */
export interface Cleanup {
  /** Register a record to delete when the current test finishes. */
  track(collection: string, name: string): void;
  /** Delete everything registered so far. Call from afterEach. */
  run(): Promise<void>;
}

export function createCleanup(): Cleanup {
  let pending: { collection: string; name: string }[] = [];
  return {
    track(collection, name) {
      pending.push({ collection, name });
    },
    async run() {
      const records = pending;
      pending = [];
      for (const record of records) {
        await deleteByName(record.collection, record.name);
      }
    },
  };
}
