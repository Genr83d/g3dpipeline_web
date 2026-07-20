import { canSelfStartUnassigned, isManagerOrAdminRole } from './roles';
import type { JobStatus, UserRole } from '../types';

export interface JobPermissionUser {
  uid: string;
  role: UserRole;
}

export interface JobPermissionTarget {
  status: JobStatus;
  collaboratorUids: readonly string[];
  assignedToUid?: string;
}

function collaboratorUids(job: JobPermissionTarget): Set<string> {
  const uids = new Set(job.collaboratorUids);
  if (job.assignedToUid) uids.add(job.assignedToUid);
  return uids;
}

export function canStartJob(job: JobPermissionTarget, user: JobPermissionUser): boolean {
  if (job.status !== 'pending') return false;
  const collaborators = collaboratorUids(job);
  return collaborators.size > 0
    ? collaborators.has(user.uid)
    : canSelfStartUnassigned(user.role);
}

export function canCompleteJob(job: JobPermissionTarget, user: JobPermissionUser): boolean {
  if (job.status !== 'started') return false;
  return collaboratorUids(job).has(user.uid) || isManagerOrAdminRole(user.role);
}

export function canUpdateJobProgress(job: JobPermissionTarget, user: JobPermissionUser): boolean {
  if (job.status !== 'pending' && job.status !== 'started') return false;
  return collaboratorUids(job).has(user.uid) || isManagerOrAdminRole(user.role);
}

export function canEditJob(status: JobStatus, role: UserRole): boolean {
  return status !== 'completed' && isManagerOrAdminRole(role);
}

export function canManageCollaborators(status: JobStatus, role: UserRole): boolean {
  return status !== 'completed' && isManagerOrAdminRole(role);
}

export function canClearCollaborators(
  status: JobStatus,
  role: UserRole,
  hasCollaborators: boolean,
): boolean {
  return status === 'pending' && hasCollaborators && isManagerOrAdminRole(role);
}

export function canDeleteJob(role: UserRole): boolean {
  return role === 'admin';
}

export function canRestoreJob(role: UserRole): boolean {
  return isManagerOrAdminRole(role);
}

/** AWF creators are always classified AWF. Only management may honor a toggle. */
export function resolveNewJobIsAwf(role: UserRole, requestedIsAwf = false): boolean {
  if (role === 'awf') return true;
  return isManagerOrAdminRole(role) && requestedIsAwf;
}

export function collaboratorsRequireAwf(
  collaborators: readonly { role: UserRole }[],
): boolean {
  return collaborators.some((collaborator) => collaborator.role === 'awf');
}
