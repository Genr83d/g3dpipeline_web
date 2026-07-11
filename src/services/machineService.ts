import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  toDate,
  type Machine,
  type MaintenanceHistoryRecord,
  type MaintenanceProcedure,
} from '../types';
import { actorDisplayName, type Actor } from './jobService';

export const machinesCol = collection(db, 'machines');

function parseProcedure(value: unknown, index: number): MaintenanceProcedure {
  const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id:
      typeof data.id === 'string' && data.id.trim().length > 0
        ? data.id
        : `procedure-${index}`,
    title: typeof data.title === 'string' ? data.title : '',
    isDone: data.isDone === true,
  };
}

function parseProcedures(value: unknown): MaintenanceProcedure[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseProcedure).filter((p) => p.title.trim().length > 0);
}

function parseHistoryRecord(value: unknown): MaintenanceHistoryRecord {
  const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    completedAt: toDate(data.completedAt),
    procedureTitles: Array.isArray(data.procedureTitles)
      ? data.procedureTitles.filter((title): title is string => typeof title === 'string')
      : [],
    completedByName: typeof data.completedByName === 'string' ? data.completedByName : '',
    notes: typeof data.notes === 'string' ? data.notes : '',
  };
}

function parseMaintenanceHistory(value: unknown): MaintenanceHistoryRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseHistoryRecord)
    .filter((record) => record.procedureTitles.length > 0)
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
}

export function parseMachine(id: string, data: Record<string, unknown>): Machine {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    location: typeof data.location === 'string' ? data.location : '',
    notes: typeof data.notes === 'string' ? data.notes : '',
    procedures: parseProcedures(data.procedures),
    maintenanceHistory: parseMaintenanceHistory(data.maintenanceHistory),
    createdAt: toDate(data.createdAt),
    createdByUid: (data.createdByUid as string) ?? '',
    createdByName: (data.createdByName as string) ?? '',
    updatedAt: toDate(data.updatedAt),
    updatedByUid: (data.updatedByUid as string) ?? '',
    updatedByName: (data.updatedByName as string) ?? '',
  };
}

export function watchMachines(
  onMachines: (machines: Machine[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(machinesCol, orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snap) => onMachines(snap.docs.map((d) => parseMachine(d.id, d.data()))),
    onError,
  );
}

export interface MachineInput {
  name: string;
  location: string;
  notes: string;
}

function audit(actor: Actor) {
  return {
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: actorDisplayName(actor),
  };
}

export async function addMachine(actor: Actor, input: MachineInput): Promise<void> {
  const byName = actorDisplayName(actor);
  await addDoc(machinesCol, {
    ...input,
    procedures: [],
    maintenanceHistory: [],
    createdAt: serverTimestamp(),
    createdByUid: actor.uid,
    createdByName: byName,
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByName: byName,
  });
}

export async function editMachine(
  actor: Actor,
  machineId: string,
  input: MachineInput,
): Promise<void> {
  await updateDoc(doc(db, 'machines', machineId), {
    ...input,
    ...audit(actor),
  });
}

export async function deleteMachine(machineId: string): Promise<void> {
  await deleteDoc(doc(db, 'machines', machineId));
}

function createProcedureId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `procedure-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function updateProcedures(
  actor: Actor,
  machineId: string,
  getNext: (machine: Machine) => MaintenanceProcedure[],
): Promise<void> {
  const ref = doc(db, 'machines', machineId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This machine no longer exists.');
    const machine = parseMachine(snap.id, snap.data());
    tx.update(ref, {
      procedures: getNext(machine),
      ...audit(actor),
    });
  });
}

export async function addProcedure(
  actor: Actor,
  machineId: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Procedure title is required.');
  await updateProcedures(actor, machineId, (machine) => [
    ...machine.procedures,
    { id: createProcedureId(), title: trimmed, isDone: false },
  ]);
}

export async function removeProcedure(
  actor: Actor,
  machineId: string,
  procedureId: string,
): Promise<void> {
  await updateProcedures(actor, machineId, (machine) =>
    machine.procedures.filter((procedure) => procedure.id !== procedureId),
  );
}

export async function setProcedureDone(
  actor: Actor,
  machineId: string,
  procedureId: string,
  isDone: boolean,
): Promise<void> {
  await updateProcedures(actor, machineId, (machine) =>
    machine.procedures.map((procedure) =>
      procedure.id === procedureId ? { ...procedure, isDone } : procedure,
    ),
  );
}

export async function logCheckedMaintenance(
  actor: Actor,
  machineId: string,
  notes = '',
): Promise<string[]> {
  const ref = doc(db, 'machines', machineId);
  const byName = actorDisplayName(actor);
  const trimmedNotes = notes.trim();
  let completedTitles: string[] = [];

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This machine no longer exists.');
    const machine = parseMachine(snap.id, snap.data());
    completedTitles = machine.procedures
      .filter((procedure) => procedure.isDone)
      .map((procedure) => procedure.title);

    if (completedTitles.length === 0) {
      throw new Error('Check at least one procedure before logging maintenance.');
    }

    const resetProcedures = machine.procedures.map((procedure) => ({
      ...procedure,
      isDone: false,
    }));
    const previousHistory = machine.maintenanceHistory.map((record) => ({
      completedAt: record.completedAt,
      procedureTitles: record.procedureTitles,
      completedByName: record.completedByName,
      notes: record.notes,
    }));

    tx.update(ref, {
      procedures: resetProcedures,
      maintenanceHistory: [
        {
          completedAt: Timestamp.now(),
          procedureTitles: completedTitles,
          completedByName: byName,
          notes: trimmedNotes,
        },
        ...previousHistory,
      ],
      ...audit(actor),
    });
  });

  return completedTitles;
}

export function filterMachines(machines: Machine[], search: string): Machine[] {
  const term = search.trim().toLowerCase();
  if (!term) return machines;
  return machines.filter((machine) => {
    const haystack = [
      machine.name,
      machine.location,
      ...machine.procedures.map((procedure) => procedure.title),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}
