/// <reference types="node" />
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildReport, reportToJson, type ReportData } from '../lib/reportData';
import type { ReportPeriod } from '../lib/reportPeriods';
import {
  fixtureGeneratedBy,
  fixtureJobs,
  fixtureMachines,
  fixtureMaterials,
  fixtureNow,
  fixturePeriods,
} from './reportFixture';

const EXPECTED_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'report-expected.json',
);

function build(period: ReportPeriod): ReportData {
  return buildReport({
    jobs: fixtureJobs,
    materials: fixtureMaterials,
    machines: fixtureMachines,
    period,
    now: fixtureNow,
    generatedBy: fixtureGeneratedBy,
  });
}

const september = build({ kind: 'month', year: 2026, month: 9 });

describe('buildReport', () => {
  it('counts only completed jobs whose completedAt falls inside the period', () => {
    const names = september.appendix.map((r) => r.name);
    expect(names).toContain('Last-second September completion');
    expect(names).not.toContain('Restored after QA (stale completedAt)');
    expect(names).not.toContain('Legacy undated completion');
    expect(names).not.toContain('Overdue then finished in October');
    expect(september.kpis.completed).toBe(september.appendix.length);
    expect(september.undatedCompletions).toBe(1);
  });

  it('keeps the appendix in completion order', () => {
    const times = september.appendix.map((r) => r.completedAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('treats a job completed after its due date as late, and on the day as on time', () => {
    const lastSecond = september.appendix.find((r) => r.name === 'Last-second September completion');
    expect(lastSecond?.onTime).toBe(true);
    const batchB = september.delivery.late.find((r) => r.name === 'Pins batch B crossing 50');
    expect(batchB?.daysLate).toBe(3);
  });

  it('lists jobs still open past their due date at the end of a closed period', () => {
    const overdue = september.delivery.overdue.map((r) => r.name);
    expect(overdue).toContain('Overdue enclosure');
    // Finished in October, so it was still open and overdue on 30 September.
    expect(overdue).toContain('Overdue then finished in October');
    expect(overdue).not.toContain('Open, not yet due');
    expect(overdue).not.toContain('Created after September');
    expect(september.kpis.openOverdue).toBe(overdue.length);
  });

  it('measures overdue against now for a period still in progress', () => {
    const october = build({ kind: 'month', year: 2026, month: 10 });
    expect(october.inProgress).toBe(true);
    const overdue = october.delivery.overdue.map((r) => r.name);
    expect(overdue).toContain('Created after September');
    expect(overdue).not.toContain('Overdue then finished in October');
  });

  it('replays per-batch material rules over the whole completion history', () => {
    const consumed = Object.fromEntries(september.materials.consumed.map((m) => [m.material, m.units]));
    const pinUnits = september.appendix
      .filter((r) => fixtureJobs.find((j) => j.orderNumber === r.orderNumber)?.tags.includes('pins'))
      .reduce((sum, r) => sum + r.quantity, 0);
    expect(consumed['Pin Backs']).toBe(pinUnits);
    expect(consumed.Lamina).toBeGreaterThan(0);
    expect(september.materials.consumed.find((m) => m.material === 'Lamina')?.unit).toBe('sheets');
  });

  it('merges customers that differ only by case and spacing, and names blanks', () => {
    const names = september.customers.rows.map((r) => r.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    const all = build({ kind: 'year', year: 2026 });
    expect(all.customers.rows.length).toBeLessThanOrEqual(10);
    expect(all.customers.rows.length + all.customers.otherCustomers).toBe(all.customers.totalCustomers);
  });

  it('only reports maintenance logged inside the period and flags idle machines', () => {
    const prusa = september.maintenance.machines.find((m) => m.name === 'Prusa MK4 #1');
    expect(prusa?.services.map((s) => s.procedures[0])).toEqual(['Clean bed', 'Belt tension']);
    expect(prusa?.services[1].completedByName).toBe('Unrecorded');
    expect(september.maintenance.idleMachines).toEqual(['Bambu X1C', 'Laser Cutter']);
  });

  it('does not flag a material with no full-stock amount as low', () => {
    const pla = september.materials.stock.find((m) => m.name === 'PLA Black');
    expect(pla?.low).toBe(false);
    expect(september.materials.stock.find((m) => m.name === 'Pin Backs')?.low).toBe(true);
  });

  it('produces an empty but well-formed report for a period with no activity', () => {
    const future = build({ kind: 'month', year: 2027, month: 1 });
    expect(future.kpis).toEqual({
      completed: 0,
      units: 0,
      received: 0,
      onTimeRate: null,
      medianTurnaroundDays: null,
      openOverdue: 0,
    });
    expect(future.appendix).toEqual([]);
    expect(future.throughput.buckets).toHaveLength(31);
  });

  it('matches the shared parity fixture for every fixture period', () => {
    const actual = Object.fromEntries(
      fixturePeriods.map(({ name, period }) => [name, reportToJson(build(period))]),
    );
    if (process.env.UPDATE_REPORT_FIXTURE || !existsSync(EXPECTED_PATH)) {
      writeFileSync(EXPECTED_PATH, `${JSON.stringify(actual, null, 1)}\n`);
    }
    expect(actual).toEqual(JSON.parse(readFileSync(EXPECTED_PATH, 'utf8')));
  });
});

describe('report period state', () => {
  it('marks only a period containing now as in progress', () => {
    expect(build({ kind: 'month', year: 2026, month: 10 }).inProgress).toBe(true);
    expect(build({ kind: 'month', year: 2026, month: 9 }).inProgress).toBe(false);
    expect(build({ kind: 'month', year: 2027, month: 1 }).inProgress).toBe(false);
  });
});
