import type { Job } from '../types';

/** Completion months are derived from `completedAt` in the reader's own
 *  timezone — never from the deadline, which routinely falls in a different
 *  month from the day the work actually shipped. */

export const ARCHIVE_ALL_MONTHS = 'all';
/** Completed jobs whose `completedAt` never reached Firestore (legacy records,
 *  a write that lost its server timestamp) still have to be reachable. */
export const ARCHIVE_UNKNOWN_MONTH = 'unknown';

/** Local `YYYY-MM`. Zero-padded so a plain string sort is a date sort, and
 *  year-qualified so September 2025 and September 2026 never collapse. */
export type ArchiveMonthKey = `${number}-${number}`;

export type ArchiveMonthFilter =
  | typeof ARCHIVE_ALL_MONTHS
  | typeof ARCHIVE_UNKNOWN_MONTH
  | ArchiveMonthKey;

export interface ArchiveMonthOption {
  value: ArchiveMonthFilter;
  label: string;
}

const monthYearFmt = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
});

export const ARCHIVE_ALL_MONTHS_LABEL = 'All months';
export const ARCHIVE_UNKNOWN_MONTH_LABEL = 'Unknown month';

export function archiveMonthKey(completedAt: Date): ArchiveMonthKey {
  const month = String(completedAt.getMonth() + 1).padStart(2, '0');
  return `${completedAt.getFullYear()}-${month}` as ArchiveMonthKey;
}

/** The bucket a completed job belongs to: its local completion month, or the
 *  unknown bucket when it has no completion timestamp at all. */
export function jobArchiveMonth(job: Job): ArchiveMonthKey | typeof ARCHIVE_UNKNOWN_MONTH {
  return job.completedAt ? archiveMonthKey(job.completedAt) : ARCHIVE_UNKNOWN_MONTH;
}

export function archiveMonthLabel(value: ArchiveMonthFilter): string {
  if (value === ARCHIVE_ALL_MONTHS) return ARCHIVE_ALL_MONTHS_LABEL;
  if (value === ARCHIVE_UNKNOWN_MONTH) return ARCHIVE_UNKNOWN_MONTH_LABEL;
  const [year, month] = value.split('-').map(Number);
  return monthYearFmt.format(new Date(year, month - 1, 1));
}

/** Newest completion first. Jobs that never recorded one sink below every
 *  dated job and order among themselves by deadline, newest first. */
export function compareArchivedJobs(a: Job, b: Job): number {
  const aCompleted = a.completedAt?.getTime();
  const bCompleted = b.completedAt?.getTime();
  if (aCompleted !== undefined && bCompleted !== undefined) return bCompleted - aCompleted;
  if (aCompleted !== undefined) return -1;
  if (bCompleted !== undefined) return 1;
  return b.dueDate.getTime() - a.dueDate.getTime();
}

/** The archive itself: completed jobs only, in display order. Pending and
 *  in-progress work never appears here whatever the month filter says. */
export function archivedJobs(jobs: readonly Job[]): Job[] {
  return jobs.filter((job) => job.status === 'completed').sort(compareArchivedJobs);
}

/** Only the months that actually contain completed jobs, newest first, with
 *  the unknown bucket last so the dated months stay chronological. "All
 *  months" is not included — the select renders it as its own first option,
 *  the same way the Jobs board renders "All Types". */
export function archiveMonthOptions(jobs: readonly Job[]): ArchiveMonthOption[] {
  const months = new Set<ArchiveMonthKey>();
  let hasUnknown = false;
  for (const job of jobs) {
    if (job.status !== 'completed') continue;
    const month = jobArchiveMonth(job);
    if (month === ARCHIVE_UNKNOWN_MONTH) hasUnknown = true;
    else months.add(month);
  }
  const options: ArchiveMonthOption[] = [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((value) => ({ value, label: archiveMonthLabel(value) }));
  if (hasUnknown) {
    options.push({
      value: ARCHIVE_UNKNOWN_MONTH,
      label: ARCHIVE_UNKNOWN_MONTH_LABEL,
    });
  }
  return options;
}

export function filterJobsByArchiveMonth(
  jobs: readonly Job[],
  month: ArchiveMonthFilter,
): Job[] {
  if (month === ARCHIVE_ALL_MONTHS) return [...jobs];
  return jobs.filter((job) => jobArchiveMonth(job) === month);
}

/** True while `month` still names a bucket the archive holds. Live data can
 *  empty the month in view — a restore, a delete, someone else's edit — and
 *  the page falls back to All months when it does. */
export function isArchiveMonthAvailable(
  month: ArchiveMonthFilter,
  options: readonly ArchiveMonthOption[],
): boolean {
  return month === ARCHIVE_ALL_MONTHS || options.some((option) => option.value === month);
}
