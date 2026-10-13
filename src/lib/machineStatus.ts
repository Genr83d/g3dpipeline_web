import type { Machine, UserRole } from '../types';
import { isManagerOrAdminRole } from './roles';

export interface MachineViewer {
  uid: string;
  role: UserRole;
}

/** Anyone active outside AWF can report a machine down. AWF staff have no
 *  machine access at all. */
export function canReportMachineDown(viewer: MachineViewer): boolean {
  return viewer.role !== 'awf';
}

export function canMarkMachineRepaired(viewer: MachineViewer): boolean {
  return viewer.role !== 'awf';
}

/** Only management picks who repairs a machine. The Firestore rules repeat
 *  this check and remain authoritative. */
export function canAssignMachineRepair(viewer: MachineViewer): boolean {
  return isManagerOrAdminRole(viewer.role);
}

export function isMachineDown(machine: Pick<Machine, 'status'>): boolean {
  return machine.status === 'down';
}

export function hasRepairAssignee(machine: Pick<Machine, 'repairAssignedToUid'>): boolean {
  return machine.repairAssignedToUid !== '';
}

export function isRepairAssignedTo(
  machine: Pick<Machine, 'repairAssignedToUid'>,
  uid: string,
): boolean {
  return uid !== '' && machine.repairAssignedToUid === uid;
}

/** Machines that are down come first, then by name. */
export function compareMachines(a: Machine, b: Machine): number {
  const aDown = isMachineDown(a);
  if (aDown !== isMachineDown(b)) return aDown ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/** The pill text: who is on the repair, or that nobody is yet. */
export function machineDownLabel(machine: Machine): string {
  return hasRepairAssignee(machine)
    ? `Down · ${machine.repairAssignedToName}`
    : 'Down · Unassigned';
}

/** A machine that is up and unassigned — what a document without status
 *  fields reads as. Test factories spread this under their overrides. */
export const OPERATIONAL_MACHINE_FIELDS: Pick<
  Machine,
  | 'status'
  | 'downReason'
  | 'downSince'
  | 'downReportedByName'
  | 'repairAssignedToUid'
  | 'repairAssignedToName'
  | 'repairAssignedByName'
  | 'repairAssignedAt'
  | 'lastRepairedAt'
  | 'lastRepairedByName'
  | 'downtimeHistory'
> = {
  status: 'operational',
  downReason: '',
  downSince: null,
  downReportedByName: '',
  repairAssignedToUid: '',
  repairAssignedToName: '',
  repairAssignedByName: '',
  repairAssignedAt: null,
  lastRepairedAt: null,
  lastRepairedByName: '',
  downtimeHistory: [],
};
