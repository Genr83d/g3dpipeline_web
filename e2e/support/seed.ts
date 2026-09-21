/** The deterministic world every test starts from.
 *
 *  Seeded records are named with fixed, recognisable strings so assertions can
 *  target one record instead of counting rows — which is what lets the suite
 *  run in parallel while other tests are creating and deleting their own data.
 *
 *  Tests that create records must name them with `uniqueName()` and clean up
 *  after themselves; nothing here is safe to mutate casually. */
import {
  addDocument,
  clearAuthUsers,
  clearFirestore,
  createAuthUser,
  setDocument,
  type FirestoreValue,
} from './emulator';

export const PASSWORD = 'e2e-Passw0rd!';

export type SeedRole = 'admin' | 'manager' | 'staff' | 'awf';

export const ACCOUNTS = {
  admin: { email: 'admin@e2e.test', name: 'Ada Admin', role: 'admin' },
  manager: { email: 'manager@e2e.test', name: 'Morgan Manager', role: 'manager' },
  staff: { email: 'staff@e2e.test', name: 'Sam Staff', role: 'staff' },
  staffTwo: { email: 'staff2@e2e.test', name: 'Sasha Second', role: 'staff' },
  awf: { email: 'awf@e2e.test', name: 'Avery Awf', role: 'awf' },
  pending: { email: 'pending@e2e.test', name: 'Pat Pending', role: 'staff' },
  disabled: { email: 'disabled@e2e.test', name: 'Dana Disabled', role: 'staff' },
} as const;

export type AccountKey = keyof typeof ACCOUNTS;

/** Fixed names the assertions key off. Changing one means updating its tests. */
export const SEEDED = {
  pendingJob: 'Seed Bracket Batch',
  startedRepairJob: 'Seed Actuator Repair',
  /** A second repair job so the journey suite and the section-permission
   *  suite never move progress on the same record at the same time. */
  starterRepairJob: 'Seed Starter Repair',
  overdueJob: 'Seed Overdue Frame',
  completedJob: 'Seed Shipped Panels',
  /** Completed a month after its deadline: the archive files a job by the
   *  month it shipped, never by the month it was due. */
  completedSeptember2023Job: 'Seed Autumn Plaques',
  /** The same calendar month as the job above, a year later — the pair the
   *  archive's month filter has to keep apart. */
  completedSeptember2024Job: 'Seed Harvest Signage',
  /** Completed with no completedAt at all, the way records written before the
   *  field existed still read. It belongs to the archive's "Unknown month". */
  completedUndatedJob: 'Seed Undated Fixtures',
  awfJob: 'Seed AWF Trays',
  healthyMaterial: 'Seed Aluminium Sheet',
  lowMaterial: 'Seed Pin Backs',
  machine: 'Seed CNC Router',
} as const;

/** Deadlines are pinned far from "now" so a seeded job's overdue state never
 *  depends on the day the suite runs. */
const FUTURE = new Date('2099-06-15T23:59:59.000Z');
const PAST = new Date('2020-03-04T23:59:59.000Z');
const CREATED = new Date('2024-01-02T09:00:00.000Z');

/** Midday UTC, mid-month: the local calendar month these land in is the same
 *  one in every timezone the suite could run in, so the archive's month filter
 *  has fixed buckets ("2023-09" and "2024-01") to assert against. */
const SHIPPED_SEPTEMBER_2023 = new Date('2023-09-15T12:00:00.000Z');
const SHIPPED_SEPTEMBER_2024 = new Date('2024-09-15T12:00:00.000Z');
const DUE_AUGUST_2023 = new Date('2023-08-20T12:00:00.000Z');

export interface SeededUser {
  uid: string;
  email: string;
  name: string;
  role: string;
}

export type SeededUsers = Record<AccountKey, SeededUser>;

function section(name: string, progress: number, collaboratorUid?: string) {
  const value: Record<string, FirestoreValue> = { name, progress };
  if (collaboratorUid) value.collaboratorUid = collaboratorUid;
  return value;
}

function collaborator(user: SeededUser) {
  return { uid: user.uid, name: user.name, role: user.role };
}

function jobDefaults(creator: SeededUser) {
  return {
    completedQuantity: 0,
    isAwf: false,
    createdByUid: creator.uid,
    createdByName: creator.name,
    createdByEmail: creator.email,
    assignedToUid: '',
    assignedToName: '',
    assignedToRole: '',
    collaborators: [] as FirestoreValue[],
    collaboratorUids: [] as FirestoreValue[],
    createdAt: CREATED,
    updatedAt: CREATED,
    updatedByUid: creator.uid,
    updatedByName: creator.name,
  };
}

async function seedUsers(): Promise<SeededUsers> {
  const entries = await Promise.all(
    (Object.keys(ACCOUNTS) as AccountKey[]).map(async (key) => {
      const account = ACCOUNTS[key];
      const created = await createAuthUser(account.email, PASSWORD, account.name);
      const user: SeededUser = {
        uid: created.uid,
        email: account.email,
        name: account.name,
        role: account.role,
      };
      const status =
        key === 'pending' ? 'pending' : key === 'disabled' ? 'disabled' : 'active';
      await setDocument(`users/${created.uid}`, {
        uid: created.uid,
        name: account.name,
        email: account.email,
        role: account.role,
        status,
        createdAt: CREATED,
        updatedAt: CREATED,
      });
      return [key, user] as const;
    }),
  );
  return Object.fromEntries(entries) as SeededUsers;
}

async function seedJobs(users: SeededUsers): Promise<void> {
  const { manager, staff, staffTwo, awf } = users;

  await addDocument('jobs', {
    ...jobDefaults(manager),
    orderNumber: 'G3D-SEEDPEND',
    name: SEEDED.pendingJob,
    customer: 'Seed Customer',
    quantity: 12,
    dueDate: FUTURE,
    status: 'pending',
    category: 'manufacturing',
    repairProcesses: [section('Design', 0), section('Routing', 0), section('Finishing', 0)],
  });

  // Started, with two collaborators and sections split between them — the
  // fixture behind the section-progress permission tests.
  await addDocument('jobs', {
    ...jobDefaults(manager),
    orderNumber: 'G3D-SEEDREPR',
    name: SEEDED.startedRepairJob,
    customer: 'Seed Workshop',
    quantity: 1,
    dueDate: FUTURE,
    status: 'started',
    category: 'repair',
    repairProcesses: [
      section('Cleaning', 100, staff.uid),
      section('Welding', 50, staff.uid),
      section('Machining', 25, staffTwo.uid),
      section('Spraying', 0),
    ],
    assignedToUid: staff.uid,
    assignedToName: staff.name,
    assignedToRole: staff.role,
    collaborators: [collaborator(staff), collaborator(staffTwo)],
    collaboratorUids: [staff.uid, staffTwo.uid],
    startedAt: CREATED,
  });

  // Owned by the same two people, but only the journey suite touches it.
  await addDocument('jobs', {
    ...jobDefaults(manager),
    orderNumber: 'G3D-SEEDSTRT',
    name: SEEDED.starterRepairJob,
    customer: 'Seed Workshop',
    quantity: 1,
    dueDate: FUTURE,
    status: 'started',
    category: 'repair',
    repairProcesses: [
      section('Inspection', 0, staff.uid),
      section('Refit', 20, staffTwo.uid),
    ],
    assignedToUid: staff.uid,
    assignedToName: staff.name,
    assignedToRole: staff.role,
    collaborators: [collaborator(staff), collaborator(staffTwo)],
    collaboratorUids: [staff.uid, staffTwo.uid],
    startedAt: CREATED,
  });

  await addDocument('jobs', {
    ...jobDefaults(manager),
    orderNumber: 'G3D-SEEDOVER',
    name: SEEDED.overdueJob,
    customer: 'Seed Customer',
    quantity: 4,
    dueDate: PAST,
    status: 'pending',
    category: 'design',
    repairProcesses: [section('Concept', 0), section('Render', 0)],
  });

  await addDocument('jobs', {
    ...jobDefaults(manager),
    orderNumber: 'G3D-SEEDDONE',
    name: SEEDED.completedJob,
    customer: 'Seed Customer',
    quantity: 6,
    completedQuantity: 6,
    dueDate: FUTURE,
    status: 'completed',
    category: 'manufacturing',
    repairProcesses: [section('Print', 100, staff.uid), section('Pack', 100, staff.uid)],
    assignedToUid: staff.uid,
    assignedToName: staff.name,
    assignedToRole: staff.role,
    collaborators: [collaborator(staff)],
    collaboratorUids: [staff.uid],
    startedAt: CREATED,
    completedAt: CREATED,
    completedByUid: staff.uid,
    completedByName: staff.name,
  });

  // Due in August, shipped in September — the fixture that proves the archive
  // files a job by its completion month rather than its deadline.
  await addDocument('jobs', {
    ...jobDefaults(manager),
    orderNumber: 'G3D-SEEDAUTM',
    name: SEEDED.completedSeptember2023Job,
    customer: 'Seed Heritage Trust',
    quantity: 2,
    completedQuantity: 2,
    dueDate: DUE_AUGUST_2023,
    status: 'completed',
    category: 'manufacturing',
    repairProcesses: [section('Cast', 100, staff.uid), section('Engrave', 100, staff.uid)],
    assignedToUid: staff.uid,
    assignedToName: staff.name,
    assignedToRole: staff.role,
    collaborators: [collaborator(staff)],
    collaboratorUids: [staff.uid],
    startedAt: DUE_AUGUST_2023,
    completedAt: SHIPPED_SEPTEMBER_2023,
    completedByUid: staff.uid,
    completedByName: staff.name,
  });

  // September again, one year on. Two Septembers are what prove the filter
  // qualifies a month by its year.
  await addDocument('jobs', {
    ...jobDefaults(manager),
    orderNumber: 'G3D-SEEDHARV',
    name: SEEDED.completedSeptember2024Job,
    customer: 'Seed Heritage Trust',
    quantity: 3,
    completedQuantity: 3,
    dueDate: SHIPPED_SEPTEMBER_2024,
    status: 'completed',
    category: 'design',
    repairProcesses: [section('Concept', 100, staff.uid), section('Print', 100, staff.uid)],
    assignedToUid: staff.uid,
    assignedToName: staff.name,
    assignedToRole: staff.role,
    collaborators: [collaborator(staff)],
    collaboratorUids: [staff.uid],
    startedAt: CREATED,
    completedAt: SHIPPED_SEPTEMBER_2024,
    completedByUid: staff.uid,
    completedByName: staff.name,
  });

  // Completed, but with no completedAt written at all: the archive still has
  // to reach it, under "Unknown month".
  await addDocument('jobs', {
    ...jobDefaults(manager),
    orderNumber: 'G3D-SEEDNODT',
    name: SEEDED.completedUndatedJob,
    customer: 'Seed Customer',
    quantity: 5,
    completedQuantity: 5,
    dueDate: PAST,
    status: 'completed',
    category: 'miscellaneous',
    repairProcesses: [section('Fit', 100, staff.uid)],
    assignedToUid: staff.uid,
    assignedToName: staff.name,
    assignedToRole: staff.role,
    collaborators: [collaborator(staff)],
    collaboratorUids: [staff.uid],
    startedAt: CREATED,
    completedByUid: staff.uid,
    completedByName: staff.name,
  });

  await addDocument('jobs', {
    ...jobDefaults(manager),
    orderNumber: 'G3D-SEEDAWFJ',
    name: SEEDED.awfJob,
    customer: 'Seed AWF Client',
    quantity: 3,
    dueDate: FUTURE,
    status: 'pending',
    category: 'manufacturing',
    repairProcesses: [section('Assembly', 0, awf.uid)],
    isAwf: true,
    assignedToUid: awf.uid,
    assignedToName: awf.name,
    assignedToRole: awf.role,
    collaborators: [collaborator(awf)],
    collaboratorUids: [awf.uid],
  });
}

async function seedInventory(users: SeededUsers): Promise<void> {
  const stamp = {
    createdAt: CREATED,
    createdByUid: users.manager.uid,
    createdByName: users.manager.name,
    updatedAt: CREATED,
    updatedByUid: users.manager.uid,
    updatedByName: users.manager.name,
  };
  await addDocument('inventory', {
    ...stamp,
    name: SEEDED.healthyMaterial,
    unit: 'sheets',
    quantity: 80,
    totalQuantity: 100,
  });
  // 10% of full stock — below the 30% low-stock threshold.
  await addDocument('inventory', {
    ...stamp,
    name: SEEDED.lowMaterial,
    unit: 'pieces',
    quantity: 50,
    totalQuantity: 500,
  });
}

async function seedMachines(users: SeededUsers): Promise<void> {
  await addDocument('machines', {
    name: SEEDED.machine,
    location: 'Seed Bay 1',
    notes: 'Seeded machine used by the E2E suite.',
    procedures: [
      { id: 'seed-proc-1', title: 'Grease rails', isDone: false },
      { id: 'seed-proc-2', title: 'Check spindle', isDone: false },
    ],
    maintenanceHistory: [],
    createdAt: CREATED,
    createdByUid: users.manager.uid,
    createdByName: users.manager.name,
    updatedAt: CREATED,
    updatedByUid: users.manager.uid,
    updatedByName: users.manager.name,
  });
}

/** Wipes both emulators and rebuilds the fixture world. Runs once, in
 *  global setup, before any worker starts. */
export async function seedEmulators(): Promise<SeededUsers> {
  await Promise.all([clearFirestore(), clearAuthUsers()]);
  const users = await seedUsers();
  await Promise.all([seedJobs(users), seedInventory(users), seedMachines(users)]);
  return users;
}

let counter = 0;

/** Collision-proof across parallel workers and repeated runs. */
export function uniqueName(prefix: string): string {
  counter += 1;
  const worker = process.env.TEST_WORKER_INDEX ?? '0';
  return `${prefix} ${Date.now().toString(36)}-${worker}-${counter}`;
}
