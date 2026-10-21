import fixture from './fixtures/report-fixture.json';
import type {
  Hazard,
  HazardSeverity,
  HazardStatus,
  Job,
  JobCategory,
  JobStatus,
  JobTag,
  Machine,
  Material,
  UserRole,
} from '../types';
import type { ReportPeriod } from '../lib/reportPeriods';
import { OPERATIONAL_MACHINE_FIELDS } from '../lib/machineStatus';

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

interface RawDowntime {
  downSince: string;
  repairedAt: string;
  reason: string;
  reportedByName: string;
  repairedByName: string;
  assignedToName: string;
}

interface RawMachineStatus {
  status?: string;
  downReason?: string;
  downSince?: string;
  downReportedByName?: string;
  repairAssignedToName?: string;
  downtimeHistory?: RawDowntime[];
}

export const fixtureMachines: Machine[] = fixture.machines.map((m) => {
  const raw = m as typeof m & RawMachineStatus;
  const down = raw.status === 'down';
  return {
    id: m.id,
    name: m.name,
    location: m.location,
    notes: '',
    procedures: [],
    maintenanceHistory: m.maintenanceHistory.map((r) => ({
      // The fixture holds records from before the apps asked who did the work.
      completedByUid: '',
      loggedByUid: '',
      loggedByName: '',
      ...r,
      completedAt: date(r.completedAt),
    })),
    createdAt: null,
    createdByUid: '',
    createdByName: '',
    updatedAt: null,
    updatedByUid: '',
    updatedByName: '',
    ...OPERATIONAL_MACHINE_FIELDS,
    status: down ? 'down' : 'operational',
    downReason: raw.downReason ?? '',
    downSince: date(raw.downSince ?? null),
    downReportedByName: raw.downReportedByName ?? '',
    repairAssignedToName: raw.repairAssignedToName ?? '',
    downtimeHistory: (raw.downtimeHistory ?? []).map((r) => ({
      ...r,
      downSince: new Date(r.downSince),
      repairedAt: new Date(r.repairedAt),
    })),
  };
});

interface RawHazard {
  id: string;
  title: string;
  location: string;
  severity: string;
  status: string;
  createdAt: string | null;
  reportedByName: string;
  assignedToName: string;
  resolvedAt: string | null;
  resolvedByName: string;
  resolutionNote: string;
}

export const fixtureHazards: Hazard[] = (fixture.hazards as RawHazard[]).map((h) => ({
  id: h.id,
  title: h.title,
  description: '',
  location: h.location,
  severity: h.severity as HazardSeverity,
  status: h.status as HazardStatus,
  reportedByUid: '',
  reportedByName: h.reportedByName,
  assignedToUid: '',
  assignedToName: h.assignedToName,
  assignedByName: '',
  assignedAt: null,
  resolutionNote: h.resolutionNote,
  resolvedAt: date(h.resolvedAt),
  resolvedByName: h.resolvedByName,
  createdAt: date(h.createdAt),
  updatedAt: null,
}));

export const fixturePeriods = fixture.periods as Array<{ name: string; period: ReportPeriod }>;
