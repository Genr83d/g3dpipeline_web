import fixture from './fixtures/report-fixture.json';
import type { Job, JobCategory, JobStatus, JobTag, Machine, Material, UserRole } from '../types';
import type { ReportPeriod } from '../lib/reportPeriods';

/** Loads the shared report fixture. Timestamps are local wall-clock strings
 *  without an offset, so `new Date(...)` reads them in the test's timezone —
 *  exactly as the Flutter test's DateTime.parse does. */

const date = (v: string | null): Date | null => (v === null ? null : new Date(v));

export const fixtureNow = new Date(fixture.now);
export const fixtureGeneratedBy = fixture.generatedBy;

export const fixtureJobs: Job[] = fixture.jobs.map((j) => ({
  id: j.id,
  orderNumber: j.orderNumber,
  name: j.name,
  customer: j.customer,
  quantity: j.quantity,
  completedQuantity: j.completedQuantity,
  dueDate: new Date(j.dueDate as string),
  status: j.status as JobStatus,
  category: j.category as JobCategory,
  repairProcesses: [],
  tags: j.tags as JobTag[],
  isAwf: false,
  createdByUid: '',
  createdByName: '',
  createdByEmail: '',
  assignedToUid: j.assignedToUid,
  assignedToName: j.assignedToName,
  assignedToRole: '',
  assignedByUid: '',
  assignedByName: '',
  assignedAt: null,
  collaborators: j.collaborators.map((c) => ({ ...c, role: c.role as UserRole })),
  collaboratorUids: j.collaborators.map((c) => c.uid),
  createdAt: date(j.createdAt),
  updatedAt: null,
  startedAt: null,
  completedAt: date(j.completedAt),
  completedByUid: j.completedByUid,
  completedByName: j.completedByName,
  updatedByUid: '',
  updatedByName: '',
  dueDateChangeNote: j.dueDateChangeNote,
  previousDueDate: date(j.previousDueDate),
  dueDateChangedAt: date(j.dueDateChangedAt),
  dueDateChangedByUid: '',
  dueDateChangedByName: j.dueDateChangedByName,
}));

export const fixtureMaterials: Material[] = fixture.materials.map((m) => ({
  ...m,
  createdAt: null,
  createdByUid: '',
  createdByName: '',
  updatedAt: null,
  updatedByUid: '',
  updatedByName: '',
}));

export const fixtureMachines: Machine[] = fixture.machines.map((m) => ({
  id: m.id,
  name: m.name,
  location: m.location,
  notes: '',
  procedures: [],
  maintenanceHistory: m.maintenanceHistory.map((r) => ({ ...r, completedAt: date(r.completedAt) })),
  createdAt: null,
  createdByUid: '',
  createdByName: '',
  updatedAt: null,
  updatedByUid: '',
  updatedByName: '',
}));

export const fixturePeriods = fixture.periods as Array<{ name: string; period: ReportPeriod }>;
