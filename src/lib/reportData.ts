import type { Job, JobCategory, JobTag, Machine, Material } from '../types';
import { JOB_CATEGORY_OPTIONS } from './jobCategories';
import { materialsConsumed } from './jobTags';
import {
  granularityFor,
  periodBuckets,
  periodLabel,
  periodRange,
  previousPeriod,
  type ReportGranularity,
  type ReportPeriod,
  type ReportRange,
} from './reportPeriods';

/** Everything an operations report says, computed once from the jobs,
 *  inventory, and machines the workspace already streams. Pure and
 *  timezone-local so it can be unit tested and mirrored line for line by the
 *  mobile app (lib/reports/report_data.dart); the shared fixture in
 *  src/test/fixtures/report-fixture.json keeps the two ports honest.
 *
 *  A job counts as completed in a period only when its status is `completed`
 *  and its `completedAt` falls inside the range. A restored job can keep a
 *  stale `completedAt` while pending again, and must not inflate output. */

const DAY_MS = 86_400_000;
const TOP_CUSTOMER_LIMIT = 10;
export const NO_CUSTOMER_LABEL = 'No customer';
export const UNRECORDED_PERSON_LABEL = 'Unrecorded';

export interface ReportKpis {
  completed: number;
  units: number;
  received: number;
  /** 0–1, or null when nothing completed. */
  onTimeRate: number | null;
  medianTurnaroundDays: number | null;
  openOverdue: number;
}

export interface ThroughputBucket {
  label: string;
  longLabel: string;
  received: number;
  completed: number;
}

export interface CategoryRow {
  category: JobCategory;
  label: string;
  jobs: number;
  units: number;
  onTimeRate: number | null;
  medianTurnaroundDays: number | null;
}

export interface CustomerRow {
  name: string;
  jobs: number;
  units: number;
  onTimeRate: number | null;
}

export interface TeamRow {
  name: string;
  /** Jobs this person marked complete. */
  completed: number;
  /** Completed jobs they were assigned to or collaborated on. */
  contributed: number;
  units: number;
  onTimeRate: number | null;
}

export interface LateJobRow {
  orderNumber: string;
  name: string;
  customer: string;
  dueDate: Date;
  completedAt: Date;
  daysLate: number;
}

export interface OverdueJobRow {
  orderNumber: string;
  name: string;
  customer: string;
  dueDate: Date;
  daysOverdue: number;
  assignedToName: string;
}

export interface RescheduleRow {
  orderNumber: string;
  name: string;
  changedAt: Date;
  previousDueDate: Date | null;
  dueDate: Date;
  note: string;
  changedByName: string;
}

export interface MaterialUseRow {
  material: string;
  unit: string;
  units: number;
}

export interface StockRow {
  name: string;
  unit: string;
  quantity: number;
  totalQuantity: number;
  ratio: number;
  low: boolean;
}

export interface MaintenanceServiceRow {
  completedAt: Date;
  procedures: string[];
  completedByName: string;
  notes: string;
}

export interface MachineMaintenanceRow {
  name: string;
  location: string;
  services: MaintenanceServiceRow[];
}

export interface AppendixRow {
  orderNumber: string;
  name: string;
  customer: string;
  categoryLabel: string;
  quantity: number;
  completedAt: Date;
  dueDate: Date;
  onTime: boolean;
}

export interface ReportData {
  title: string;
  periodLabel: string;
  previousPeriodLabel: string;
  rangeStart: Date;
  /** Last day inside the period (inclusive), for display. */
  rangeLastDay: Date;
  generatedAt: Date;
  generatedBy: string;
  /** Whether `generatedAt` falls inside the period (e.g. the current month). */
  inProgress: boolean;
  kpis: ReportKpis;
  previousKpis: ReportKpis;
  throughput: { granularity: ReportGranularity; buckets: ThroughputBucket[] };
  categories: CategoryRow[];
  customers: {
    rows: CustomerRow[];
    totalCustomers: number;
    otherCustomers: number;
    otherJobs: number;
  };
  team: TeamRow[];
  delivery: {
    late: LateJobRow[];
    overdue: OverdueJobRow[];
    reschedules: RescheduleRow[];
  };
  materials: { consumed: MaterialUseRow[]; stock: StockRow[] };
  maintenance: {
    machines: MachineMaintenanceRow[];
    totalServices: number;
    idleMachines: string[];
  };
  appendix: AppendixRow[];
  /** Completed jobs with no `completedAt` at all, which no period can claim. */
  undatedCompletions: number;
}

export interface BuildReportInput {
  jobs: readonly Job[];
  materials: readonly Material[];
  machines: readonly Machine[];
  period: ReportPeriod;
  now: Date;
  generatedBy: string;
}

function inRange(d: Date | null, range: ReportRange): d is Date {
  return d !== null && d >= range.start && d < range.end;
}

/** Plain code-unit ordering, case-insensitive. Deliberately not
 *  localeCompare, whose collation differs between JS engines and Dart. */
export function compareText(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

export function isOnTime(job: Job): boolean {
  return job.completedAt !== null && job.completedAt.getTime() <= job.dueDate.getTime();
}

function turnaroundDays(job: Job): number | null {
  if (!job.createdAt || !job.completedAt) return null;
  return Math.max(0, (job.completedAt.getTime() - job.createdAt.getTime()) / DAY_MS);
}

function turnarounds(jobs: readonly Job[]): number[] {
  return jobs.map(turnaroundDays).filter((d): d is number => d !== null);
}

export function completedInRange(jobs: readonly Job[], range: ReportRange): Job[] {
  return jobs
    .filter((j) => j.status === 'completed' && inRange(j.completedAt, range))
    .sort((a, b) => a.completedAt!.getTime() - b.completedAt!.getTime() || compareText(a.id, b.id));
}

/** Jobs that were open and past their deadline at `asOf`: created before it
 *  and not completed before it. */
function overdueAt(jobs: readonly Job[], asOf: Date): Job[] {
  return jobs.filter((j) => {
    if (j.createdAt && j.createdAt >= asOf) return false;
    const closed = j.status === 'completed' && (j.completedAt === null || j.completedAt < asOf);
    return !closed && j.dueDate < asOf;
  });
}

function asOfFor(range: ReportRange, now: Date): Date {
  return range.end < now ? range.end : now;
}

function kpisFor(jobs: readonly Job[], range: ReportRange, now: Date): ReportKpis {
  const done = completedInRange(jobs, range);
  return {
    completed: done.length,
    units: done.reduce((sum, j) => sum + j.quantity, 0),
    received: jobs.filter((j) => inRange(j.createdAt, range)).length,
    onTimeRate: ratio(done.filter(isOnTime).length, done.length),
    medianTurnaroundDays: median(turnarounds(done)),
    openOverdue: range.start < now ? overdueAt(jobs, asOfFor(range, now)).length : 0,
  };
}

function customerKey(customer: string): string {
  return customer.trim().toLowerCase();
}

function customerName(customer: string): string {
  return customer.trim() || NO_CUSTOMER_LABEL;
}

/** The spelling most jobs used. Ties go to the lowest code-unit order, which
 *  puts "Island Grill" ahead of "island grill". */
function preferredSpelling(spellings: Map<string, number>): string {
  return [...spellings].sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))[0][0];
}

function buildCustomers(done: readonly Job[]): ReportData['customers'] {
  const rows = new Map<string, { spellings: Map<string, number>; jobs: Job[] }>();
  for (const job of done) {
    const key = customerKey(job.customer);
    const row = rows.get(key) ?? { spellings: new Map<string, number>(), jobs: [] };
    const spelling = customerName(job.customer);
    row.spellings.set(spelling, (row.spellings.get(spelling) ?? 0) + 1);
    row.jobs.push(job);
    rows.set(key, row);
  }
  const all: CustomerRow[] = [...rows.values()]
    .map(({ spellings, jobs }) => ({
      name: preferredSpelling(spellings),
      jobs: jobs.length,
      units: jobs.reduce((sum, j) => sum + j.quantity, 0),
      onTimeRate: ratio(jobs.filter(isOnTime).length, jobs.length),
    }))
    .sort((a, b) => b.jobs - a.jobs || b.units - a.units || compareText(a.name, b.name));
  const top = all.slice(0, TOP_CUSTOMER_LIMIT);
  const rest = all.slice(TOP_CUSTOMER_LIMIT);
  return {
    rows: top,
    totalCustomers: all.length,
    otherCustomers: rest.length,
    otherJobs: rest.reduce((sum, r) => sum + r.jobs, 0),
  };
}

function buildTeam(done: readonly Job[]): TeamRow[] {
  interface Acc {
    name: string;
    completed: number;
    contributed: Job[];
  }
  const people = new Map<string, Acc>();
  const person = (uid: string, name: string): Acc => {
    const key = uid || `name:${name.trim().toLowerCase()}`;
    let acc = people.get(key);
    if (!acc) {
      acc = { name: name.trim() || UNRECORDED_PERSON_LABEL, completed: 0, contributed: [] };
      people.set(key, acc);
    }
    return acc;
  };

  for (const job of done) {
    if (job.completedByUid || job.completedByName.trim()) {
      person(job.completedByUid, job.completedByName).completed += 1;
    }
    const contributors = new Map<string, string>();
    if (job.assignedToUid) contributors.set(job.assignedToUid, job.assignedToName);
    for (const c of job.collaborators) contributors.set(c.uid, c.name);
    for (const [uid, name] of contributors) {
      if (uid) person(uid, name).contributed.push(job);
    }
  }

  return [...people.values()]
    .map(({ name, completed, contributed }) => ({
      name,
      completed,
      contributed: contributed.length,
      units: contributed.reduce((sum, j) => sum + j.quantity, 0),
      onTimeRate: ratio(contributed.filter(isOnTime).length, contributed.length),
    }))
    .sort(
      (a, b) =>
        b.contributed - a.contributed || b.completed - a.completed || compareText(a.name, b.name),
    );
}

/** Replays every completion in order, exactly as completeJob would have seen
 *  the shop's running per-tag totals, and keeps the demand from completions
 *  inside the range. Undated completions replay first: they predate
 *  `completedAt`, so they were already counted when dated jobs completed. */
function buildMaterialUse(
  jobs: readonly Job[],
  materials: readonly Material[],
  range: ReportRange,
): MaterialUseRow[] {
  const completed = jobs.filter((j) => j.status === 'completed');
  const undated = completed
    .filter((j) => j.completedAt === null)
    .sort((a, b) => compareText(a.id, b.id));
  const dated = completed
    .filter((j) => j.completedAt !== null)
    .sort((a, b) => a.completedAt!.getTime() - b.completedAt!.getTime() || compareText(a.id, b.id));

  const running = new Map<JobTag, number>();
  const used = new Map<string, number>();
  for (const job of [...undated, ...dated]) {
    const demand = materialsConsumed(job.tags, job.quantity, (tag) => running.get(tag) ?? 0);
    if (inRange(job.completedAt, range)) {
      for (const d of demand) used.set(d.material, (used.get(d.material) ?? 0) + d.units);
    }
    for (const tag of job.tags) running.set(tag, (running.get(tag) ?? 0) + job.quantity);
  }

  const unitFor = (material: string) =>
    materials.find((m) => m.name.trim().toLowerCase() === material.trim().toLowerCase())?.unit ??
    '';
  return [...used]
    .map(([material, units]) => ({ material, unit: unitFor(material), units }))
    .sort((a, b) => b.units - a.units || compareText(a.material, b.material));
}

/** Mirrors stockRatio in services/inventoryService.ts. */
function stockRatio(m: Material): number {
  return m.totalQuantity > 0 ? Math.max(0, Math.min(1, m.quantity / m.totalQuantity)) : 0;
}

function buildStock(materials: readonly Material[]): StockRow[] {
  return materials
    .map((m) => {
      const r = stockRatio(m);
      return {
        name: m.name,
        unit: m.unit,
        quantity: m.quantity,
        totalQuantity: m.totalQuantity,
        ratio: r,
        // Mirrors isLowStock in services/inventoryService.ts, kept local so this
        // module stays free of Firebase imports.
        low: m.totalQuantity > 0 && m.quantity / m.totalQuantity < 0.3,
      };
    })
    .sort((a, b) => a.ratio - b.ratio || compareText(a.name, b.name));
}

function buildMaintenance(
  machines: readonly Machine[],
  range: ReportRange,
): ReportData['maintenance'] {
  const rows = [...machines]
    .sort((a, b) => compareText(a.name, b.name))
    .map((machine) => ({
      name: machine.name,
      location: machine.location,
      services: machine.maintenanceHistory
        .filter((record) => inRange(record.completedAt, range))
        .map((record) => ({
          completedAt: record.completedAt!,
          procedures: [...record.procedureTitles],
          completedByName: record.completedByName.trim() || UNRECORDED_PERSON_LABEL,
          notes: record.notes.trim(),
        }))
        .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime()),
    }));
  return {
    machines: rows,
    totalServices: rows.reduce((sum, r) => sum + r.services.length, 0),
    idleMachines: rows.filter((r) => r.services.length === 0).map((r) => r.name),
  };
}

/** Calendar days from one local date to another, ignoring time of day: due
 *  on the 12th and completed on the 15th is 3 days late at any hour. */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function buildReport(input: BuildReportInput): ReportData {
  const { jobs, materials, machines, period, now, generatedBy } = input;
  const range = periodRange(period);
  const previous = previousPeriod(period);
  const previousRange = periodRange(previous);
  const done = completedInRange(jobs, range);
  const asOf = asOfFor(range, now);

  const buckets = periodBuckets(range).map((bucket) => ({
    label: bucket.label,
    longLabel: bucket.longLabel,
    received: jobs.filter((j) => inRange(j.createdAt, bucket)).length,
    completed: done.filter((j) => inRange(j.completedAt, bucket)).length,
  }));

  const categories: CategoryRow[] = JOB_CATEGORY_OPTIONS.map(({ value, label }) => {
    const inCategory = done.filter((j) => j.category === value);
    return {
      category: value,
      label,
      jobs: inCategory.length,
      units: inCategory.reduce((sum, j) => sum + j.quantity, 0),
      onTimeRate: ratio(inCategory.filter(isOnTime).length, inCategory.length),
      medianTurnaroundDays: median(turnarounds(inCategory)),
    };
  })
    .filter((row) => row.jobs > 0)
    .sort((a, b) => b.jobs - a.jobs || b.units - a.units);

  const late: LateJobRow[] = done
    .filter((j) => !isOnTime(j))
    .map((j) => ({
      orderNumber: j.orderNumber,
      name: j.name,
      customer: customerName(j.customer),
      dueDate: j.dueDate,
      completedAt: j.completedAt!,
      daysLate: Math.max(1, calendarDaysBetween(j.dueDate, j.completedAt!)),
    }))
    .sort((a, b) => b.daysLate - a.daysLate || compareText(a.orderNumber, b.orderNumber));

  const overdue: OverdueJobRow[] = (range.start < now ? overdueAt(jobs, asOf) : [])
    .map((j) => ({
      orderNumber: j.orderNumber,
      name: j.name,
      customer: customerName(j.customer),
      dueDate: j.dueDate,
      // asOf is the instant after the period's last moment; count to that day.
      daysOverdue: Math.max(1, calendarDaysBetween(j.dueDate, new Date(asOf.getTime() - 1))),
      assignedToName: j.assignedToName.trim(),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue || compareText(a.orderNumber, b.orderNumber));

  const reschedules: RescheduleRow[] = jobs
    .filter((j) => inRange(j.dueDateChangedAt, range))
    .map((j) => ({
      orderNumber: j.orderNumber,
      name: j.name,
      changedAt: j.dueDateChangedAt!,
      previousDueDate: j.previousDueDate,
      dueDate: j.dueDate,
      note: j.dueDateChangeNote.trim(),
      changedByName: j.dueDateChangedByName.trim() || UNRECORDED_PERSON_LABEL,
    }))
    .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());

  const categoryLabels = new Map(JOB_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

  return {
    title: 'Operations Report',
    periodLabel: periodLabel(period),
    previousPeriodLabel: periodLabel(previous),
    rangeStart: range.start,
    rangeLastDay: new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() - 1),
    generatedAt: now,
    generatedBy,
    inProgress: range.start <= now && range.end > now,
    kpis: kpisFor(jobs, range, now),
    previousKpis: kpisFor(jobs, previousRange, now),
    throughput: { granularity: granularityFor(range), buckets },
    categories,
    customers: buildCustomers(done),
    team: buildTeam(done),
    delivery: { late, overdue, reschedules },
    materials: { consumed: buildMaterialUse(jobs, materials, range), stock: buildStock(materials) },
    maintenance: buildMaintenance(machines, range),
    appendix: done.map((j) => ({
      orderNumber: j.orderNumber,
      name: j.name,
      customer: customerName(j.customer),
      categoryLabel: categoryLabels.get(j.category) ?? j.category,
      quantity: j.quantity,
      completedAt: j.completedAt!,
      dueDate: j.dueDate,
      onTime: isOnTime(j),
    })),
    undatedCompletions: jobs.filter((j) => j.status === 'completed' && j.completedAt === null)
      .length,
  };
}

/** Stable JSON shape of a report, with dates as local `YYYY-MM-DDTHH:mm:ss`
 *  and ratios rounded to 4 places — the contract the web/mobile parity
 *  fixture is checked against. */
export function reportToJson(report: ReportData): unknown {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = (d: Date | null) =>
    d === null
      ? null
      : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
          d.getMinutes(),
        )}:${pad(d.getSeconds())}`;
  const num = (n: number | null) => (n === null ? null : Math.round(n * 10_000) / 10_000);
  const kpis = (k: ReportKpis) => ({
    ...k,
    onTimeRate: num(k.onTimeRate),
    medianTurnaroundDays: num(k.medianTurnaroundDays),
  });
  return {
    title: report.title,
    periodLabel: report.periodLabel,
    previousPeriodLabel: report.previousPeriodLabel,
    rangeStart: date(report.rangeStart),
    rangeLastDay: date(report.rangeLastDay),
    generatedAt: date(report.generatedAt),
    generatedBy: report.generatedBy,
    inProgress: report.inProgress,
    kpis: kpis(report.kpis),
    previousKpis: kpis(report.previousKpis),
    throughput: report.throughput,
    categories: report.categories.map((c) => ({
      ...c,
      onTimeRate: num(c.onTimeRate),
      medianTurnaroundDays: num(c.medianTurnaroundDays),
    })),
    customers: {
      ...report.customers,
      rows: report.customers.rows.map((c) => ({ ...c, onTimeRate: num(c.onTimeRate) })),
    },
    team: report.team.map((t) => ({ ...t, onTimeRate: num(t.onTimeRate) })),
    delivery: {
      late: report.delivery.late.map((r) => ({
        ...r,
        dueDate: date(r.dueDate),
        completedAt: date(r.completedAt),
      })),
      overdue: report.delivery.overdue.map((r) => ({ ...r, dueDate: date(r.dueDate) })),
      reschedules: report.delivery.reschedules.map((r) => ({
        ...r,
        changedAt: date(r.changedAt),
        previousDueDate: date(r.previousDueDate),
        dueDate: date(r.dueDate),
      })),
    },
    materials: {
      consumed: report.materials.consumed,
      stock: report.materials.stock.map((s) => ({ ...s, ratio: num(s.ratio) })),
    },
    maintenance: {
      ...report.maintenance,
      machines: report.maintenance.machines.map((m) => ({
        ...m,
        services: m.services.map((s) => ({ ...s, completedAt: date(s.completedAt) })),
      })),
    },
    appendix: report.appendix.map((r) => ({
      ...r,
      completedAt: date(r.completedAt),
      dueDate: date(r.dueDate),
    })),
    undatedCompletions: report.undatedCompletions,
  };
}
