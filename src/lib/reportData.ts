import type { Hazard, HazardSeverity, Job, JobCategory, JobTag, Machine, Material } from '../types';
import { hazardSeverityLabel } from './hazards';
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
const HOUR_MS = 3_600_000;
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

export interface HazardRow {
  title: string;
  location: string;
  severity: HazardSeverity;
  severityLabel: string;
  /** The state at the end of the period, not necessarily today's. */
  statusLabel: string;
  reportedAt: Date;
  reportedByName: string;
  assignedToName: string;
  /** Only when it was resolved by the end of the period. */
  resolvedAt: Date | null;
  resolvedByName: string;
  resolutionNote: string;
  /** Calendar days it had been open at the end of the period; null once resolved. */
  daysOpen: number | null;
}

export interface HazardSeverityRow {
  severity: HazardSeverity;
  label: string;
  reported: number;
  resolved: number;
  openAtEnd: number;
}

export interface HazardSummary {
  reported: number;
  resolved: number;
  /** Unresolved at the end of the period (or now, for one in progress). */
  openAtEnd: number;
  /** Mean hours from report to resolution, over hazards resolved in the period. */
  meanResolveHours: number | null;
  bySeverity: HazardSeverityRow[];
  rows: HazardRow[];
}

export interface DowntimeIncidentRow {
  startedAt: Date;
  /** When it was repaired; null while the machine is still down. */
  endedAt: Date | null;
  /** Still down at the end of the period (or now, for one in progress). */
  ongoing: boolean;
  /** Calendar hours of this breakdown that fall inside the period. */
  hoursInPeriod: number;
  reason: string;
  reportedByName: string;
  /** Who repaired it; '' while it is still down. */
  repairedByName: string;
  assignedToName: string;
}

export interface MachineDowntimeRow {
  name: string;
  location: string;
  incidents: DowntimeIncidentRow[];
  hours: number;
  /** 0–1: the share of the period the machine was up; null for an empty period. */
  availability: number | null;
}

export interface DowntimeSummary {
  machines: MachineDowntimeRow[];
  totalIncidents: number;
  totalHours: number;
  /** Mean hours from breakdown to repair, over breakdowns repaired in the period. */
  meanRepairHours: number | null;
  stillDown: string[];
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
  downtime: DowntimeSummary;
  hazards: HazardSummary;
  appendix: AppendixRow[];
  /** Completed jobs with no `completedAt` at all, which no period can claim. */
  undatedCompletions: number;
}

export interface BuildReportInput {
  jobs: readonly Job[];
  materials: readonly Material[];
  machines: readonly Machine[];
  hazards: readonly Hazard[];
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

const SEVERITIES_WORST_FIRST: readonly HazardSeverity[] = ['critical', 'high', 'medium', 'low'];

/** Resolved by `asOf`. A resolved hazard with no resolution time is treated as
 *  already closed, since nothing says when it reopened. */
function closedBy(hazard: Hazard, asOf: Date): boolean {
  return hazard.status === 'resolved' && (hazard.resolvedAt === null || hazard.resolvedAt < asOf);
}

function buildHazards(
  hazards: readonly Hazard[],
  range: ReportRange,
  now: Date,
): HazardSummary {
  const asOf = asOfFor(range, now);
  // A future period has no "end of period" state to describe yet.
  const live = range.start < now;
  // A report still waiting on its server timestamp cannot be placed in time.
  const dated = hazards.filter((h) => h.createdAt !== null);
  const reportedIn = dated.filter((h) => inRange(h.createdAt, range));
  const resolvedIn = dated.filter(
    (h) => h.status === 'resolved' && inRange(h.resolvedAt, range),
  );
  const openAtEnd = live ? dated.filter((h) => h.createdAt! < asOf && !closedBy(h, asOf)) : [];

  const resolveHours = resolvedIn.map((h) =>
    Math.max(0, (h.resolvedAt!.getTime() - h.createdAt!.getTime()) / HOUR_MS),
  );

  const shown = new Set<Hazard>([...reportedIn, ...resolvedIn, ...openAtEnd]);
  const rows: HazardRow[] = [...shown]
    .map((h) => {
      const closed = closedBy(h, asOf);
      return {
        hazard: h,
        row: {
          title: h.title.trim(),
          location: h.location.trim(),
          severity: h.severity,
          severityLabel: hazardSeverityLabel(h.severity),
          statusLabel: closed ? 'Resolved' : h.status === 'inProgress' ? 'In progress' : 'Open',
          reportedAt: h.createdAt!,
          reportedByName: h.reportedByName.trim() || UNRECORDED_PERSON_LABEL,
          assignedToName: h.assignedToName.trim(),
          resolvedAt: closed ? h.resolvedAt : null,
          resolvedByName: closed ? h.resolvedByName.trim() : '',
          resolutionNote: closed ? h.resolutionNote.trim() : '',
          daysOpen: closed
            ? null
            : Math.max(0, calendarDaysBetween(h.createdAt!, new Date(asOf.getTime() - 1))),
        } satisfies HazardRow,
        open: !closed,
      };
    })
    .sort(
      (a, b) =>
        Number(b.open) - Number(a.open) ||
        SEVERITIES_WORST_FIRST.indexOf(a.row.severity) -
          SEVERITIES_WORST_FIRST.indexOf(b.row.severity) ||
        a.row.reportedAt.getTime() - b.row.reportedAt.getTime() ||
        compareText(a.row.title, b.row.title),
    )
    .map((entry) => entry.row);

  return {
    reported: reportedIn.length,
    resolved: resolvedIn.length,
    openAtEnd: openAtEnd.length,
    meanResolveHours:
      resolveHours.length === 0
        ? null
        : resolveHours.reduce((sum, v) => sum + v, 0) / resolveHours.length,
    bySeverity: SEVERITIES_WORST_FIRST.map((severity) => ({
      severity,
      label: hazardSeverityLabel(severity),
      reported: reportedIn.filter((h) => h.severity === severity).length,
      resolved: resolvedIn.filter((h) => h.severity === severity).length,
      openAtEnd: openAtEnd.filter((h) => h.severity === severity).length,
    })),
    rows,
  };
}

interface RawIncident {
  start: Date;
  /** null while the machine is still down. */
  end: Date | null;
  reason: string;
  reportedByName: string;
  repairedByName: string;
  assignedToName: string;
}

/** Every breakdown of a machine: the repaired ones in its history, plus the
 *  current one if it is down right now. */
function incidentsOf(machine: Machine): RawIncident[] {
  const repaired: RawIncident[] = machine.downtimeHistory.map((r) => ({
    start: r.downSince,
    end: r.repairedAt,
    reason: r.reason,
    reportedByName: r.reportedByName,
    repairedByName: r.repairedByName,
    assignedToName: r.assignedToName,
  }));
  if (machine.status === 'down' && machine.downSince) {
    repaired.push({
      start: machine.downSince,
      end: null,
      reason: machine.downReason,
      reportedByName: machine.downReportedByName,
      repairedByName: '',
      assignedToName: machine.repairAssignedToName,
    });
  }
  return repaired;
}

function buildDowntime(
  machines: readonly Machine[],
  range: ReportRange,
  now: Date,
): DowntimeSummary {
  const asOf = asOfFor(range, now);
  const elapsedMs = asOf.getTime() - range.start.getTime();
  const repairHours: number[] = [];

  const rows: MachineDowntimeRow[] = [...machines]
    .sort((a, b) => compareText(a.name, b.name))
    .map((machine) => {
      const incidents = incidentsOf(machine)
        // Overlaps the period: started before it ends and was still down after it
        // began. A breakdown that is still open counts as down until `asOf`.
        .filter((i) => i.start < asOf && (i.end ?? asOf) > range.start)
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .map((i) => {
          const from = Math.max(i.start.getTime(), range.start.getTime());
          const to = Math.min((i.end ?? asOf).getTime(), asOf.getTime());
          if (i.end !== null && inRange(i.end, range)) {
            repairHours.push((i.end.getTime() - i.start.getTime()) / HOUR_MS);
          }
          return {
            ms: Math.max(0, to - from),
            row: {
              startedAt: i.start,
              endedAt: i.end,
              ongoing: i.end === null || i.end >= asOf,
              hoursInPeriod: Math.max(0, to - from) / HOUR_MS,
              reason: i.reason.trim(),
              reportedByName: i.reportedByName.trim() || UNRECORDED_PERSON_LABEL,
              repairedByName: i.repairedByName.trim(),
              assignedToName: i.assignedToName.trim(),
            } satisfies DowntimeIncidentRow,
          };
        });
      const downMs = incidents.reduce((sum, i) => sum + i.ms, 0);
      return {
        name: machine.name,
        location: machine.location,
        incidents: incidents.map((i) => i.row),
        hours: downMs / HOUR_MS,
        availability: elapsedMs > 0 ? Math.max(0, 1 - downMs / elapsedMs) : null,
      };
    })
    .filter((row) => row.incidents.length > 0);

  // Summed from milliseconds, once, so the total never depends on the order
  // the rows happen to be added in.
  const totalMs = rows.reduce(
    (sum, r) => sum + Math.round(r.hours * HOUR_MS),
    0,
  );
  return {
    machines: rows,
    totalIncidents: rows.reduce((sum, r) => sum + r.incidents.length, 0),
    totalHours: totalMs / HOUR_MS,
    meanRepairHours:
      repairHours.length === 0
        ? null
        : repairHours.reduce((sum, v) => sum + v, 0) / repairHours.length,
    stillDown: rows.filter((r) => r.incidents.some((i) => i.ongoing)).map((r) => r.name),
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
  const { jobs, materials, machines, hazards, period, now, generatedBy } = input;
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
    downtime: buildDowntime(machines, range, now),
    hazards: buildHazards(hazards, range, now),
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
    downtime: {
      ...report.downtime,
      totalHours: num(report.downtime.totalHours),
      meanRepairHours: num(report.downtime.meanRepairHours),
      machines: report.downtime.machines.map((m) => ({
        ...m,
        hours: num(m.hours),
        availability: num(m.availability),
        incidents: m.incidents.map((i) => ({
          ...i,
          startedAt: date(i.startedAt),
          endedAt: date(i.endedAt),
          hoursInPeriod: num(i.hoursInPeriod),
        })),
      })),
    },
    hazards: {
      ...report.hazards,
      meanResolveHours: num(report.hazards.meanResolveHours),
      rows: report.hazards.rows.map((r) => ({
        ...r,
        reportedAt: date(r.reportedAt),
        resolvedAt: date(r.resolvedAt),
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
