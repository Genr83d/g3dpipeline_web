import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_ALL_MONTHS,
  ARCHIVE_UNKNOWN_MONTH,
  archiveMonthKey,
  archiveMonthLabel,
  archiveMonthOptions,
  archivedJobs,
  compareArchivedJobs,
  filterJobsByArchiveMonth,
  isArchiveMonthAvailable,
  jobArchiveMonth,
  type ArchiveMonthFilter,
} from '../lib/archiveMonths';
import type { Job } from '../types';

/** Local constructors throughout: a `new Date(2026, 8, 15)` is September 2026
 *  on every machine, while an ISO string near a month boundary is not. */
function job(overrides: Partial<Job> = {}): Job {
  return {
    tags: [],
    id: 'job-1',
    orderNumber: 'G3D-JOB-1',
    name: 'Event badges',
    customer: 'Receiver',
    quantity: 10,
    completedQuantity: 0,
    dueDate: new Date(2026, 5, 15, 23, 59, 59),
    status: 'completed',
    category: 'manufacturing',
    repairProcesses: [],
    isAwf: false,
    createdByUid: 'creator',
    createdByName: 'Creator',
    createdByEmail: 'creator@example.com',
    assignedToUid: '',
    assignedToName: '',
    assignedToRole: '',
    assignedByUid: '',
    assignedByName: '',
    assignedAt: null,
    collaborators: [],
    collaboratorUids: [],
    createdAt: null,
    updatedAt: null,
    startedAt: null,
    completedAt: null,
    completedByUid: '',
    completedByName: '',
    updatedByUid: '',
    updatedByName: '',
    dueDateChangeNote: '',
    previousDueDate: null,
    dueDateChangedAt: null,
    dueDateChangedByUid: '',
    dueDateChangedByName: '',
    ...overrides,
  };
}

/** The reader's own locale, exactly as the lib formats it — so these tests
 *  assert the month and year are both there without pinning a language. */
function expectedLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex, 1),
  );
}

function names(jobs: readonly Job[]): string[] {
  return jobs.map((j) => j.name);
}

describe('archive month keys', () => {
  it('reads the month from completedAt in local time, never from the deadline', () => {
    const shipped = job({
      dueDate: new Date(2026, 7, 31, 23, 59, 59), // due in August
      completedAt: new Date(2026, 8, 2, 10, 0, 0), // shipped in September
    });

    expect(archiveMonthKey(shipped.completedAt!)).toBe('2026-09');
    expect(jobArchiveMonth(shipped)).toBe('2026-09');
  });

  it('zero-pads single-digit months so keys sort chronologically', () => {
    expect(archiveMonthKey(new Date(2026, 0, 1))).toBe('2026-01');
    expect(['2026-01', '2026-09', '2026-10'].sort()).toEqual([
      '2026-01',
      '2026-09',
      '2026-10',
    ]);
  });

  it('buckets a completed job with no timestamp as the unknown month', () => {
    expect(jobArchiveMonth(job({ completedAt: null }))).toBe(ARCHIVE_UNKNOWN_MONTH);
  });

  it('labels a month with its full name and year, and never merges two years', () => {
    expect(archiveMonthLabel('2026-09')).toBe(expectedLabel(2026, 8));
    expect(archiveMonthLabel('2026-09')).toContain('2026');
    expect(archiveMonthLabel('2026-09')).not.toBe(archiveMonthLabel('2025-09'));
    expect(archiveMonthLabel(ARCHIVE_ALL_MONTHS)).toBe('All months');
    expect(archiveMonthLabel(ARCHIVE_UNKNOWN_MONTH)).toBe('Unknown month');
  });
});

describe('archive month options', () => {
  const jobs: Job[] = [
    job({ id: 'a', name: 'Sept 2026', completedAt: new Date(2026, 8, 20) }),
    job({ id: 'b', name: 'Sept 2025', completedAt: new Date(2025, 8, 4) }),
    job({ id: 'c', name: 'Jan 2026', completedAt: new Date(2026, 0, 9) }),
    job({ id: 'd', name: 'Also Sept 2026', completedAt: new Date(2026, 8, 1) }),
  ];

  it('lists each month once, newest first, keeping years apart', () => {
    expect(archiveMonthOptions(jobs)).toEqual([
      { value: '2026-09', label: expectedLabel(2026, 8) },
      { value: '2026-01', label: expectedLabel(2026, 0) },
      { value: '2025-09', label: expectedLabel(2025, 8) },
    ]);
  });

  it('omits months that hold no completed job', () => {
    expect(archiveMonthOptions(jobs).map((o) => o.value)).not.toContain('2026-08');
  });

  it('adds Unknown month last, and only when a completed job lacks a timestamp', () => {
    expect(archiveMonthOptions(jobs).map((o) => o.value)).not.toContain(ARCHIVE_UNKNOWN_MONTH);

    const withUndated = archiveMonthOptions([...jobs, job({ id: 'e', completedAt: null })]);
    expect(withUndated.at(-1)).toEqual({
      value: ARCHIVE_UNKNOWN_MONTH,
      label: 'Unknown month',
    });
  });

  it('ignores pending and in-progress jobs when building the list', () => {
    expect(
      archiveMonthOptions([
        job({ id: 'pending', status: 'pending', completedAt: new Date(2026, 3, 1) }),
        job({ id: 'started', status: 'started', completedAt: null }),
      ]),
    ).toEqual([]);
  });
});

describe('archived jobs', () => {
  it('keeps only completed jobs, newest completion first', () => {
    const list = archivedJobs([
      job({ id: 'old', name: 'Older', completedAt: new Date(2026, 8, 2) }),
      job({ id: 'pending', name: 'Pending', status: 'pending' }),
      job({ id: 'new', name: 'Newest', completedAt: new Date(2026, 8, 25) }),
      job({ id: 'started', name: 'In progress', status: 'started' }),
      job({ id: 'mid', name: 'Middle', completedAt: new Date(2026, 8, 12) }),
    ]);

    expect(names(list)).toEqual(['Newest', 'Middle', 'Older']);
  });

  it('sinks undated jobs below dated ones and orders them by deadline, newest first', () => {
    const list = archivedJobs([
      job({
        id: 'undated-near',
        name: 'Undated, due sooner',
        completedAt: null,
        dueDate: new Date(2026, 1, 1),
      }),
      job({ id: 'dated', name: 'Dated', completedAt: new Date(2020, 0, 1) }),
      job({
        id: 'undated-far',
        name: 'Undated, due later',
        completedAt: null,
        dueDate: new Date(2026, 11, 1),
      }),
    ]);

    expect(names(list)).toEqual(['Dated', 'Undated, due later', 'Undated, due sooner']);
  });

  it('compares two undated jobs by deadline alone', () => {
    const later = job({ completedAt: null, dueDate: new Date(2026, 11, 1) });
    const earlier = job({ completedAt: null, dueDate: new Date(2026, 1, 1) });

    expect(compareArchivedJobs(later, earlier)).toBeLessThan(0);
    expect(compareArchivedJobs(earlier, later)).toBeGreaterThan(0);
  });

  it('does not mutate the list it was given', () => {
    const jobs = [
      job({ id: 'a', name: 'Older', completedAt: new Date(2026, 8, 2) }),
      job({ id: 'b', name: 'Newest', completedAt: new Date(2026, 8, 25) }),
    ];

    archivedJobs(jobs);
    expect(names(jobs)).toEqual(['Older', 'Newest']);
  });
});

describe('filtering by completion month', () => {
  const jobs: Job[] = [
    job({ id: 'a', name: 'Sept 2026', completedAt: new Date(2026, 8, 20) }),
    job({ id: 'b', name: 'Sept 2025', completedAt: new Date(2025, 8, 4) }),
    job({
      id: 'c',
      name: 'Due August, shipped September',
      dueDate: new Date(2026, 7, 28),
      completedAt: new Date(2026, 8, 3),
    }),
    job({ id: 'd', name: 'August 2026', completedAt: new Date(2026, 7, 30) }),
    job({ id: 'e', name: 'Undated', completedAt: null }),
  ];

  it('shows every archived job under All months', () => {
    expect(filterJobsByArchiveMonth(jobs, ARCHIVE_ALL_MONTHS)).toHaveLength(jobs.length);
  });

  it('excludes the same month in another year and every other month', () => {
    expect(names(filterJobsByArchiveMonth(jobs, '2026-09'))).toEqual([
      'Sept 2026',
      'Due August, shipped September',
    ]);
  });

  it('keeps undated jobs reachable under Unknown month', () => {
    expect(names(filterJobsByArchiveMonth(jobs, ARCHIVE_UNKNOWN_MONTH))).toEqual(['Undated']);
  });

  it('holds a selection only while its month still has jobs', () => {
    const options = archiveMonthOptions(jobs);

    expect(isArchiveMonthAvailable(ARCHIVE_ALL_MONTHS, [])).toBe(true);
    expect(isArchiveMonthAvailable('2026-09', options)).toBe(true);
    expect(isArchiveMonthAvailable(ARCHIVE_UNKNOWN_MONTH, options)).toBe(true);
    expect(isArchiveMonthAvailable('2024-03' as ArchiveMonthFilter, options)).toBe(false);
    expect(isArchiveMonthAvailable('2026-09', archiveMonthOptions([]))).toBe(false);
  });
});
