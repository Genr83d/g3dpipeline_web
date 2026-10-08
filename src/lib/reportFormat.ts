import type { ReportData, ReportKpis } from './reportData';

/** Number formatting for reports. Hand-rolled rather than Intl so the PDF
 *  reads the same in every browser locale and matches the mobile port. */

/** 1234567 → "1,234,567"; decimals keep up to 2 places without trailing zeros. */
export function formatCount(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const negative = rounded < 0;
  const [whole, fraction] = Math.abs(rounded).toString().split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** 0.9375 → "94%"; null → "—". */
export function formatPercent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

/** 3.25 → "3.3 d", 0.4 → "0.4 d"; null → "—". */
export function formatDays(days: number | null): string {
  return days === null ? '—' : `${(Math.round(days * 10) / 10).toFixed(1)} d`;
}

export type KpiKey = keyof ReportKpis;

/** Whether an increase in this KPI is good news, bad news, or neither. */
const KPI_DIRECTION: Record<KpiKey, 'up' | 'down' | 'neutral'> = {
  completed: 'up',
  units: 'up',
  received: 'neutral',
  onTimeRate: 'up',
  medianTurnaroundDays: 'down',
  openOverdue: 'down',
};

export interface KpiDelta {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/** Change against the previous period, e.g. "↑ 12" or "↓ 4 pts". Null when
 *  either side has no value to compare. */
export function kpiDelta(key: KpiKey, current: ReportKpis, previous: ReportKpis): KpiDelta | null {
  const a = current[key];
  const b = previous[key];
  if (a === null || b === null) return null;
  let diff: number;
  let text: string;
  if (key === 'onTimeRate') {
    diff = Math.round(a * 100) - Math.round(b * 100);
    text = `${Math.abs(diff)} pts`;
  } else if (key === 'medianTurnaroundDays') {
    diff = Math.round(a * 10) / 10 - Math.round(b * 10) / 10;
    diff = Math.round(diff * 10) / 10;
    text = `${Math.abs(diff).toFixed(1)} d`;
  } else {
    diff = a - b;
    text = formatCount(Math.abs(diff));
  }
  if (diff === 0) return { text: 'No change', tone: 'neutral' };
  const direction = KPI_DIRECTION[key];
  const tone =
    direction === 'neutral' ? 'neutral' : (diff > 0) === (direction === 'up') ? 'good' : 'bad';
  return { text: `${diff > 0 ? '↑' : '↓'} ${text}`, tone };
}

export const KPI_LABELS: Record<KpiKey, string> = {
  completed: 'Jobs completed',
  units: 'Units produced',
  received: 'Jobs received',
  onTimeRate: 'On-time delivery',
  medianTurnaroundDays: 'Median turnaround',
  openOverdue: 'Overdue at period end',
};

export const KPI_ORDER: readonly KpiKey[] = [
  'completed',
  'units',
  'received',
  'onTimeRate',
  'medianTurnaroundDays',
  'openOverdue',
];

export function formatKpi(key: KpiKey, kpis: ReportKpis): string {
  if (key === 'onTimeRate') return formatPercent(kpis.onTimeRate);
  if (key === 'medianTurnaroundDays') return formatDays(kpis.medianTurnaroundDays);
  return formatCount(kpis[key]);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

/** The report's opening line in plain language, e.g. "The shop completed 42
 *  jobs (1,240 units) for 18 customers, 93% of them on time. 47 new jobs came
 *  in and 3 were overdue at the end of the period." */
export function reportSummarySentence(report: ReportData): string {
  const { kpis } = report;
  const n = kpis.openOverdue;
  const verb = report.inProgress ? (n === 1 ? 'is' : 'are') : n === 1 ? 'was' : 'were';
  const when = report.inProgress ? 'right now' : 'at the end of the period';
  const overdue = `${n === 0 ? 'nothing' : plural(n, 'job')} ${n === 0 ? (report.inProgress ? 'is' : 'was') : verb} overdue ${when}`;
  const received = `${plural(kpis.received, 'new job')} came in`;
  if (kpis.completed === 0) {
    return `No jobs were completed in this period. ${capitalize(received)} and ${overdue}.`;
  }
  const customers = report.customers.totalCustomers;
  const onTime =
    kpis.onTimeRate === null ? '' : `, ${formatPercent(kpis.onTimeRate)} of them on time`;
  return (
    `The shop completed ${plural(kpis.completed, 'job')} (${plural(kpis.units, 'unit')}) ` +
    `for ${plural(customers, 'customer')}${onTime}. ${capitalize(received)} and ${overdue}.`
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
