import { Document, Image, Line, Page, Svg, Text, View } from '@react-pdf/renderer';
import type { ReportData } from '../../lib/reportData';
import {
  KPI_LABELS,
  KPI_ORDER,
  formatCount,
  formatDays,
  formatKpi,
  formatPercent,
  kpiDelta,
  reportSummarySentence,
  type KpiKey,
} from '../../lib/reportFormat';
import { formatReportDate, formatReportDateTime } from '../../lib/reportPeriods';
import { ChartLegend, ThroughputChart } from './charts';
import {
  EmptyLine,
  Led,
  ProportionBar,
  RateCell,
  SectionHeading,
  Sheet,
  SubHeading,
  Table,
  s,
  TableBlock,
} from './primitives';
import { CONTENT_WIDTH, PAGE, pdfColors as c, pdfFonts } from './theme';

const BRAND = 'GENR8 3D';
const TITLE_BLOCK_H = 168;

export interface ReportDocumentProps {
  report: ReportData;
  /** URL or path of the round brand mark. */
  logoSrc: string;
}

export function ReportDocument({ report, logoSrc }: ReportDocumentProps) {
  return (
    <Document
      title={`${BRAND} ${report.title} — ${report.periodLabel}`}
      author={report.generatedBy}
      subject={`Operations report for ${report.periodLabel}`}
      creator="GENR8 Pipeline"
      producer="GENR8 Pipeline"
      language="en"
    >
      <Page
        size="A4"
        style={{
          paddingTop: PAGE.margin + 14,
          paddingBottom: PAGE.margin + 10,
          paddingHorizontal: PAGE.margin,
          fontFamily: pdfFonts.sans,
          backgroundColor: c.paper,
        }}
      >
        <RunningHeader report={report} />
        <RunningFooter report={report} />
        <TitleBlock report={report} logoSrc={logoSrc} />
        <Overview report={report} />
        <Throughput report={report} />
        <Categories report={report} />
        <Customers report={report} />
        <Team report={report} />
        <Delivery report={report} />
        <Materials report={report} />
        <Maintenance report={report} />
        <Appendix report={report} />
      </Page>
    </Document>
  );
}

/* ── Page furniture ─────────────────────────────────────────────────────── */

function RunningHeader({ report }: { report: ReportData }) {
  return (
    <View
      fixed
      render={({ pageNumber }) =>
        pageNumber === 1 ? null : (
          <View
            style={{
              position: 'absolute',
              top: -PAGE.margin + 6,
              left: 0,
              right: 0,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 5,
              borderBottomWidth: 0.5,
              borderBottomColor: c.rule,
            }}
          >
            <Text style={s.label}>
              {BRAND} · {report.title}
            </Text>
            <Text style={{ ...s.label, color: c.primary }}>{report.periodLabel}</Text>
          </View>
        )
      }
    />
  );
}

function RunningFooter({ report }: { report: ReportData }) {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        bottom: 22,
        left: PAGE.margin,
        right: PAGE.margin,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 5,
        borderTopWidth: 0.5,
        borderTopColor: c.rule,
      }}
    >
      <Text style={{ ...s.label, letterSpacing: 0.4, textTransform: 'none' }}>
        Generated {formatReportDateTime(report.generatedAt)} by {report.generatedBy}
      </Text>
      <Text
        style={{ ...s.label, color: c.ink }}
        render={({ pageNumber, totalPages }) =>
          `Sheet ${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`
        }
      />
    </View>
  );
}

/** Drafting-paper grid for the title block: fine lines every 10.5pt, a heavier
 *  line every 52.5pt — the app's 42/210px grid at print scale. */
function TitleGrid({ width, height }: { width: number; height: number }) {
  const lines = [];
  for (let x = 0, i = 0; x <= width; x += 10.5, i++) {
    lines.push(
      <Line
        key={`x${i}`}
        x1={x}
        x2={x}
        y1={0}
        y2={height}
        stroke={i % 5 === 0 ? c.nightGridMajor : c.nightGrid}
        strokeWidth={i % 5 === 0 ? 0.5 : 0.3}
      />,
    );
  }
  for (let y = 0, i = 0; y <= height; y += 10.5, i++) {
    lines.push(
      <Line
        key={`y${i}`}
        x1={0}
        x2={width}
        y1={y}
        y2={y}
        stroke={i % 5 === 0 ? c.nightGridMajor : c.nightGrid}
        strokeWidth={i % 5 === 0 ? 0.5 : 0.3}
      />,
    );
  }
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      {lines}
    </Svg>
  );
}

function TitleBlock({ report, logoSrc }: { report: ReportData; logoSrc: string }) {
  const range =
    report.rangeStart.getTime() === report.rangeLastDay.getTime()
      ? formatReportDate(report.rangeStart)
      : `${formatReportDate(report.rangeStart)} – ${formatReportDate(report.rangeLastDay)}`;
  return (
    <View
      style={{
        marginTop: -(PAGE.margin + 14),
        marginHorizontal: -PAGE.margin,
        height: TITLE_BLOCK_H,
        backgroundColor: c.night,
        position: 'relative',
      }}
    >
      <TitleGrid width={PAGE.width} height={TITLE_BLOCK_H} />
      <View
        style={{
          position: 'absolute',
          left: PAGE.margin,
          right: PAGE.margin,
          top: 34,
          bottom: 22,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image src={logoSrc} style={{ width: 26, height: 26, borderRadius: 13, marginRight: 9 }} />
            <View>
              <Text style={{ ...s.label, color: c.nightText, letterSpacing: 1.6 }}>{BRAND}</Text>
              <Text style={{ ...s.label, color: c.nightMuted, marginTop: 2 }}>{report.title}</Text>
            </View>
          </View>
          {report.inProgress && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 0.6,
                borderColor: c.amber,
                borderRadius: 2,
                paddingVertical: 3,
                paddingHorizontal: 6,
              }}
            >
              <Led color={c.amber} size={4.5} />
              <Text style={{ ...s.label, color: c.amber, marginLeft: 5 }}>
                In progress · to {formatReportDate(report.generatedAt)}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text
              style={{
                fontFamily: pdfFonts.sans,
                fontWeight: 700,
                fontSize: 30,
                letterSpacing: -0.6,
                color: '#ffffff',
              }}
            >
              {report.periodLabel}
            </Text>
            <Text style={{ fontFamily: pdfFonts.mono, fontSize: 8, color: c.nightMuted, marginTop: 4 }}>
              {range}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <TitleMeta label="Compared with" value={report.previousPeriodLabel} />
            <TitleMeta label="Prepared by" value={report.generatedBy} />
            <TitleMeta label="Issued" value={formatReportDateTime(report.generatedAt)} />
          </View>
        </View>
      </View>
      {/* Blue registration rule along the foot of the title block. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: c.primary }} />
    </View>
  );
}

function TitleMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginTop: 3 }}>
      <Text style={{ ...s.label, color: c.nightMuted, width: 70, textAlign: 'right', marginRight: 8 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: pdfFonts.mono, fontSize: 7.5, color: c.nightText, maxWidth: 140 }}>
        {value}
      </Text>
    </View>
  );
}

/* ── 01 Overview ────────────────────────────────────────────────────────── */

function kpiLabel(key: KpiKey, report: ReportData): string {
  if (key === 'openOverdue' && report.inProgress) return 'Overdue now';
  return KPI_LABELS[key];
}

function KpiTile({ k, report }: { k: KpiKey; report: ReportData }) {
  const delta = kpiDelta(k, report.kpis, report.previousKpis);
  const tick =
    k === 'openOverdue' && report.kpis.openOverdue > 0
      ? c.danger
      : k === 'completed' || k === 'units'
        ? c.secondary
        : c.primary;
  const toneColor = delta?.tone === 'good' ? c.secondary : delta?.tone === 'bad' ? c.danger : c.label;
  return (
    <Sheet tick={tick} style={{ width: (CONTENT_WIDTH - 16) / 3, marginBottom: 8, paddingVertical: 11 }}>
      <Text style={s.label}>{kpiLabel(k, report)}</Text>
      <Text
        style={{
          fontFamily: pdfFonts.mono,
          fontWeight: 600,
          fontSize: 21,
          letterSpacing: -0.6,
          color: k === 'openOverdue' && report.kpis.openOverdue > 0 ? c.danger : c.ink,
          marginTop: 6,
        }}
      >
        {formatKpi(k, report.kpis)}
      </Text>
      <View style={{ flexDirection: 'row', marginTop: 5, alignItems: 'center' }}>
        <Text style={{ fontFamily: pdfFonts.mono, fontSize: 7, fontWeight: 600, color: toneColor }}>
          {delta ? delta.text : '—'}
        </Text>
        <Text style={{ ...s.muted, fontSize: 6.5, marginLeft: 4 }}>
          vs {formatKpi(k, report.previousKpis)} prior
        </Text>
      </View>
    </Sheet>
  );
}

function Overview({ report }: { report: ReportData }) {
  return (
    <View>
      <SectionHeading number="01" title="Overview" />
      <Text style={{ fontFamily: pdfFonts.sans, fontSize: 10, lineHeight: 1.5, color: c.ink, marginBottom: 10 }}>
        {reportSummarySentence(report)}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {KPI_ORDER.map((k) => (
          <KpiTile key={k} k={k} report={report} />
        ))}
      </View>
      <Text style={{ ...s.muted, fontSize: 6.5 }}>
        Deltas compare with {report.previousPeriodLabel}. On time means completed on or before the due
        date. Turnaround runs from job creation to completion.
      </Text>
    </View>
  );
}

/* ── 02 Throughput ──────────────────────────────────────────────────────── */

const GRANULARITY_CAPTION = {
  day: 'Jobs received and completed each day.',
  week: 'Jobs received and completed per 7-day run from the start of the period.',
  month: 'Jobs received and completed each month.',
} as const;

function Throughput({ report }: { report: ReportData }) {
  const { buckets, granularity } = report.throughput;
  const peak = buckets.reduce(
    (best, b) => (b.completed > best.completed ? b : best),
    buckets[0] ?? { label: '', longLabel: '', completed: 0, received: 0 },
  );
  return (
    <View wrap={false}>
      <SectionHeading number="02" title="Throughput" caption={GRANULARITY_CAPTION[granularity]} />
      <Sheet style={{ paddingTop: 12, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <ChartLegend />
          {peak.completed > 0 && (
            <Text style={s.label}>
              Peak · {peak.longLabel} · {formatCount(peak.completed)} completed
            </Text>
          )}
        </View>
        <ThroughputChart buckets={buckets} width={CONTENT_WIDTH - 22} />
      </Sheet>
    </View>
  );
}

/* ── 03 Categories ──────────────────────────────────────────────────────── */

function Categories({ report }: { report: ReportData }) {
  const total = report.kpis.completed;
  return (
    <TableBlock
      lead={<SectionHeading number="03" title="Work by category" caption="Completed jobs in the period, by job category." />}
      empty="No jobs were completed in this period."
      columns={[
        { label: 'Category', flex: 2.2 },
        { label: 'Share', flex: 2 },
        { label: 'Jobs', flex: 0.9, align: 'right', mono: true },
        { label: 'Units', flex: 0.9, align: 'right', mono: true },
        { label: 'On time', flex: 1.1, align: 'right' },
        { label: 'Median turnaround', flex: 1.5, align: 'right', mono: true },
      ]}
      rows={report.categories.map((row) => [
        row.label,
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ProportionBar value={total ? row.jobs / total : 0} width={70} />
          <Text style={{ ...s.mono, fontSize: 7, color: c.label, marginLeft: 5 }}>
            {formatPercent(total ? row.jobs / total : null)}
          </Text>
        </View>,
        formatCount(row.jobs),
        formatCount(row.units),
        <RateCell rate={row.onTimeRate} text={formatPercent(row.onTimeRate)} />,
        formatDays(row.medianTurnaroundDays),
      ])}
    />
  );
}

/* ── 04 Customers ───────────────────────────────────────────────────────── */

function Customers({ report }: { report: ReportData }) {
  const { rows, totalCustomers, otherCustomers, otherJobs } = report.customers;
  const top = rows[0]?.jobs ?? 0;
  return (
    <View>
      <TableBlock
        lead={
          <SectionHeading
            number="04"
            title="Customers"
            caption={
              totalCustomers > rows.length
                ? `Top ${rows.length} of ${totalCustomers} customers by jobs completed.`
                : `${formatCount(totalCustomers)} customer${totalCustomers === 1 ? '' : 's'} served, by jobs completed.`
            }
          />
        }
        empty="No customer work was completed in this period."
        columns={[
          { label: '#', flex: 0.4, mono: true },
          { label: 'Customer', flex: 3 },
          { label: '', flex: 1.6 },
          { label: 'Jobs', flex: 0.8, align: 'right', mono: true },
          { label: 'Units', flex: 0.9, align: 'right', mono: true },
          { label: 'On time', flex: 1.1, align: 'right' },
        ]}
        rows={rows.map((row, i) => [
          String(i + 1).padStart(2, '0'),
          row.name,
          <ProportionBar value={top ? row.jobs / top : 0} width={60} color={c.secondary} />,
          formatCount(row.jobs),
          formatCount(row.units),
          <RateCell rate={row.onTimeRate} text={formatPercent(row.onTimeRate)} />,
        ])}
      />
      {otherCustomers > 0 && (
        <Text style={{ ...s.muted, marginTop: 4 }}>
          + {formatCount(otherCustomers)} other customer{otherCustomers === 1 ? '' : 's'} with{' '}
          {formatCount(otherJobs)} job{otherJobs === 1 ? '' : 's'} between them.
        </Text>
      )}
    </View>
  );
}

/* ── 05 Team ────────────────────────────────────────────────────────────── */

function Team({ report }: { report: ReportData }) {
  return (
    <TableBlock
      lead={
        <SectionHeading
          number="05"
          title="Team"
          caption="Contributed counts completed jobs a person was assigned to or collaborated on."
        />
      }
      empty="No completions were recorded against team members in this period."
      columns={[
        { label: 'Person', flex: 3 },
        { label: 'Contributed', flex: 1.2, align: 'right', mono: true },
        { label: 'Marked complete', flex: 1.4, align: 'right', mono: true },
        { label: 'Units', flex: 1, align: 'right', mono: true },
        { label: 'On time', flex: 1.1, align: 'right' },
      ]}
      rows={report.team.map((row) => [
        row.name,
        formatCount(row.contributed),
        formatCount(row.completed),
        formatCount(row.units),
        <RateCell rate={row.onTimeRate} text={formatPercent(row.onTimeRate)} />,
      ])}
    />
  );
}

/* ── 06 Delivery ────────────────────────────────────────────────────────── */

function Delivery({ report }: { report: ReportData }) {
  const { late, overdue, reschedules } = report.delivery;
  return (
    <View>
      <TableBlock
        lead={
          <>
            <SectionHeading
              number="06"
              title="Delivery health"
              caption="Where deadlines slipped: late completions, work still overdue, and due dates that moved."
            />
            <SubHeading>{`Completed late · ${late.length}`}</SubHeading>
          </>
        }
        empty="Every job completed in this period met its due date."
        columns={[
          { label: 'Order', flex: 1.4, mono: true },
          { label: 'Job', flex: 2.4 },
          { label: 'Customer', flex: 2 },
          { label: 'Due', flex: 1.3, mono: true },
          { label: 'Completed', flex: 1.3, mono: true },
          { label: 'Late', flex: 0.8, align: 'right' },
        ]}
        rows={late.map((r) => [
          r.orderNumber,
          r.name,
          r.customer,
          formatReportDate(r.dueDate),
          formatReportDate(r.completedAt),
          <Text style={{ ...s.mono, color: c.danger, fontWeight: 600 }}>{`${r.daysLate} d`}</Text>,
        ])}
      />
      <TableBlock
        lead={<SubHeading>{`${report.inProgress ? 'Overdue now' : 'Overdue at period end'} · ${overdue.length}`}</SubHeading>}
        empty="No open jobs were past their due date."
        columns={[
          { label: 'Order', flex: 1.4, mono: true },
          { label: 'Job', flex: 2.4 },
          { label: 'Customer', flex: 2 },
          { label: 'Assigned', flex: 1.6 },
          { label: 'Due', flex: 1.3, mono: true },
          { label: 'Overdue', flex: 0.9, align: 'right' },
        ]}
        rows={overdue.map((r) => [
          r.orderNumber,
          r.name,
          r.customer,
          r.assignedToName || '—',
          formatReportDate(r.dueDate),
          <Text style={{ ...s.mono, color: c.danger, fontWeight: 600 }}>{`${r.daysOverdue} d`}</Text>,
        ])}
      />
      <TableBlock
        lead={<SubHeading>{`Due dates changed · ${reschedules.length}`}</SubHeading>}
        empty="No due dates were changed in this period."
        columns={[
          { label: 'Changed', flex: 1.3, mono: true },
          { label: 'Order', flex: 1.4, mono: true },
          { label: 'Job', flex: 2 },
          { label: 'From → to', flex: 2.3, mono: true },
          { label: 'Reason', flex: 2.6 },
          { label: 'By', flex: 1.3 },
        ]}
        rows={reschedules.map((r) => [
          formatReportDate(r.changedAt),
          r.orderNumber,
          r.name,
          `${r.previousDueDate ? formatReportDate(r.previousDueDate) : '—'} → ${formatReportDate(r.dueDate)}`,
          r.note || '—',
          r.changedByName,
        ])}
      />
      <Text style={{ ...s.muted, fontSize: 6.5, marginTop: 4 }}>
        Each job keeps only its latest due-date change, so a job moved twice appears once.
      </Text>
    </View>
  );
}

/* ── 07 Materials ───────────────────────────────────────────────────────── */

function Materials({ report }: { report: ReportData }) {
  const { consumed, stock } = report.materials;
  return (
    <View>
      <TableBlock
        lead={
          <>
            <SectionHeading
              number="07"
              title="Materials"
              caption="Stock drawn by tagged jobs completed in the period, and current stock levels."
            />
            <SubHeading>Consumed in period</SubHeading>
          </>
        }
        empty="No tagged jobs drew stock in this period."
        columns={[
          { label: 'Material', flex: 3 },
          { label: 'Used', flex: 1.4, align: 'right', mono: true },
          { label: '', flex: 3 },
        ]}
        rows={consumed.map((m) => [m.material, withUnit(m.units, m.unit), ''])}
      />
      <TableBlock
        lead={<SubHeading>{`Stock on hand · as of ${formatReportDate(report.generatedAt)}`}</SubHeading>}
        empty="No materials are tracked in inventory."
        columns={[
          { label: 'Material', flex: 3 },
          { label: 'Level', flex: 2.2 },
          { label: 'On hand', flex: 1.4, align: 'right', mono: true },
          { label: 'Full stock', flex: 1.4, align: 'right', mono: true },
        ]}
        rows={stock.map((m) => {
          const tracked = m.totalQuantity > 0;
          const tone = !tracked ? c.faint : m.low ? c.danger : c.secondary;
          return [
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Led color={tone} size={4} />
              <Text style={{ ...s.body, color: c.ink, marginLeft: 5 }}>{m.name}</Text>
            </View>,
            tracked ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ProportionBar value={m.ratio} width={62} color={tone} />
                <Text style={{ ...s.mono, fontSize: 7, color: m.low ? c.danger : c.label, marginLeft: 5 }}>
                  {formatPercent(m.ratio)}
                </Text>
              </View>
            ) : (
              <Text style={{ ...s.muted, fontSize: 7 }}>Full stock not set</Text>
            ),
            withUnit(m.quantity, m.unit),
            tracked ? withUnit(m.totalQuantity, m.unit) : '—',
          ];
        })}
      />
      <Text style={{ ...s.muted, fontSize: 6.5, marginTop: 4 }}>
        Consumption is recalculated from the stock rules on each job tag. Stock is not logged over time,
        so levels show the moment this report was generated, not the end of the period.
      </Text>
    </View>
  );
}

function withUnit(n: number, unit: string): string {
  return unit ? `${formatCount(n)} ${unit}` : formatCount(n);
}

/* ── 08 Maintenance ─────────────────────────────────────────────────────── */

function Maintenance({ report }: { report: ReportData }) {
  const { machines, totalServices, idleMachines } = report.maintenance;
  const serviced = machines.filter((m) => m.services.length > 0);
  const heading = (
    <SectionHeading
      number="08"
      title="Maintenance"
      caption={`${formatCount(totalServices)} service${totalServices === 1 ? '' : 's'} logged across ${formatCount(serviced.length)} of ${formatCount(machines.length)} machine${machines.length === 1 ? '' : 's'}.`}
    />
  );
  return (
    <View>
      {serviced.length === 0 ? (
        <View wrap={false}>
          {heading}
          <EmptyLine>
            {machines.length === 0 ? 'No machines are registered.' : 'No maintenance was logged in this period.'}
          </EmptyLine>
        </View>
      ) : (
        serviced.map((m, i) => (
            <Table
              key={m.name}
              zebra={false}
              lead={
                <>
                  {i === 0 && heading}
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: i === 0 ? 0 : 10, marginBottom: 3 }}>
                    <Text style={{ fontFamily: pdfFonts.sans, fontWeight: 600, fontSize: 9, color: c.ink }}>
                      {m.name}
                    </Text>
                    {m.location ? <Text style={{ ...s.muted, marginLeft: 6 }}>{m.location}</Text> : null}
                    <Text style={{ ...s.label, marginLeft: 'auto' }}>
                      {m.services.length} service{m.services.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                </>
              }
              columns={[
                { label: 'Date', flex: 1.9, mono: true },
                { label: 'Procedures', flex: 3.3 },
                { label: 'By', flex: 1.4 },
                { label: 'Notes', flex: 2.4 },
              ]}
              rows={m.services.map((svc) => [
                formatReportDateTime(svc.completedAt),
                svc.procedures.length ? svc.procedures.join(' · ') : '—',
                svc.completedByName,
                svc.notes || '—',
              ])}
            />
        ))
      )}
      {idleMachines.length > 0 && machines.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            marginTop: 4,
            padding: 7,
            backgroundColor: c.amberSoft,
            borderRadius: 2,
          }}
          wrap={false}
        >
          <Led color={c.amber} size={4.5} />
          <Text style={{ ...s.body, fontSize: 7.5, color: c.ink, marginLeft: 6, flex: 1 }}>
            No service logged this period: {idleMachines.join(', ')}.
          </Text>
        </View>
      )}
    </View>
  );
}

/* ── Appendix ───────────────────────────────────────────────────────────── */

function Appendix({ report }: { report: ReportData }) {
  return (
    <View break>
      <TableBlock
        lead={
          <SectionHeading
            number="A"
            title="Completed jobs"
            caption={`All ${formatCount(report.appendix.length)} job${report.appendix.length === 1 ? '' : 's'} completed in ${report.periodLabel}, in order of completion.`}
          />
        }
        empty="No jobs were completed in this period."
        dense
        columns={[
          { label: 'Order', flex: 1.25, mono: true },
          { label: 'Job · customer', flex: 3.8 },
          { label: 'Category', flex: 1.85 },
          { label: 'Qty', flex: 0.6, align: 'right', mono: true },
          { label: 'Completed', flex: 1.2, mono: true },
          { label: 'Due', flex: 1.2, mono: true },
          { label: '', flex: 0.3, align: 'center' },
        ]}
        rows={report.appendix.map((r) => [
          r.orderNumber,
          <View>
            <Text style={{ ...s.body, fontSize: 7.5, lineHeight: 1.3, color: c.ink, maxLines: 2, textOverflow: 'ellipsis' }}>
              {r.name}
            </Text>
            <Text style={{ ...s.muted, fontSize: 6.5, lineHeight: 1.3, maxLines: 1, textOverflow: 'ellipsis' }}>
              {r.customer}
            </Text>
          </View>,
          r.categoryLabel,
          formatCount(r.quantity),
          formatReportDate(r.completedAt),
          formatReportDate(r.dueDate),
          <Led color={r.onTime ? c.secondary : c.danger} size={4.5} />,
        ])}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Led color={c.secondary} size={4.5} />
        <Text style={{ ...s.muted, fontSize: 6.5, marginLeft: 4, marginRight: 10 }}>On time</Text>
        <Led color={c.danger} size={4.5} />
        <Text style={{ ...s.muted, fontSize: 6.5, marginLeft: 4 }}>Late</Text>
      </View>
      {report.undatedCompletions > 0 && (
        <Text style={{ ...s.muted, fontSize: 6.5, marginTop: 6 }}>
          {formatCount(report.undatedCompletions)} older completed job
          {report.undatedCompletions === 1 ? ' has' : 's have'} no completion date and cannot be placed in any
          period.
        </Text>
      )}
    </View>
  );
}
