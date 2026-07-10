import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jobLoadErrorMessage, useJobs } from '../hooks/useJobs';
import { useInventory } from '../hooks/useInventory';
import { useMachines } from '../hooks/useMachines';
import { useUsers } from '../hooks/useUsers';
import type { AppUser, Job, Machine, Material, UserRole } from '../types';

const watcherMocks = vi.hoisted(() => ({
  watchJobs: vi.fn(),
  watchInventory: vi.fn(),
  watchMachines: vi.fn(),
  watchAllUsers: vi.fn(),
}));

vi.mock('../services/jobService', () => ({
  watchJobs: watcherMocks.watchJobs,
}));

vi.mock('../services/inventoryService', () => ({
  watchInventory: watcherMocks.watchInventory,
}));

vi.mock('../services/machineService', () => ({
  watchMachines: watcherMocks.watchMachines,
}));

vi.mock('../services/userService', () => ({
  watchAllUsers: watcherMocks.watchAllUsers,
}));

interface JobSubscription {
  role: UserRole;
  onValue: (jobs: Job[]) => void;
  onError: (error: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

interface CollectionSubscription<T> {
  onValue: (values: T[]) => void;
  onError: (error: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

let jobSubscriptions: JobSubscription[];
let inventorySubscriptions: CollectionSubscription<Material>[];
let machineSubscriptions: CollectionSubscription<Machine>[];
let userSubscriptions: CollectionSubscription<AppUser>[];

function firebaseError(code: string, message = 'Firebase raw error https://console.firebase.google.com/index'): Error {
  return Object.assign(new Error(message), { code });
}

function job(id: string): Job {
  return { id } as Job;
}

function material(id: string): Material {
  return { id } as Material;
}

function machine(id: string): Machine {
  return { id } as Machine;
}

function user(uid: string): AppUser {
  return { uid } as AppUser;
}

beforeEach(() => {
  vi.clearAllMocks();
  jobSubscriptions = [];
  inventorySubscriptions = [];
  machineSubscriptions = [];
  userSubscriptions = [];

  watcherMocks.watchJobs.mockImplementation(
    (
      role: UserRole,
      onValue: (jobs: Job[]) => void,
      onError: (error: Error) => void,
    ) => {
      const unsubscribe = vi.fn();
      jobSubscriptions.push({ role, onValue, onError, unsubscribe });
      return unsubscribe;
    },
  );

  watcherMocks.watchInventory.mockImplementation(
    (onValue: (values: Material[]) => void, onError: (error: Error) => void) => {
      const unsubscribe = vi.fn();
      inventorySubscriptions.push({ onValue, onError, unsubscribe });
      return unsubscribe;
    },
  );

  watcherMocks.watchMachines.mockImplementation(
    (onValue: (values: Machine[]) => void, onError: (error: Error) => void) => {
      const unsubscribe = vi.fn();
      machineSubscriptions.push({ onValue, onError, unsubscribe });
      return unsubscribe;
    },
  );

  watcherMocks.watchAllUsers.mockImplementation(
    (onValue: (values: AppUser[]) => void, onError: (error: Error) => void) => {
      const unsubscribe = vi.fn();
      userSubscriptions.push({ onValue, onError, unsubscribe });
      return unsubscribe;
    },
  );
});

describe('jobs listener role lifecycle', () => {
  it('unsubscribes and requeries with the exact AWF role on Manager -> AWF', () => {
    const { result, rerender } = renderHook(
      ({ role, scopeKey }: { role: UserRole; scopeKey: string }) =>
        useJobs(true, role, scopeKey),
      { initialProps: { role: 'manager', scopeKey: 'user-1:manager' } },
    );

    expect(jobSubscriptions).toHaveLength(1);
    expect(jobSubscriptions[0].role).toBe('manager');
    const managerSubscription = jobSubscriptions[0];

    act(() => managerSubscription.onValue([job('manager-job')]));
    expect(result.current.jobs.map(({ id }) => id)).toEqual(['manager-job']);

    rerender({ role: 'awf', scopeKey: 'user-1:awf' });

    expect(managerSubscription.unsubscribe).toHaveBeenCalledOnce();
    expect(jobSubscriptions).toHaveLength(2);
    expect(jobSubscriptions[1].role).toBe('awf');

    const awfSubscription = jobSubscriptions[1];
    act(() => awfSubscription.onValue([job('awf-job')]));
    expect(result.current.jobs.map(({ id }) => id)).toEqual(['awf-job']);

    act(() => {
      managerSubscription.onValue([job('late-unrestricted-job')]);
      managerSubscription.onError(firebaseError('permission-denied'));
    });

    expect(result.current.jobs.map(({ id }) => id)).toEqual(['awf-job']);
    expect(result.current.error).toBeNull();
  });

  it('unsubscribes and requeries with the exact Staff role on AWF -> Staff', () => {
    const { result, rerender } = renderHook(
      ({ role, scopeKey }: { role: UserRole; scopeKey: string }) =>
        useJobs(true, role, scopeKey),
      { initialProps: { role: 'awf', scopeKey: 'user-1:awf' } },
    );

    const awfSubscription = jobSubscriptions[0];
    expect(awfSubscription.role).toBe('awf');

    rerender({ role: 'staff', scopeKey: 'user-1:staff' });

    expect(awfSubscription.unsubscribe).toHaveBeenCalledOnce();
    expect(jobSubscriptions).toHaveLength(2);
    expect(jobSubscriptions[1].role).toBe('staff');

    const staffSubscription = jobSubscriptions[1];
    act(() => staffSubscription.onValue([job('shared-job')]));
    expect(result.current.jobs.map(({ id }) => id)).toEqual(['shared-job']);

    act(() => awfSubscription.onValue([job('late-awf-job')]));
    expect(result.current.jobs.map(({ id }) => id)).toEqual(['shared-job']);
  });

  it('retries the current role and exposes only friendly error copy', () => {
    const { result } = renderHook(() => useJobs(true, 'manager', 'user-1:manager'));
    const failedSubscription = jobSubscriptions[0];

    act(() => failedSubscription.onError(firebaseError('failed-precondition')));

    expect(result.current.error).toBe(
      'The shared job list is temporarily being prepared. Please try again shortly.',
    );
    expect(result.current.error).not.toContain('http');
    expect(result.current.error).not.toContain('Firebase');

    act(() => result.current.retry());

    expect(failedSubscription.unsubscribe).toHaveBeenCalledOnce();
    expect(jobSubscriptions).toHaveLength(2);
    expect(jobSubscriptions[1].role).toBe('manager');
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    act(() => {
      failedSubscription.onValue([job('late-after-retry')]);
      failedSubscription.onError(firebaseError('unavailable'));
    });
    expect(result.current.jobs).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('maps Firebase and unknown failures without leaking raw messages or index URLs', () => {
    const cases = [
      firebaseError('permission-denied'),
      firebaseError('firestore/unavailable'),
      firebaseError('cancelled'),
      new Error('Create this index at https://console.firebase.google.com/raw-index-url'),
    ];

    for (const error of cases) {
      const message = jobLoadErrorMessage(error);
      expect(message).not.toContain('http');
      expect(message).not.toContain('Firebase');
      expect(message).not.toContain('index');
    }
  });
});

describe('non-AWF listener lifecycle', () => {
  it('does not initialize Inventory or Maintenance for AWF and initializes both on AWF -> Staff', () => {
    const { result, rerender } = renderHook(
      ({ enabled, scopeKey }: { enabled: boolean; scopeKey: string }) => ({
        inventory: useInventory(enabled, scopeKey),
        machines: useMachines(enabled, scopeKey),
      }),
      { initialProps: { enabled: false, scopeKey: 'user-1:awf' } },
    );

    expect(watcherMocks.watchInventory).not.toHaveBeenCalled();
    expect(watcherMocks.watchMachines).not.toHaveBeenCalled();
    expect(result.current.inventory.loading).toBe(false);
    expect(result.current.machines.loading).toBe(false);

    rerender({ enabled: true, scopeKey: 'user-1:staff' });

    expect(inventorySubscriptions).toHaveLength(1);
    expect(machineSubscriptions).toHaveLength(1);

    act(() => {
      inventorySubscriptions[0].onValue([material('stock-1')]);
      machineSubscriptions[0].onValue([machine('machine-1')]);
    });

    expect(result.current.inventory.materials.map(({ id }) => id)).toEqual(['stock-1']);
    expect(result.current.machines.machines.map(({ id }) => id)).toEqual(['machine-1']);
  });

  it('unsubscribes both streams on Staff -> AWF and ignores their late callbacks', () => {
    const { result, rerender } = renderHook(
      ({ enabled, scopeKey }: { enabled: boolean; scopeKey: string }) => ({
        inventory: useInventory(enabled, scopeKey),
        machines: useMachines(enabled, scopeKey),
      }),
      { initialProps: { enabled: true, scopeKey: 'user-1:staff' } },
    );

    const inventorySubscription = inventorySubscriptions[0];
    const machineSubscription = machineSubscriptions[0];

    rerender({ enabled: false, scopeKey: 'user-1:awf' });

    expect(inventorySubscription.unsubscribe).toHaveBeenCalledOnce();
    expect(machineSubscription.unsubscribe).toHaveBeenCalledOnce();
    expect(result.current.inventory.materials).toEqual([]);
    expect(result.current.machines.machines).toEqual([]);

    act(() => {
      inventorySubscription.onValue([material('late-stock')]);
      inventorySubscription.onError(firebaseError('permission-denied'));
      machineSubscription.onValue([machine('late-machine')]);
      machineSubscription.onError(firebaseError('permission-denied'));
    });

    expect(result.current.inventory).toMatchObject({ materials: [], error: null, loading: false });
    expect(result.current.machines).toMatchObject({ machines: [], error: null, loading: false });
  });

  it('disposes the admin user list and ignores late user-list results after a role change', () => {
    const { result, rerender } = renderHook(
      ({ enabled, scopeKey }: { enabled: boolean; scopeKey: string }) =>
        useUsers(enabled, scopeKey),
      { initialProps: { enabled: true, scopeKey: 'admin-1:admin' } },
    );

    const adminSubscription = userSubscriptions[0];
    act(() => adminSubscription.onValue([user('staff-1')]));
    expect(result.current.users.map(({ uid }) => uid)).toEqual(['staff-1']);

    rerender({ enabled: false, scopeKey: 'admin-1:awf' });
    expect(adminSubscription.unsubscribe).toHaveBeenCalledOnce();

    act(() => {
      adminSubscription.onValue([user('late-user')]);
      adminSubscription.onError(firebaseError('permission-denied'));
    });

    expect(result.current).toEqual({ users: [], loading: false, error: null });
  });
});
