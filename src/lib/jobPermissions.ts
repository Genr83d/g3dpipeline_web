import { canSelfStartUnassigned, isManagerOrAdminRole } from './roles';
import type { JobSection, JobStatus, UserRole } from '../types';

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

/** The section-progress dialog is for managers/admins and for collaborators
 *  who own at least one section on this job. A collaborator with no section of
 *  their own has nothing to edit, so the control stays hidden. */
export function canUpdateSectionProgress(
  job: { status: JobStatus; sections: readonly JobSection[] },
  user: JobPermissionUser,
): boolean {
  if (job.status !== 'pending' && job.status !== 'started') return false;
  if (job.sections.length === 0) return false;
  if (isManagerOrAdminRole(user.role)) return true;
  return job.sections.some((section) => section.collaboratorUid === user.uid);
}

/** Within the dialog, a collaborator may move only their own sections.
 *  Everything else is visible but disabled. */
export function canEditSectionProgress(
  section: JobSection,
  user: JobPermissionUser,
): boolean {
  return isManagerOrAdminRole(user.role) || section.collaboratorUid === user.uid;
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
