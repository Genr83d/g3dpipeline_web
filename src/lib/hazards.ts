import type { Hazard, HazardSeverity, HazardStatus, UserRole } from '../types';
import { toDate } from '../types';
import { isManagerOrAdminRole } from './roles';

/** Field limits, matching the Firestore rules. */
export const HAZARD_TITLE_MAX = 120;
export const HAZARD_LOCATION_MAX = 120;
export const HAZARD_TEXT_MAX = 2000;

export const HAZARD_SEVERITIES: readonly HazardSeverity[] = ['low', 'medium', 'high', 'critical'];

const SEVERITY_LABELS: Readonly<Record<HazardSeverity, string>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const SEVERITY_GUIDANCE: Readonly<Record<HazardSeverity, string>> = {
  low: 'Minor; fix when convenient',
  medium: 'Could hurt someone; fix soon',
  high: 'Likely to hurt someone; fix today',
  critical: 'Stop work in the area until fixed',
};

const STATUS_LABELS: Readonly<Record<HazardStatus, string>> = {
  open: 'Open',
  inProgress: 'In progress',
  resolved: 'Resolved',
};

export function hazardSeverityLabel(severity: HazardSeverity): string {
  return SEVERITY_LABELS[severity];
}

export function hazardSeverityGuidance(severity: HazardSeverity): string {
  return SEVERITY_GUIDANCE[severity];
}

export function hazardStatusLabel(status: HazardStatus): string {
  return STATUS_LABELS[status];
}

export function parseHazardSeverity(value: unknown): HazardSeverity {
  return value === 'low' || value === 'high' || value === 'critical' ? value : 'medium';
}

export function parseHazardStatus(value: unknown): HazardStatus {
  return value === 'inProgress' || value === 'resolved' ? value : 'open';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseHazard(id: string, data: Record<string, unknown>): Hazard {
  return {
    id,
    title: text(data.title),
    description: text(data.description),
    location: text(data.location),
    severity: parseHazardSeverity(data.severity),
    status: parseHazardStatus(data.status),
    reportedByUid: text(data.reportedByUid),
    reportedByName: text(data.reportedByName),
    assignedToUid: text(data.assignedToUid),
    assignedToName: text(data.assignedToName),
    assignedByName: text(data.assignedByName),
    assignedAt: toDate(data.assignedAt),
    resolutionNote: text(data.resolutionNote),
    resolvedAt: toDate(data.resolvedAt),
    resolvedByName: text(data.resolvedByName),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

const SEVERITY_RANK: Readonly<Record<HazardSeverity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/** Unresolved first, then the most severe, then the newest report. Resolved
 *  hazards sort by when they were resolved, newest first. */
export function compareHazards(a: Hazard, b: Hazard): number {
  const aResolved = a.status === 'resolved';
  const bResolved = b.status === 'resolved';
  if (aResolved !== bResolved) return aResolved ? 1 : -1;
  if (aResolved) return (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0);
  const severity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (severity !== 0) return severity;
  // A report still waiting on its server timestamp is the newest.
  const newest = Number.MAX_SAFE_INTEGER;
  return (b.createdAt?.getTime() ?? newest) - (a.createdAt?.getTime() ?? newest);
}

/** An unresolved high or critical hazard: lights the Hazards tab. */
export function isUrgentHazard(hazard: Hazard): boolean {
  return hazard.status !== 'resolved' && SEVERITY_RANK[hazard.severity] >= SEVERITY_RANK.high;
}

export interface HazardViewer {
  uid: string;
  role: UserRole;
}

/** Managers and admins triage every hazard. */
export function canAssignHazard(hazard: Hazard, viewer: HazardViewer): boolean {
  return hazard.status !== 'resolved' && isManagerOrAdminRole(viewer.role);
}

/** The assignee works it; management can step in. */
export function canWorkHazard(hazard: Hazard, viewer: HazardViewer): boolean {
  return (
    hazard.status !== 'resolved' &&
    (isManagerOrAdminRole(viewer.role) || hazard.assignedToUid === viewer.uid)
  );
}

export function canReopenHazard(hazard: Hazard, viewer: HazardViewer): boolean {
  return hazard.status === 'resolved' && isManagerOrAdminRole(viewer.role);
}

/** The reporter can correct their report until someone picks it up. */
export function canEditHazard(hazard: Hazard, viewer: HazardViewer): boolean {
  return (
    isManagerOrAdminRole(viewer.role) ||
    (hazard.reportedByUid === viewer.uid && hazard.status === 'open' && !hazard.assignedToUid)
  );
}

export function canDeleteHazard(viewer: HazardViewer): boolean {
  return viewer.role === 'admin';
}

export interface HazardInput {
  title: string;
  description: string;
  location: string;
  severity: HazardSeverity;
}

/** Trims and checks the editable fields. Returns an error message, or null. */
export function validateHazardInput(input: HazardInput): string | null {
  const title = input.title.trim();
  if (!title) return 'Describe the hazard in a few words.';
  if (title.length > HAZARD_TITLE_MAX) return `Keep the title under ${HAZARD_TITLE_MAX} characters.`;
  if (input.location.trim().length > HAZARD_LOCATION_MAX) {
    return `Keep the location under ${HAZARD_LOCATION_MAX} characters.`;
  }
  if (input.description.trim().length > HAZARD_TEXT_MAX) {
    return `Keep the details under ${HAZARD_TEXT_MAX} characters.`;
  }
  if (!HAZARD_SEVERITIES.includes(input.severity)) return 'Choose how severe the hazard is.';
  return null;
}

export const RESOLUTION_REQUIRED_MESSAGE = 'Say what was done to make it safe.';

export function validateResolutionNote(note: string): string | null {
  const trimmed = note.trim();
  if (!trimmed) return RESOLUTION_REQUIRED_MESSAGE;
  if (trimmed.length > HAZARD_TEXT_MAX) return `Keep the note under ${HAZARD_TEXT_MAX} characters.`;
  return null;
}
