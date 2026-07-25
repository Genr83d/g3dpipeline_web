import type { JobCategory, RepairProcess } from '../types';

export const REPAIR_PROCESS_REQUIRED_MESSAGE = 'Add at least one repair process.';

export const REPAIR_PROCESS_HELPER_TEXT =
  'Enter one process per line, such as Cleaning, Welding, Machining, or Spraying.';

/** Slider granularity, matching the Flutter app. The stored schema accepts any
 *  integer from 0 through 100, so values written elsewhere stay valid. */
export const REPAIR_PROGRESS_STEP = 5;

export const REPAIR_PROGRESS_MIN = 0;
export const REPAIR_PROGRESS_MAX = 100;

/** Only repair jobs keep a process list; every other category stores []. */
export function usesRepairProcesses(category: JobCategory): boolean {
  return category === 'repair';
}

/** Malformed or out-of-range stored values clamp into 0–100 instead of
 *  breaking the card. Non-numeric values read as 0. */
export function clampRepairProgress(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return REPAIR_PROGRESS_MIN;
  return Math.min(REPAIR_PROGRESS_MAX, Math.max(REPAIR_PROGRESS_MIN, Math.round(numeric)));
}

/** Firestore → model. Names are trimmed, blanks dropped, duplicates collapsed
 *  case-insensitively (first wins), and progress clamped to 0–100. Anything
 *  that is not an array — including a missing field on a legacy job — reads
 *  as an empty list. */
export function parseRepairProcesses(value: unknown): RepairProcess[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const processes: RepairProcess[] = [];
  for (const entry of value) {
    const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    processes.push({ name, progress: clampRepairProgress(record.progress) });
  }
  return processes;
}

/** Reads the form's multiline field. Commas are accepted as separators too,
 *  since the helper text lists examples that way. Blank entries are ignored and
 *  repeats collapse case-insensitively. */
export function parseRepairProcessNames(raw: string): string[] {
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
export function repairProcessesToText(processes: readonly RepairProcess[]): string {
  return processes.map((process) => process.name).join('\n');
}

/** Names → processes for a save. A process whose name is unchanged
 *  (case-insensitively) keeps the percentage it already had; new ones start at
 *  0%; names dropped from the list are dropped from Firestore. */
export function mergeRepairProcesses(
  existing: readonly RepairProcess[],
  names: readonly string[],
): RepairProcess[] {
  const progressByName = new Map(
    existing.map((process) => [process.name.trim().toLowerCase(), clampRepairProgress(process.progress)]),
  );
  return parseRepairProcessNames(names.join('\n')).map((name) => ({
    name,
    progress: progressByName.get(name.toLowerCase()) ?? REPAIR_PROGRESS_MIN,
  }));
}

/** Changing a job to another category clears its repair-process list. */
export function repairProcessesForCategory(
  category: JobCategory,
  processes: readonly RepairProcess[],
): RepairProcess[] {
  return usesRepairProcesses(category)
    ? processes.map((process) => ({ name: process.name, progress: clampRepairProgress(process.progress) }))
    : [];
}

/** Returns an error message, or null when the list satisfies the category. */
export function validateRepairProcesses(
  category: JobCategory,
  processes: readonly RepairProcess[],
): string | null {
  if (!usesRepairProcesses(category)) return null;
  return processes.length > 0 ? null : REPAIR_PROCESS_REQUIRED_MESSAGE;
}

/** Rounded arithmetic mean: (100 + 50 + 25 + 0) / 4 = 43.75 → 44%. */
export function overallRepairProgress(processes: readonly RepairProcess[]): number {
  if (processes.length === 0) return 0;
  const total = processes.reduce((sum, process) => sum + clampRepairProgress(process.progress), 0);
  return Math.round(total / processes.length);
}

/** Completing a repair job finishes every process. */
export function completedRepairProcesses(processes: readonly RepairProcess[]): RepairProcess[] {
  return processes.map((process) => ({ name: process.name, progress: REPAIR_PROGRESS_MAX }));
}

/** Restoring a completed repair job resets percentages but keeps the names. */
export function resetRepairProcesses(processes: readonly RepairProcess[]): RepairProcess[] {
  return processes.map((process) => ({ name: process.name, progress: REPAIR_PROGRESS_MIN }));
}

/** Applies submitted percentages onto the stored definitions by name so a
 *  stale dialog can't resurrect a renamed or removed process. Processes the
 *  submission does not mention keep their stored percentage. A job with no
 *  stored definitions (legacy repair record) accepts the submitted list. */
export function applyRepairProgressUpdates(
  stored: readonly RepairProcess[],
  submitted: readonly RepairProcess[],
): RepairProcess[] {
  const submittedProgress = new Map(
    submitted.map((process) => [process.name.trim().toLowerCase(), clampRepairProgress(process.progress)]),
  );
  const definitions = stored.length > 0 ? stored : parseRepairProcesses(submitted);
  return definitions.map((process) => ({
    name: process.name,
    progress: submittedProgress.get(process.name.trim().toLowerCase()) ?? clampRepairProgress(process.progress),
  }));
}
