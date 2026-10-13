import { userDisplayName } from '../lib/userName';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  canAssignHazard,
  canDeleteHazard,
  canEditHazard,
  canReopenHazard,
  canWorkHazard,
  compareHazards,
  parseHazard,
  validateHazardInput,
  validateResolutionNote,
  type HazardInput,
  type HazardViewer,
} from '../lib/hazards';
import type { AppUser, Hazard } from '../types';
import { actorDisplayName, type Actor } from './jobService';

/** Reads and writes `/hazards`. The Firestore rules (owned by the Flutter
 *  repository) are the authority on who may do what; the checks here give a
 *  clear message before a request would be refused. */
export const hazardsCol = collection(db, 'hazards');

export type HazardActor = Actor & HazardViewer;

export function watchHazards(
  onHazards: (hazards: Hazard[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(hazardsCol, orderBy('createdAt', 'desc')),
    (snap) => onHazards(snap.docs.map((d) => parseHazard(d.id, d.data())).sort(compareHazards)),
    onError,
  );
}

function stamp(actor: HazardActor): Record<string, unknown> {
  return {
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: actorDisplayName(actor),
  };
}

function details(input: HazardInput): Record<string, unknown> {
  const error = validateHazardInput(input);
  if (error) throw new Error(error);
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    location: input.location.trim(),
    severity: input.severity,
  };
}

export async function reportHazard(actor: HazardActor, input: HazardInput): Promise<void> {
  await addDoc(hazardsCol, {
    ...details(input),
    status: 'open',
    reportedByUid: actor.uid,
    reportedByName: actorDisplayName(actor),
    assignedToUid: '',
    assignedToName: '',
    createdAt: serverTimestamp(),
    ...stamp(actor),
  });
}

export async function updateHazardDetails(
  actor: HazardActor,
  hazard: Hazard,
  input: HazardInput,
): Promise<void> {
  if (!canEditHazard(hazard, actor)) throw new Error('You can no longer edit this report.');
  await updateDoc(doc(db, 'hazards', hazard.id), { ...details(input), ...stamp(actor) });
}

export { userDisplayName };

/** Hands the hazard to `assignee`, or clears the assignment when null. */
export async function assignHazard(
  actor: HazardActor,
  hazard: Hazard,
  assignee: AppUser | null,
): Promise<void> {
  if (!canAssignHazard(hazard, actor)) throw new Error('Only managers and admins assign hazards.');
  if (assignee && assignee.status !== 'active') {
    throw new Error('Hazards can only go to active accounts.');
  }
  await updateDoc(doc(db, 'hazards', hazard.id), {
    ...(assignee
      ? {
          assignedToUid: assignee.uid,
          assignedToName: userDisplayName(assignee),
          assignedByUid: actor.uid,
          assignedByName: actorDisplayName(actor),
          assignedAt: serverTimestamp(),
        }
      : {
          assignedToUid: '',
          assignedToName: '',
          assignedByUid: deleteField(),
          assignedByName: deleteField(),
          assignedAt: deleteField(),
        }),
    ...stamp(actor),
  });
}

export async function startHazard(actor: HazardActor, hazard: Hazard): Promise<void> {
  if (!canWorkHazard(hazard, actor) || hazard.status !== 'open') {
    throw new Error('This hazard cannot be started.');
  }
  await updateDoc(doc(db, 'hazards', hazard.id), { status: 'inProgress', ...stamp(actor) });
}

export async function resolveHazard(
  actor: HazardActor,
  hazard: Hazard,
  resolutionNote: string,
): Promise<void> {
  if (!canWorkHazard(hazard, actor)) {
    throw new Error('Only the assignee or a manager can resolve this.');
  }
  const error = validateResolutionNote(resolutionNote);
  if (error) throw new Error(error);
  await updateDoc(doc(db, 'hazards', hazard.id), {
    status: 'resolved',
    resolutionNote: resolutionNote.trim(),
    resolvedAt: serverTimestamp(),
    resolvedByUid: actor.uid,
    resolvedByName: actorDisplayName(actor),
    ...stamp(actor),
  });
}

export async function reopenHazard(actor: HazardActor, hazard: Hazard): Promise<void> {
  if (!canReopenHazard(hazard, actor)) throw new Error('Only managers and admins reopen hazards.');
  await updateDoc(doc(db, 'hazards', hazard.id), {
    status: 'open',
    resolutionNote: deleteField(),
    resolvedAt: deleteField(),
    resolvedByUid: deleteField(),
    resolvedByName: deleteField(),
    ...stamp(actor),
  });
}

export async function deleteHazard(actor: HazardActor, hazard: Hazard): Promise<void> {
  if (!canDeleteHazard(actor)) throw new Error('Only admins delete hazards.');
  await deleteDoc(doc(db, 'hazards', hazard.id));
}
