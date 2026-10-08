/** Report periods are calendar spans in the reader's own timezone, the same
 *  way the archive buckets completions. Every range is half-open — `start`
 *  inclusive, `end` exclusive — so a job completed at 23:59:59 on the last day
 *  belongs to the period and one completed at midnight after it does not.
 *
 *  Labels use fixed English month names rather than Intl so the web and the
 *  mobile app (lib/reports/report_periods.dart) print identical reports. */

export type ReportPeriod =
  | { kind: 'month'; year: number; month: number }
  | { kind: 'quarter'; year: number; quarter: number }
  | { kind: 'year'; year: number }
  /** `start` and `end` are inclusive local calendar days, `YYYY-MM-DD`. */
  | { kind: 'custom'; start: string; end: string };

export interface ReportRange {
  start: Date;
  end: Date;
}

/** How the throughput chart buckets a range. */
export type ReportGranularity = 'day' | 'week' | 'month';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const DAY_MS = 86_400_000;

export function shortMonthName(monthIndex: number): string {
  return MONTH_NAMES[monthIndex].slice(0, 3);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar day as `YYYY-MM-DD`. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `YYYY-MM-DD` → local midnight. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "3 Sep 2026". */
export function formatReportDate(d: Date): string {
  return `${d.getDate()} ${shortMonthName(d.getMonth())} ${d.getFullYear()}`;
}

/** "3 Sep 2026, 14:05". */
export function formatReportDateTime(d: Date): string {
  return `${formatReportDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function periodRange(period: ReportPeriod): ReportRange {
  switch (period.kind) {
    case 'month':
      return {
        start: new Date(period.year, period.month - 1, 1),
        end: new Date(period.year, period.month, 1),
      };
    case 'quarter': {
      const firstMonth = (period.quarter - 1) * 3;
      return {
        start: new Date(period.year, firstMonth, 1),
        end: new Date(period.year, firstMonth + 3, 1),
      };
    }
    case 'year':
      return { start: new Date(period.year, 0, 1), end: new Date(period.year + 1, 0, 1) };
    case 'custom': {
      const start = parseDayKey(period.start);
      const last = parseDayKey(period.end);
      return { start, end: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1) };
    }
  }
}

/** Whole calendar days in a range. Rounded so a DST shift inside the range
 *  never turns 30 days into 29.96. */
export function rangeDays(range: ReportRange): number {
  return Math.round((range.end.getTime() - range.start.getTime()) / DAY_MS);
}

export function periodLabel(period: ReportPeriod): string {
  switch (period.kind) {
    case 'month':
      return `${MONTH_NAMES[period.month - 1]} ${period.year}`;
    case 'quarter':
      return `Q${period.quarter} ${period.year}`;
    case 'year':
      return String(period.year);
    case 'custom': {
      const start = parseDayKey(period.start);
      const end = parseDayKey(period.end);
      return period.start === period.end
        ? formatReportDate(start)
        : `${formatReportDate(start)} – ${formatReportDate(end)}`;
    }
  }
}

/** The equally long span immediately before, which headline deltas compare
 *  against. A custom range steps back by its own length in days. */
export function previousPeriod(period: ReportPeriod): ReportPeriod {
  switch (period.kind) {
    case 'month':
      return period.month === 1
        ? { kind: 'month', year: period.year - 1, month: 12 }
        : { kind: 'month', year: period.year, month: period.month - 1 };
    case 'quarter':
      return period.quarter === 1
        ? { kind: 'quarter', year: period.year - 1, quarter: 4 }
        : { kind: 'quarter', year: period.year, quarter: period.quarter - 1 };
    case 'year':
      return { kind: 'year', year: period.year - 1 };
    case 'custom': {
      const range = periodRange(period);
      const days = rangeDays(range);
      const s = range.start;
      return {
        kind: 'custom',
        start: dayKey(new Date(s.getFullYear(), s.getMonth(), s.getDate() - days)),
        end: dayKey(new Date(s.getFullYear(), s.getMonth(), s.getDate() - 1)),
      };
    }
  }
}

/** Filename-safe period token: 2026-09, 2026-Q3, 2026, 2026-03-01_2026-06-15. */
export function periodSlug(period: ReportPeriod): string {
  switch (period.kind) {
    case 'month':
      return `${period.year}-${pad(period.month)}`;
    case 'quarter':
      return `${period.year}-Q${period.quarter}`;
    case 'year':
      return String(period.year);
    case 'custom':
      return period.start === period.end ? period.start : `${period.start}_${period.end}`;
  }
}

export function reportFilename(period: ReportPeriod): string {
  return `G3D-Operations-Report-${periodSlug(period)}.pdf`;
}

export function granularityFor(range: ReportRange): ReportGranularity {
  const days = rangeDays(range);
  if (days <= 31) return 'day';
  if (days <= 92) return 'week';
  return 'month';
}

export interface ReportBucket {
  /** Axis label: "6", "1 Sep", "Sep". */
  label: string;
  /** Standalone label: "6 Sep 2026", "Week of 1 Sep 2026", "Sep 2026". */
  longLabel: string;
  start: Date;
  end: Date;
}

/** Consecutive chart buckets covering the range exactly. Weeks are 7-day runs
 *  from the range start (the last may be shorter) rather than ISO weeks, so a
 *  bucket never reaches outside the period. */
export function periodBuckets(range: ReportRange): ReportBucket[] {
  const granularity = granularityFor(range);
  const buckets: ReportBucket[] = [];
  const spansYears = range.start.getFullYear() !== new Date(range.end.getTime() - 1).getFullYear();
  let cursor = range.start;
  while (cursor < range.end) {
    let next: Date;
    let label: string;
    let longLabel: string;
    if (granularity === 'day') {
      next = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      label = String(cursor.getDate());
      longLabel = formatReportDate(cursor);
    } else if (granularity === 'week') {
      next = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
      label = `${cursor.getDate()} ${shortMonthName(cursor.getMonth())}`;
      longLabel = `Week of ${formatReportDate(cursor)}`;
    } else {
      next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      label = spansYears
        ? `${shortMonthName(cursor.getMonth())} ${String(cursor.getFullYear()).slice(2)}`
        : shortMonthName(cursor.getMonth());
      longLabel = `${shortMonthName(cursor.getMonth())} ${cursor.getFullYear()}`;
    }
    if (next > range.end) next = range.end;
    buckets.push({ label, longLabel, start: cursor, end: next });
    cursor = next;
  }
  return buckets;
}

export function currentMonthPeriod(now: Date = new Date()): ReportPeriod {
  return { kind: 'month', year: now.getFullYear(), month: now.getMonth() + 1 };
}
