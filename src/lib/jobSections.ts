import type { Job, JobCategory, JobCollaborator, JobSection } from '../types';

/** Repair jobs kept their original vocabulary; every other category calls the
 *  same list "job sections". Only the wording differs — the stored field, the
 *  maths, and the permission model are shared. */
export function usesRepairVocabulary(category: JobCategory): boolean {
  return category === 'repair';
}

export function sectionsHeading(category: JobCategory): string {
  return usesRepairVocabulary(category) ? 'Repair processes' : 'Job sections';
}

export function sectionRequiredMessage(category: JobCategory): string {
  return usesRepairVocabulary(category)
    ? 'Add at least one repair process.'
    : 'Add at least one job section.';
}

export function sectionHelperText(category: JobCategory): string {
  return usesRepairVocabulary(category)
    ? 'Enter one process per line, such as Cleaning, Welding, Machining, or Spraying.'
    : 'Enter one section per line, such as Design, Routing, or Metalworking.';
}

/** Slider granularity, matching the Flutter app. The stored schema accepts any
 *  integer from 0 through 100, so values written elsewhere stay valid. */
export const SECTION_PROGRESS_STEP = 5;

export const SECTION_PROGRESS_MIN = 0;
export const SECTION_PROGRESS_MAX = 100;

/** Malformed or out-of-range stored values clamp into 0–100 instead of
 *  breaking the card. Non-numeric values read as 0. */
export function clampSectionProgress(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return SECTION_PROGRESS_MIN;
  return Math.min(SECTION_PROGRESS_MAX, Math.max(SECTION_PROGRESS_MIN, Math.round(numeric)));
}

/** Firestore → model. Names are trimmed, blanks dropped, duplicates collapsed
 *  case-insensitively (first wins), and progress clamped to 0–100. A missing
 *  or non-string collaboratorUid — including every section written before
 *  ownership existed — reads as ''. Anything that is not an array reads as an
 *  empty list. */
export function parseJobSections(value: unknown): JobSection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const sections: JobSection[] = [];
  for (const entry of value) {
    const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    sections.push({
      name,
      progress: clampSectionProgress(record.progress),
      collaboratorUid:
        typeof record.collaboratorUid === 'string' ? record.collaboratorUid.trim() : '',
    });
  }
  return sections;
}

/** Model → Firestore. collaboratorUid is omitted while a section is
 *  unassigned, matching the Flutter writer so both clients round-trip the same
 *  document shape. */
export function sectionToFirestore(section: JobSection): Record<string, unknown> {
  const collaboratorUid = section.collaboratorUid.trim();
  return {
    name: section.name.trim(),
    progress: clampSectionProgress(section.progress),
    ...(collaboratorUid ? { collaboratorUid } : {}),
  };
}

export function sectionsToFirestore(
  sections: readonly JobSection[],
): Record<string, unknown>[] {
  return sections.map(sectionToFirestore);
}

/** Reads the form's multiline field. Commas are accepted as separators too,
 *  since the helper text lists examples that way. Blank entries are ignored and
 *  repeats collapse case-insensitively. */
export function parseSectionNames(raw: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of raw.split(/[\n,]/)) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** Model → the form's multiline field. */
export function sectionsToText(sections: readonly JobSection[]): string {
  return sections.map((section) => section.name).join('\n');
}

/** Names → sections for a save. A section whose name is unchanged
 *  (case-insensitively) keeps both the percentage and the collaborator it
 *  already had; new ones start at 0% and unassigned; names dropped from the
 *  list are dropped from Firestore. */
export function mergeJobSections(
  existing: readonly JobSection[],
  names: readonly string[],
): JobSection[] {
  const byName = new Map(
    existing.map((section) => [section.name.trim().toLowerCase(), section]),
  );
  return parseSectionNames(names.join('\n')).map((name) => {
    const previous = byName.get(name.toLowerCase());
    return {
      name,
      progress: clampSectionProgress(previous?.progress ?? SECTION_PROGRESS_MIN),
      collaboratorUid: previous?.collaboratorUid.trim() ?? '',
    };
  });
}

/** Returns an error message, or null when the job has at least one section.
 *  Every category needs one. */
export function validateJobSections(
  category: JobCategory,
  sections: readonly JobSection[],
): string | null {
  return sections.length > 0 ? null : sectionRequiredMessage(category);
}

/** Rounded arithmetic mean: (100 + 50 + 25 + 0) / 4 = 43.75 → 44%. */
export function overallSectionProgress(sections: readonly JobSection[]): number {
  if (sections.length === 0) return 0;
  const total = sections.reduce((sum, section) => sum + clampSectionProgress(section.progress), 0);
  return Math.round(total / sections.length);
}

/** Completing a job finishes every section; ownership is preserved. */
export function completedJobSections(sections: readonly JobSection[]): JobSection[] {
  return sections.map((section) => ({ ...section, progress: SECTION_PROGRESS_MAX }));
}

/** Restoring a completed job resets percentages but keeps names and owners. */
export function resetJobSections(sections: readonly JobSection[]): JobSection[] {
  return sections.map((section) => ({ ...section, progress: SECTION_PROGRESS_MIN }));
}

/** Applies submitted percentages onto the stored definitions by name so a
 *  stale dialog can't resurrect a renamed or removed section, nor rewrite who
 *  a section belongs to. Sections the submission does not mention keep their
 *  stored percentage. A job with no stored definitions (legacy record) accepts
 *  the submitted list. */
export function applySectionProgressUpdates(
  stored: readonly JobSection[],
  submitted: readonly JobSection[],
): JobSection[] {
  const submittedProgress = new Map(
    submitted.map((section) => [section.name.trim().toLowerCase(), clampSectionProgress(section.progress)]),
  );
  const definitions = stored.length > 0 ? stored : parseJobSections(submitted);
  return definitions.map((section) => ({
    name: section.name,
    progress:
      submittedProgress.get(section.name.trim().toLowerCase()) ??
      clampSectionProgress(section.progress),
    collaboratorUid: section.collaboratorUid,
  }));
}

/** Dropping a collaborator from a job leaves their sections unassigned until
 *  someone reassigns them. */
export function clearRemovedCollaborators(
  sections: readonly JobSection[],
  collaboratorUids: readonly string[],
): JobSection[] {
  const allowed = new Set(collaboratorUids.map((uid) => uid.trim()).filter(Boolean));
  return sections.map((section) =>
    allowed.has(section.collaboratorUid.trim()) ? { ...section } : { ...section, collaboratorUid: '' },
  );
}

export const SECTION_ASSIGNMENT_REQUIRED_MESSAGE =
  'Assign every section to one of this job’s collaborators.';

/** Returns an error message, or null when every section belongs to a
 *  collaborator that is actually on the job. */
export function validateSectionAssignments(
  sections: readonly JobSection[],
  collaboratorUids: readonly string[],
): string | null {
  const allowed = new Set(collaboratorUids.map((uid) => uid.trim()).filter(Boolean));
  const assigned = sections.every((section) => allowed.has(section.collaboratorUid.trim()));
  return assigned ? null : SECTION_ASSIGNMENT_REQUIRED_MESSAGE;
}

/** Display name for a section's owner, or '' while it is unassigned or the
 *  owner is no longer listed on the job. */
export function sectionCollaboratorName(
  collaborators: readonly JobCollaborator[],
  section: JobSection,
): string {
  const uid = section.collaboratorUid.trim();
  if (!uid) return '';
  return collaborators.find((collaborator) => collaborator.uid === uid)?.name.trim() ?? '';
}

/** True when the user owns at least one section on the job. Managers and
 *  admins reach the dialog through their role instead. */
export function ownsAnySection(job: Pick<Job, 'repairProcesses'>, uid: string): boolean {
  return job.repairProcesses.some((section) => section.collaboratorUid === uid);
}
