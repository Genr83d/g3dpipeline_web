import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useInventoryOutlet, useJobsOutlet, useMachinesOutlet } from '../routes/Workspace';
import { useToast } from '../components/Toast';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Skeleton, StatCardSkeleton } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { IconCloudOff, IconDownload } from '../components/icons';
import { errorMessage } from '../lib/format';
import { buildReport, type ReportData } from '../lib/reportData';
import {
  KPI_LABELS,
  KPI_ORDER,
  formatCount,
  formatKpi,
  kpiDelta,
  reportSummarySentence,
  type KpiKey,
} from '../lib/reportFormat';
import {
  MONTH_NAMES,
  dayKey,
  formatReportDate,
  periodLabel,
  periodRange,
  reportFilename,
  type ReportPeriod,
} from '../lib/reportPeriods';
import type { Job } from '../types';

type PeriodKind = ReportPeriod['kind'];

const KIND_OPTIONS: ReadonlyArray<{ value: PeriodKind; label: string }> = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

/** Every year with recorded activity, newest first, always including this one. */
function reportYears(jobs: readonly Job[], now: Date): number[] {
  let earliest = now.getFullYear();
  for (const job of jobs) {
    for (const d of [job.createdAt, job.completedAt]) {
      if (d && d.getFullYear() < earliest) earliest = d.getFullYear();
    }
  }
  const years: number[] = [];
  for (let y = now.getFullYear(); y >= earliest; y--) years.push(y);
  return years;
}

export default function Reports() {
  const jobsState = useJobsOutlet();
  const inventoryState = useInventoryOutlet();
  const machinesState = useMachinesOutlet();
  const { profile } = useAuth();
  const { toast } = useToast();

  // Pinned for the life of the page so the pickers' bounds don't drift.
  const [today] = useState(() => new Date());
  const [kind, setKind] = useState<PeriodKind>('month');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(today.getMonth() / 3) + 1);
  const [customStart, setCustomStart] = useState(() =>
    dayKey(new Date(today.getFullYear(), today.getMonth(), 1)),
  );
  const [customEnd, setCustomEnd] = useState(() => dayKey(today));
  const [busy, setBusy] = useState(false);

  const loading = jobsState.loading || inventoryState.loading || machinesState.loading;
  const loadError = jobsState.error ?? inventoryState.error ?? machinesState.error;
  const retry = () => {
    if (jobsState.error) jobsState.retry();
    if (inventoryState.error) inventoryState.retry();
    if (machinesState.error) machinesState.retry();
  };

  const years = useMemo(() => reportYears(jobsState.jobs, today), [jobsState.jobs, today]);
  const lastMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12;
  const lastQuarter = year === today.getFullYear() ? Math.floor(today.getMonth() / 3) + 1 : 4;

  const customError =
    !customStart || !customEnd
      ? 'Choose both a start and an end date.'
      : customStart > customEnd
        ? 'The start date must be on or before the end date.'
        : customStart > dayKey(today)
          ? 'The range cannot start in the future.'
          : null;

  const period = useMemo<ReportPeriod | null>(() => {
    switch (kind) {
      case 'month':
        return { kind, year, month: Math.min(month, lastMonth) };
      case 'quarter':
        return { kind, year, quarter: Math.min(quarter, lastQuarter) };
      case 'year':
        return { kind, year };
      case 'custom':
        return customError ? null : { kind, start: customStart, end: customEnd };
    }
  }, [kind, year, month, lastMonth, quarter, lastQuarter, customError, customStart, customEnd]);

  const generatedBy = profile?.name?.trim() || profile?.email || 'GENR8 Pipeline';

  const report = useMemo<ReportData | null>(
    () =>
      period && !loading && !loadError
        ? buildReport({
            jobs: jobsState.jobs,
            materials: inventoryState.materials,
            machines: machinesState.machines,
            period,
            now: new Date(),
            generatedBy,
          })
        : null,
    [period, loading, loadError, jobsState.jobs, inventoryState.materials, machinesState.machines, generatedBy],
  );

  async function handleDownload() {
    if (!period) return;
    setBusy(true);
    try {
      // Rebuilt at the moment of download so "Issued" and "overdue now" are
      // exact, and the PDF engine only loads when someone asks for a PDF.
      const fresh = buildReport({
        jobs: jobsState.jobs,
        materials: inventoryState.materials,
        machines: machinesState.machines,
        period,
        now: new Date(),
        generatedBy,
      });
      const { renderReportPdf, saveBlob } = await import('../reports/renderReportPdf');
      const blob = await renderReportPdf(fresh);
      saveBlob(blob, reportFilename(period));
      toast(`${periodLabel(period)} report downloaded.`, 'success');
    } catch (err) {
      toast(`Couldn't create the report. ${errorMessage(err)}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  const downloadButton = (
    <button
      type="button"
      className="btn-primary w-full sm:w-auto"
      onClick={handleDownload}
      disabled={!report || busy}
      data-testid="download-report"
    >
      {busy ? (
        <>
          <Spinner className="h-4 w-4 border-2 border-white/30 border-t-white" />
          Preparing PDF…
        </>
      ) : (
        <>
          <IconDownload className="h-4 w-4" />
          Download PDF
        </>
      )}
    </button>
  );

  return (
    <div className="space-y-6" data-tour="reports-page">
      <PageHeader
        title="Reports"
        subtitle="Download an operations report for any month, quarter, year, or date range."
      />

      {loading ? (
        <>
          <Skeleton className="h-36" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        </>
      ) : loadError ? (
        <EmptyState
          tone="danger"
          icon={<IconCloudOff className="h-7 w-7" />}
          title="Unable to load report data"
          subtitle={loadError}
          action={<button className="btn-secondary" onClick={retry}>Retry</button>}
        />
      ) : (
        <>
          <section aria-labelledby="report-period-heading" className="surface space-y-4 p-4 sm:p-5">
            <h2 id="report-period-heading" className="technical-label">
              Report period
            </h2>

            <div
              role="radiogroup"
              aria-label="Period type"
              className="grid grid-cols-4 gap-0 rounded border border-slate-200/70 bg-white/45 p-1 dark:border-slate-800/80 dark:bg-slate-900/55 sm:inline-grid"
            >
              {KIND_OPTIONS.map((option) => {
                const active = kind === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setKind(option.value)}
                    className={`rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none sm:px-5 ${
                      active
                        ? 'bg-primary text-white shadow-sm hc:outline-2 hc:outline-current'
                        : 'text-slate-600 hover:text-ink dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,14rem))]">
              {kind === 'custom' ? (
                <>
                  <label className="block">
                    <span className="technical-label mb-1 block">From</span>
                    <input
                      type="date"
                      className="field"
                      value={customStart}
                      max={dayKey(today)}
                      aria-invalid={customError ? true : undefined}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="technical-label mb-1 block">To</span>
                    <input
                      type="date"
                      className="field"
                      value={customEnd}
                      min={customStart || undefined}
                      aria-invalid={customError ? true : undefined}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <>
                  {kind === 'month' && (
                    <label className="block">
                      <span className="technical-label mb-1 block">Month</span>
                      <select
                        className="field"
                        value={Math.min(month, lastMonth)}
                        onChange={(e) => setMonth(Number(e.target.value))}
                      >
                        {MONTH_NAMES.slice(0, lastMonth).map((name, i) => (
                          <option key={name} value={i + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {kind === 'quarter' && (
                    <label className="block">
                      <span className="technical-label mb-1 block">Quarter</span>
                      <select
                        className="field"
                        value={Math.min(quarter, lastQuarter)}
                        onChange={(e) => setQuarter(Number(e.target.value))}
                      >
                        {[1, 2, 3, 4].slice(0, lastQuarter).map((q) => (
                          <option key={q} value={q}>
                            Q{q} · {MONTH_NAMES[(q - 1) * 3].slice(0, 3)}–{MONTH_NAMES[(q - 1) * 3 + 2].slice(0, 3)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="block">
                    <span className="technical-label mb-1 block">Year</span>
                    <select className="field" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>

            {kind === 'custom' && customError && (
              <p role="alert" className="text-sm font-medium text-danger dark:text-red-300">
                {customError}
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/80">
              <p className="min-w-0 text-sm text-slate-600 dark:text-slate-300">
                {period ? (
                  <>
                    <span className="font-semibold text-ink dark:text-slate-50">{periodLabel(period)}</span>
                    <span className="readout ml-2 text-xs text-slate-500 dark:text-slate-400">
                      {rangeText(period)}
                    </span>
                  </>
                ) : (
                  'Choose a valid range to preview the report.'
                )}
              </p>
              {downloadButton}
            </div>
          </section>

          {report && <ReportPreview report={report} />}
        </>
      )}
    </div>
  );
}

function rangeText(period: ReportPeriod): string {
  const { start, end } = periodRange(period);
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  return start.getTime() === last.getTime()
    ? formatReportDate(start)
    : `${formatReportDate(start)} – ${formatReportDate(last)}`;
}

const DELTA_TONE = {
  good: 'text-secondary dark:text-emerald-300',
  bad: 'text-danger dark:text-red-300',
  neutral: 'text-slate-500 dark:text-slate-400',
} as const;

function KpiTile({ k, report }: { k: KpiKey; report: ReportData }) {
  const delta = kpiDelta(k, report.kpis, report.previousKpis);
  const alarming = k === 'openOverdue' && report.kpis.openOverdue > 0;
  const label = k === 'openOverdue' && report.inProgress ? 'Overdue now' : KPI_LABELS[k];
  return (
    <div
      className={`surface drafting-frame relative min-w-0 p-3 sm:p-4 ${
        alarming ? '[--tick:var(--color-danger)] dark:[--tick:var(--color-red-400)]' : ''
      }`}
    >
      <p className="technical-label truncate">{label}</p>
      <p
        className={`readout mt-1 truncate text-xl font-bold sm:text-2xl ${
          alarming ? 'text-danger dark:text-red-300' : 'text-ink dark:text-slate-50'
        }`}
      >
        {formatKpi(k, report.kpis)}
      </p>
      <p className="readout mt-1 text-xs">
        <span className={`font-semibold ${DELTA_TONE[delta?.tone ?? 'neutral']}`}>{delta?.text ?? '—'}</span>
        <span className="ml-1.5 hidden text-slate-500 sm:inline dark:text-slate-400">
          vs {report.previousPeriodLabel}
        </span>
      </p>
    </div>
  );
}

function ReportPreview({ report }: { report: ReportData }) {
  const contents: Array<[string, number]> = [
    ['Completed jobs', report.appendix.length],
    ['Customers', report.customers.totalCustomers],
    ['Team members', report.team.length],
    ['Late completions', report.delivery.late.length],
    [report.inProgress ? 'Overdue now' : 'Overdue at period end', report.delivery.overdue.length],
    ['Due-date changes', report.delivery.reschedules.length],
    ['Materials drawn', report.materials.consumed.length],
    ['Maintenance services', report.maintenance.totalServices],
  ];
  return (
    <section aria-labelledby="report-preview-heading" className="space-y-4">
      <div>
        <h2 id="report-preview-heading" className="font-display text-lg font-bold">
          Preview
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          {reportSummarySentence(report)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {KPI_ORDER.map((k) => (
          <KpiTile key={k} k={k} report={report} />
        ))}
      </div>
      <div className="surface p-4">
        <h3 className="technical-label mb-3">In the PDF</h3>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {contents.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 border-b border-dotted border-slate-300/80 pb-1.5 dark:border-slate-700"
            >
              <dt className="truncate text-sm text-slate-600 dark:text-slate-300">{label}</dt>
              <dd className="readout text-sm font-semibold text-ink dark:text-slate-100">{formatCount(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
