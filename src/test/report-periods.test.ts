import { describe, expect, it } from 'vitest';
import {
  granularityFor,
  periodBuckets,
  periodLabel,
  periodRange,
  previousPeriod,
  rangeDays,
  reportFilename,
} from '../lib/reportPeriods';

describe('report periods', () => {
  it('builds half-open local ranges', () => {
    const r = periodRange({ kind: 'month', year: 2026, month: 2 });
    expect(r.start).toEqual(new Date(2026, 1, 1));
    expect(r.end).toEqual(new Date(2026, 2, 1));
    expect(rangeDays(periodRange({ kind: 'custom', start: '2026-09-10', end: '2026-09-20' }))).toBe(11);
  });

  it('labels each kind of period', () => {
    expect(periodLabel({ kind: 'month', year: 2026, month: 9 })).toBe('September 2026');
    expect(periodLabel({ kind: 'quarter', year: 2026, quarter: 3 })).toBe('Q3 2026');
    expect(periodLabel({ kind: 'year', year: 2026 })).toBe('2026');
    expect(periodLabel({ kind: 'custom', start: '2026-03-01', end: '2026-06-15' })).toBe(
      '1 Mar 2026 – 15 Jun 2026',
    );
    expect(periodLabel({ kind: 'custom', start: '2026-03-01', end: '2026-03-01' })).toBe('1 Mar 2026');
  });

  it('steps back to the equally long previous period', () => {
    expect(previousPeriod({ kind: 'month', year: 2026, month: 1 })).toEqual({ kind: 'month', year: 2025, month: 12 });
    expect(previousPeriod({ kind: 'quarter', year: 2026, quarter: 1 })).toEqual({ kind: 'quarter', year: 2025, quarter: 4 });
    expect(previousPeriod({ kind: 'custom', start: '2026-09-10', end: '2026-09-20' })).toEqual({
      kind: 'custom',
      start: '2026-08-30',
      end: '2026-09-09',
    });
  });

  it('chooses chart granularity by length and covers the range exactly', () => {
    const month = periodRange({ kind: 'month', year: 2026, month: 9 });
    expect(granularityFor(month)).toBe('day');
    expect(periodBuckets(month)).toHaveLength(30);
    const quarter = periodRange({ kind: 'quarter', year: 2026, quarter: 3 });
    expect(granularityFor(quarter)).toBe('week');
    const weeks = periodBuckets(quarter);
    expect(weeks).toHaveLength(14);
    expect(weeks[weeks.length - 1].end).toEqual(quarter.end);
    const year = periodRange({ kind: 'year', year: 2026 });
    expect(periodBuckets(year).map((b) => b.label)).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]);
    const spanning = periodRange({ kind: 'custom', start: '2025-11-15', end: '2026-02-20' });
    expect(periodBuckets(spanning).map((b) => b.label)).toEqual(['Nov 25', 'Dec 25', 'Jan 26', 'Feb 26']);
  });

  it('names the file after the period', () => {
    expect(reportFilename({ kind: 'month', year: 2026, month: 9 })).toBe('G3D-Operations-Report-2026-09.pdf');
    expect(reportFilename({ kind: 'custom', start: '2026-03-01', end: '2026-06-15' })).toBe(
      'G3D-Operations-Report-2026-03-01_2026-06-15.pdf',
    );
  });
});
