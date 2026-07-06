import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  serverTimestamp,
  deleteField,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { parseAssignedRole, parseJobStatus, toDate, type Job, type UserRole } from '../types';

export interface Actor {
  uid: string;
  firstName: string;
  email: string;
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

function parseJob(id: string, data: Record<string, unknown>): Job {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    customer: typeof data.customer === 'string' ? data.customer : '',
    quantity: typeof data.quantity === 'number' ? data.quantity : 0,
    dueDate: toDate(data.dueDate) ?? new Date(),
    status: parseJobStatus(data.status),
    createdByUid: (data.createdByUid as string) ?? '',
    createdByName: (data.createdByName as string) ?? '',
    createdByEmail: (data.createdByEmail as string) ?? '',
    assignedToUid: (data.assignedToUid as string) ?? '',
    assignedToName: (data.assignedToName as string) ?? '',
    assignedToRole: parseAssignedRole(data.assignedToRole),
    assignedByUid: (data.assignedByUid as string) ?? '',
    assignedByName: (data.assignedByName as string) ?? '',
    assignedAt: toDate(data.assignedAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    startedAt: toDate(data.startedAt),
    completedAt: toDate(data.completedAt),
    updatedByUid: (data.updatedByUid as string) ?? '',
    updatedByName: (data.updatedByName as string) ?? '',
  };
}

export function watchJobs(
  onJobs: (jobs: Job[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(jobsCol, orderBy('dueDate', 'asc'));
  return onSnapshot(
    q,
    (snap) => onJobs(snap.docs.map((d) => parseJob(d.id, d.data()))),
    onError,
  );
}

export async function addJob(
  actor: Actor,
  input: { name: string; customer: string; quantity: number; dueDate: Date },
): Promise<void> {
  await addDoc(jobsCol, {
    name: input.name,
    customer: input.customer,
    quantity: input.quantity,
    dueDate: Timestamp.fromDate(input.dueDate),
    status: 'pending',
    createdByUid: actor.uid,
    createdByName: actor.firstName,
    createdByEmail: actor.email,
    assignedToUid: '',
    assignedToName: '',
    assignedToRole: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: actor.firstName,
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
    const assignedToUid = (data.assignedToUid as string) ?? '';
    if (assignedToUid && assignedToUid !== actor.uid) {
      throw new Error('This job is assigned to someone else.');
    }
    const patch: Record<string, unknown> = {
      status: 'started',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedByUid: actor.uid,
      updatedByName: actor.firstName,
    };
    if (!assignedToUid) {
      patch.assignedToUid = self.uid;
      patch.assignedToName = self.name;
      patch.assignedToRole = self.role;
      patch.assignedByUid = self.uid;
      patch.assignedByName = self.name;
      patch.assignedAt = serverTimestamp();
    }
    tx.update(ref, patch);
  });
}

/** Manager/admin: assign or reassign a pending/in-progress job.
 *  Names and roles must exactly mirror the live /users docs — rules verify them. */
export async function assignJob(
  actor: Actor,
  assigner: Assigner,
  jobId: string,
  target: AssignTarget,
): Promise<void> {
  await updateDoc(doc(db, 'jobs', jobId), {
    assignedToUid: target.uid,
    assignedToName: target.name,
    assignedToRole: target.role,
    assignedByUid: assigner.uid,
    assignedByName: assigner.name,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: actor.firstName,
  });
}

/** Manager/admin: clear a pending job's assignment. Rules reject this on started jobs. */
export async function unassignJob(actor: Actor, jobId: string): Promise<void> {
  await updateDoc(doc(db, 'jobs', jobId), {
    assignedToUid: '',
    assignedToName: '',
    assignedToRole: '',
    assignedByUid: deleteField(),
    assignedByName: deleteField(),
    assignedAt: deleteField(),
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: actor.firstName,
  });
}

export async function completeJob(actor: Actor, jobId: string): Promise<void> {
  await updateDoc(doc(db, 'jobs', jobId), {
    status: 'completed',
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: actor.firstName,
  });
}

/** Manager/admin: send a completed job back into the pipeline. */
export async function restoreJob(actor: Actor, jobId: string): Promise<void> {
  await updateDoc(doc(db, 'jobs', jobId), {
    status: 'pending',
    assignedToUid: '',
    assignedToName: '',
    assignedToRole: '',
    assignedByUid: deleteField(),
    assignedByName: deleteField(),
    assignedAt: deleteField(),
    startedAt: deleteField(),
    completedAt: deleteField(),
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: actor.firstName,
  });
}

export interface JobEdit {
  name?: string;
  customer?: string;
  quantity?: number;
  dueDate?: Date;
}

/** Manager/admin: edit core fields. Never touches createdBy* / createdAt. */
export async function editJob(actor: Actor, jobId: string, edit: JobEdit): Promise<void> {
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: actor.firstName,
  };
  if (edit.name !== undefined) patch.name = edit.name;
  if (edit.customer !== undefined) patch.customer = edit.customer;
  if (edit.quantity !== undefined) patch.quantity = edit.quantity;
  if (edit.dueDate !== undefined) patch.dueDate = Timestamp.fromDate(edit.dueDate);
  await updateDoc(doc(db, 'jobs', jobId), patch);
}

/** Admin only. */
export async function deleteJob(jobId: string): Promise<void> {
  await deleteDoc(doc(db, 'jobs', jobId));
}
