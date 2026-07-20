import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  runTransaction,
  serverTimestamp,
  deleteField,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  canAssignRole,
  canSelfStartUnassigned,
  isManagerOrAdminRole,
} from '../lib/roles';
import {
  collaboratorsRequireAwf,
  resolveNewJobIsAwf,
} from '../lib/jobPermissions';
import {
  normalizeJobQuantity,
  parseJobCategory,
  validateJobQuantity,
} from '../lib/jobCategories';
import { inventoryCol } from './inventoryService';
import { isSameCalendarDate } from '../lib/format';
import {
  parseAssignedRole,
  parseJobStatus,
  parseUserRole,
  toDate,
  type Job,
  type JobCategory,
  type JobCollaborator,
  type UserRole,
} from '../types';

export interface Actor {
  uid: string;
  firstName: string;
  displayName?: string;
  email: string;
}

export function actorDisplayName(actor: Actor): string {
  return actor.displayName?.trim() || actor.firstName || actor.email || 'User';
}

/** Caller identity as stored in their live /users doc — rules verify these exactly. */
export interface Assigner {
  uid: string;
  name: string;
  role: UserRole;
}

/** Assignment target, snapshotted from the picked /users doc. */
export interface AssignTarget {
  uid: string;
  name: string;
  role: UserRole;
}

const jobsCol = collection(db, 'jobs');

function parseCollaboratorRole(value: unknown): UserRole {
  return parseUserRole(value);
}

function parseCollaborators(data: Record<string, unknown>): JobCollaborator[] {
  const collaborators = Array.isArray(data.collaborators)
    ? data.collaborators
        .map((value) => {
          const c = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
          return {
            uid: typeof c.uid === 'string' ? c.uid : '',
            name: typeof c.name === 'string' ? c.name : '',
            role: parseCollaboratorRole(c.role),
          };
        })
        .filter((c) => c.uid.trim().length > 0)
    : [];

  if (collaborators.length > 0) return dedupeCollaborators(collaborators);

  const legacyUid = typeof data.assignedToUid === 'string' ? data.assignedToUid : '';
  if (!legacyUid) return [];
  return [
    {
      uid: legacyUid,
      name: typeof data.assignedToName === 'string' ? data.assignedToName : '',
      role: parseCollaboratorRole(data.assignedToRole),
    },
  ];
}

function parseCollaboratorUids(
  data: Record<string, unknown>,
  collaborators: JobCollaborator[],
): string[] {
  const uids = Array.isArray(data.collaboratorUids)
    ? data.collaboratorUids.filter((uid): uid is string => typeof uid === 'string' && uid.trim().length > 0)
    : [];
  return uids.length > 0 ? Array.from(new Set(uids)) : collaborators.map((c) => c.uid);
}

export function dedupeCollaborators(collaborators: readonly AssignTarget[]): JobCollaborator[] {
  const seen = new Set<string>();
  const unique: JobCollaborator[] = [];
  for (const collaborator of collaborators) {
    const uid = collaborator.uid.trim();
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    unique.push({
      uid,
      name: collaborator.name.trim() || 'User',
      role: collaborator.role,
    });
  }
  return unique;
}

export function parseJob(id: string, data: Record<string, unknown>): Job {
  const collaborators = parseCollaborators(data);
  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    customer: typeof data.customer === 'string' ? data.customer : '',
    quantity: typeof data.quantity === 'number' ? data.quantity : 0,
    dueDate: toDate(data.dueDate) ?? new Date(),
    status: parseJobStatus(data.status),
    category: parseJobCategory(data.category),
    isAwf: data.isAwf === true,
    createdByUid: (data.createdByUid as string) ?? '',
    createdByName: (data.createdByName as string) ?? '',
    createdByEmail: (data.createdByEmail as string) ?? '',
    assignedToUid: (data.assignedToUid as string) ?? '',
    assignedToName: (data.assignedToName as string) ?? '',
    assignedToRole: parseAssignedRole(data.assignedToRole),
    assignedByUid: (data.assignedByUid as string) ?? '',
    assignedByName: (data.assignedByName as string) ?? '',
    assignedAt: toDate(data.assignedAt),
    collaborators,
    collaboratorUids: parseCollaboratorUids(data, collaborators),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    startedAt: toDate(data.startedAt),
    completedAt: toDate(data.completedAt),
    completedByUid: (data.completedByUid as string) ?? '',
    completedByName: (data.completedByName as string) ?? '',
    updatedByUid: (data.updatedByUid as string) ?? '',
    updatedByName: (data.updatedByName as string) ?? '',
    dueDateChangeNote: typeof data.dueDateChangeNote === 'string' ? data.dueDateChangeNote : '',
    previousDueDate: toDate(data.previousDueDate),
    dueDateChangedAt: toDate(data.dueDateChangedAt),
    dueDateChangedByUid: (data.dueDateChangedByUid as string) ?? '',
    dueDateChangedByName: (data.dueDateChangedByName as string) ?? '',
  };
}

export function jobsQueryForRole(role: UserRole) {
  return role === 'awf'
    ? query(jobsCol, where('isAwf', '==', true), orderBy('dueDate', 'asc'))
    : query(jobsCol, orderBy('dueDate', 'asc'));
}

export function watchJobs(
  role: UserRole,
  onJobs: (jobs: Job[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    jobsQueryForRole(role),
    (snap) => onJobs(snap.docs.map((d) => parseJob(d.id, d.data()))),
    onError,
  );
}

export interface JobInput {
  name: string;
  customer: string;
  quantity: number;
  dueDate: Date;
  category: JobCategory;
  isAwf?: boolean;
}

/** Service-layer guard mirroring the client form: quantity must satisfy the
 *  category's centralized config even for manually crafted requests. */
function assertValidJobQuantity(category: JobCategory, quantity: number): number {
  const normalized = normalizeJobQuantity(category, quantity);
  const error = validateJobQuantity(category, normalized);
  if (error) throw new Error(error);
  return normalized;
}

/** All active roles may create jobs. AWF creators are always classified AWF;
 *  only manager/admin requests may opt another new job into that pipeline. */
export async function addJob(
  actor: Actor,
  self: Assigner,
  input: JobInput,
): Promise<void> {
  const byName = actorDisplayName(actor);
  await addDoc(jobsCol, {
    name: input.name,
    customer: input.customer,
    quantity: assertValidJobQuantity(input.category, input.quantity),
    dueDate: Timestamp.fromDate(input.dueDate),
    status: 'pending',
    category: input.category,
    isAwf: resolveNewJobIsAwf(self.role, input.isAwf),
    createdByUid: actor.uid,
    createdByName: byName,
    createdByEmail: actor.email,
    assignedToUid: '',
    assignedToName: '',
    assignedToRole: '',
    collaborators: [],
    collaboratorUids: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: byName,
  });
}

/** Transactional claim — fails if someone else grabbed the job first.
 *  An unassigned job is atomically self-assigned; a job already assigned
 *  to the caller starts without touching its assignment audit trail. */
export async function startJob(actor: Actor, self: Assigner, jobId: string): Promise<void> {
  const ref = doc(db, 'jobs', jobId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This job no longer exists.');
    const data = snap.data();
    if (parseJobStatus(data.status) !== 'pending') {
      throw new Error('Someone else already started this job.');
    }
    const collaborators = parseCollaborators(data);
    const collaboratorUids = parseCollaboratorUids(data, collaborators);
    const hasCollaborators = collaboratorUids.length > 0;
    if (hasCollaborators && !collaboratorUids.includes(actor.uid)) {
      throw new Error('This job is assigned to someone else.');
    }
    if (!hasCollaborators && !canSelfStartUnassigned(self.role)) {
      throw new Error('Managers must assign Staff or AWF Staff before starting this job.');
    }
    const byName = actorDisplayName(actor);
    const patch: Record<string, unknown> = {
      status: 'started',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedByUid: actor.uid,
      updatedByName: byName,
    };
    if (!hasCollaborators) {
      const selfCollaborator = { uid: self.uid, name: self.name, role: self.role };
      patch.assignedToUid = self.uid;
      patch.assignedToName = self.name;
      patch.assignedToRole = self.role;
      patch.collaborators = [selfCollaborator];
      patch.collaboratorUids = [self.uid];
      patch.assignedByUid = actor.uid;
      patch.assignedByName = byName;
      patch.assignedAt = serverTimestamp();
      if (self.role === 'awf') patch.isAwf = true;
    }
    tx.update(ref, patch);
  });
}

/** Manager/admin: assign one or more collaborators to a pending/in-progress
 *  job. Saving any AWF collaborator permanently promotes the job to AWF. */
export async function assignJob(
  actor: Actor,
  self: Assigner,
  jobId: string,
  targets: AssignTarget[],
): Promise<void> {
  if (!isManagerOrAdminRole(self.role)) {
    throw new Error('Only managers and admins can change collaborators.');
  }
  const collaborators = dedupeCollaborators(targets);
  if (collaborators.length === 0) throw new Error('Add at least one collaborator.');
  if (collaborators.some((collaborator) => !canAssignRole(self.role, collaborator.role))) {
    throw new Error('Your role cannot assign one or more selected collaborators.');
  }
  const [primary] = collaborators;
  const byName = actorDisplayName(actor);
  const patch: Record<string, unknown> = {
    assignedToUid: primary.uid,
    assignedToName: primary.name,
    assignedToRole: primary.role,
    collaborators,
    collaboratorUids: collaborators.map((c) => c.uid),
    assignedByUid: actor.uid,
    assignedByName: byName,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: byName,
  };
  if (collaboratorsRequireAwf(collaborators)) patch.isAwf = true;
  await updateDoc(doc(db, 'jobs', jobId), patch);
}

/** Manager/admin: clear assignment/collaborators. Rules remain the source of truth. */
export async function unassignJob(actor: Actor, jobId: string): Promise<void> {
  const byName = actorDisplayName(actor);
  await updateDoc(doc(db, 'jobs', jobId), {
    assignedToUid: '',
    assignedToName: '',
    assignedToRole: '',
    collaborators: [],
    collaboratorUids: [],
    assignedByUid: deleteField(),
    assignedByName: deleteField(),
    assignedAt: deleteField(),
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: byName,
  });
}

/** Standalone `pin`/`pins` only — never `pineapple`, `pinstripe`, `spins`, or `flippin`. */
export function isPinJob(name: string): boolean {
  return /\bpins?\b/i.test(name);
}

/** Whole Lamina sheets consumed when a completed pin batch pushes the running
 *  total across 50-pin boundaries: 58 pins → 1 Lamina, a later 42 → 1 more. */
export function laminaConsumed(previousCompletedPins: number, quantity: number): number {
  return Math.floor((previousCompletedPins + quantity) / 50) - Math.floor(previousCompletedPins / 50);
}

const PIN_BACKS = 'pin backs';
const LAMINA = 'lamina';

function normalizedName(data: Record<string, unknown>): string {
  return typeof data.name === 'string' ? data.name.trim().toLowerCase() : '';
}

/** Marks the job completed; for pin jobs this runs a Firestore transaction that
 *  also deducts Pin Backs per pin and Lamina per 50-pin boundary crossed.
 *
 *  Queries (completed pin totals, inventory doc lookup by name) run before the
 *  transaction because the web SDK can't query inside one; the transaction
 *  re-reads the job and inventory docs, so a lost race surfaces as a retry or
 *  a clean error rather than a double deduction on this job. */
export async function completeJob(actor: Actor, self: Assigner, jobId: string): Promise<void> {
  const jobRef = doc(db, 'jobs', jobId);
  const byName = actorDisplayName(actor);
  const completionPatch = {
    status: 'completed',
    completedAt: serverTimestamp(),
    completedByUid: actor.uid,
    completedByName: byName,
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: byName,
  };

  const [completedSnap, inventorySnap] = await Promise.all([
    getDocs(query(jobsCol, where('status', '==', 'completed'))),
    getDocs(inventoryCol),
  ]);

  const previousCompletedPins = completedSnap.docs
    .filter((d) => d.id !== jobId && isPinJob((d.data().name as string) ?? ''))
    .reduce((sum, d) => sum + (typeof d.data().quantity === 'number' ? (d.data().quantity as number) : 0), 0);

  const pinBacksRef = inventorySnap.docs.find((d) => normalizedName(d.data()) === PIN_BACKS)?.ref;
  const laminaRef = inventorySnap.docs.find((d) => normalizedName(d.data()) === LAMINA)?.ref;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists()) throw new Error('This job no longer exists.');
    const data = snap.data();
    if (parseJobStatus(data.status) !== 'started') {
      throw new Error('Only started jobs can be completed.');
    }
    const collaborators = parseCollaborators(data);
    const collaboratorUids = parseCollaboratorUids(data, collaborators);
    const canComplete =
      collaboratorUids.includes(actor.uid) || self.role === 'manager' || self.role === 'admin';
    if (!canComplete) {
      throw new Error('Only a collaborator, manager, or admin can complete this job.');
    }

    const name = (data.name as string) ?? '';
    const quantity = typeof data.quantity === 'number' ? data.quantity : 0;

    if (isPinJob(name) && quantity > 0) {
      if (!pinBacksRef) throw new Error('No “Pin Backs” material found in inventory.');
      const laminaNeeded = laminaConsumed(previousCompletedPins, quantity);
      if (laminaNeeded > 0 && !laminaRef) {
        throw new Error('No “Lamina” material found in inventory.');
      }

      const pinBacksSnap = await tx.get(pinBacksRef);
      const pinBacksQty =
        typeof pinBacksSnap.data()?.quantity === 'number' ? (pinBacksSnap.data()!.quantity as number) : 0;
      if (pinBacksQty < quantity) {
        throw new Error(`Not enough Pin Backs in stock (need ${quantity}, have ${pinBacksQty}).`);
      }

      let laminaQty = 0;
      if (laminaNeeded > 0 && laminaRef) {
        const laminaSnap = await tx.get(laminaRef);
        laminaQty =
          typeof laminaSnap.data()?.quantity === 'number' ? (laminaSnap.data()!.quantity as number) : 0;
        if (laminaQty < laminaNeeded) {
          throw new Error(`Not enough Lamina in stock (need ${laminaNeeded}, have ${laminaQty}).`);
        }
      }

      tx.update(pinBacksRef, {
        quantity: pinBacksQty - quantity,
        updatedAt: serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByName: byName,
      });
      if (laminaNeeded > 0 && laminaRef) {
        tx.update(laminaRef, {
          quantity: laminaQty - laminaNeeded,
          updatedAt: serverTimestamp(),
          updatedByUid: actor.uid,
          updatedByName: byName,
        });
      }
    }

    tx.update(jobRef, completionPatch);
  });
}

/** Manager/admin: send a completed job back into the pipeline. This is the
 *  only supported completed → pending transition; anything else is rejected. */
export async function restoreJob(actor: Actor, jobId: string): Promise<void> {
  const byName = actorDisplayName(actor);
  const ref = doc(db, 'jobs', jobId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This job no longer exists.');
    if (parseJobStatus(snap.data().status) !== 'completed') {
      throw new Error('Only completed jobs can be restored.');
    }
    tx.update(ref, {
      status: 'pending',
      assignedToUid: '',
      assignedToName: '',
      assignedToRole: '',
      collaborators: [],
      collaboratorUids: [],
      assignedByUid: deleteField(),
      assignedByName: deleteField(),
      assignedAt: deleteField(),
      startedAt: deleteField(),
      completedAt: deleteField(),
      completedByUid: deleteField(),
      completedByName: deleteField(),
      updatedAt: serverTimestamp(),
      updatedByUid: actor.uid,
      updatedByName: byName,
    });
  });
}

export interface JobEdit {
  name?: string;
  customer?: string;
  quantity?: number;
  dueDate?: Date;
  category?: JobCategory;
  isAwf?: boolean;
  /** Required explanation captured when the due date's calendar day changes. */
  dueDateChangeNote?: string;
}

/** Manager/admin: edit core fields and, when supplied, the persistent AWF
 *  classification. Never touches createdBy* / createdAt.
 *
 *  A due-date or quantity/category edit re-reads the job in a transaction so
 *  the change is validated against the latest stored document, not stale client
 *  data. Deadlines are compared by calendar day: a genuine change must carry a
 *  non-empty reason and is persisted with a full audit trail
 *  (previousDueDate / dueDateChangedAt / dueDateChangedByUid / …); re-selecting
 *  the same day (or editing other fields) leaves that trail untouched. */
export async function editJob(
  actor: Actor,
  self: Assigner,
  jobId: string,
  edit: JobEdit,
): Promise<void> {
  if (!isManagerOrAdminRole(self.role)) {
    throw new Error('Only managers and admins can edit jobs.');
  }
  const byName = actorDisplayName(actor);
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: byName,
  };
  if (edit.name !== undefined) patch.name = edit.name;
  if (edit.customer !== undefined) patch.customer = edit.customer;
  if (edit.category !== undefined) patch.category = edit.category;
  if (edit.isAwf !== undefined) patch.isAwf = edit.isAwf;

  const editsDueDate = edit.dueDate !== undefined;
  const touchesQuantity = edit.quantity !== undefined || edit.category !== undefined;
  if (!editsDueDate && !touchesQuantity) {
    await updateDoc(doc(db, 'jobs', jobId), patch);
    return;
  }

  const ref = doc(db, 'jobs', jobId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This job no longer exists.');
    const data = snap.data();

    // Quantity/category edits validate the effective pair against the
    // centralized config. Legacy over-limit records stay readable and accept
    // non-quantity updates, but must comply once edited here.
    if (touchesQuantity) {
      const category = edit.category ?? parseJobCategory(data.category);
      const quantity =
        edit.quantity ?? (typeof data.quantity === 'number' ? data.quantity : 0);
      patch.quantity = assertValidJobQuantity(category, quantity);
    }

    // Compare against the freshly-read deadline by calendar day. dueDate (and
    // its audit trail) is only rewritten when the day genuinely changes, so a
    // same-day edit never disturbs the stored deadline or its history.
    if (editsDueDate) {
      const storedDueDate = toDate(data.dueDate);
      const dueDateChanged =
        !storedDueDate || !isSameCalendarDate(storedDueDate, edit.dueDate!);
      if (dueDateChanged) {
        const note = (edit.dueDateChangeNote ?? '').trim();
        if (!note) throw new Error('Add a reason for changing the deadline.');
        patch.dueDate = Timestamp.fromDate(edit.dueDate!);
        patch.previousDueDate = data.dueDate ?? null;
        patch.dueDateChangeNote = note;
        patch.dueDateChangedAt = serverTimestamp();
        patch.dueDateChangedByUid = actor.uid;
        patch.dueDateChangedByName = byName;
      }
    }

    tx.update(ref, patch);
  });
}

/** Admin only. */
export async function deleteJob(jobId: string): Promise<void> {
  await deleteDoc(doc(db, 'jobs', jobId));
}
