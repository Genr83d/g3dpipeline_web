import type { Timestamp } from 'firebase/firestore';

export type JobStatus = 'pending' | 'started' | 'completed';
export type JobCategory =
  | 'manufacturing'
  | 'repair'
  | 'design'
  | 'softwareDevelopment'
  | 'miscellaneous';
export type UserRole = 'staff' | 'awf' | 'manager' | 'admin';
export type UserStatus = 'pending' | 'active' | 'disabled' | 'removed';

export interface JobCollaborator {
  uid: string;
  name: string;
  role: UserRole;
}

export interface Job {
  id: string;
  name: string;
  customer: string;
  quantity: number;
  dueDate: Date;
  status: JobStatus;
  category: JobCategory;
  isAwf: boolean;
  createdByUid: string;
  createdByName: string;
  createdByEmail: string;
  assignedToUid: string;
  assignedToName: string;
  assignedToRole: UserRole | '';
  assignedByUid: string;
  assignedByName: string;
  assignedAt: Date | null;
  collaborators: JobCollaborator[];
  collaboratorUids: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  completedByUid: string;
  completedByName: string;
  updatedByUid: string;
  updatedByName: string;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  totalQuantity: number;
  createdAt: Date | null;
  createdByUid: string;
  createdByName: string;
  updatedAt: Date | null;
  updatedByUid: string;
  updatedByName: string;
}

export interface MaintenanceProcedure {
  id: string;
  title: string;
  isDone: boolean;
}

export interface MaintenanceHistoryRecord {
  completedAt: Date | null;
  procedureTitles: string[];
  completedByName: string;
  /** Optional maintenance-specific notes; legacy records without one read as ''. */
  notes: string;
}

export interface Machine {
  id: string;
  name: string;
  location: string;
  notes: string;
  procedures: MaintenanceProcedure[];
  maintenanceHistory: MaintenanceHistoryRecord[];
  createdAt: Date | null;
  createdByUid: string;
  createdByName: string;
  updatedAt: Date | null;
  updatedByUid: string;
  updatedByName: string;
}

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phoneNumber?: string;
  jobTitle?: string;
  department?: string;
}

/** Profile fields the rules allow a user to self-update. */
export interface ProfileFields {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phoneNumber?: string;
  jobTitle?: string;
  department?: string;
}

export function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const ts = v as Timestamp;
  if (typeof ts.toDate === 'function') return ts.toDate();
  return null;
}

export function parseAssignedRole(v: unknown): UserRole | '' {
  return v === 'staff' || v === 'awf' || v === 'manager' || v === 'admin' ? v : '';
}

/** Unknown legacy roles intentionally fall back to ordinary Staff. */
export function parseUserRole(v: unknown): UserRole {
  return v === 'awf' || v === 'manager' || v === 'admin' ? v : 'staff';
}

export function parseJobStatus(v: unknown): JobStatus {
  return v === 'started' || v === 'completed' ? v : 'pending';
}

export function isOverdue(job: Job, now: Date = new Date()): boolean {
  return job.status !== 'completed' && job.dueDate.getTime() < now.getTime();
}
