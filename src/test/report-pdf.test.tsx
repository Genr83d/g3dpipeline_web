// @vitest-environment node
/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { buildReport } from '../lib/reportData';
import { reportFilename } from '../lib/reportPeriods';
import { registerReportFonts } from '../reports/pdf/fonts';
import { ReportDocument } from '../reports/pdf/ReportDocument';
import {
  fixtureGeneratedBy,
  fixtureJobs,
  fixtureMachines,
  fixtureMaterials,
  fixtureNow,
  fixturePeriods,
} from './reportFixture';

/** Renders the real report document from the shared fixture. Set
 *  REPORT_PDF_OUT=<dir> to keep the PDFs for visual review. */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fontDir = join(root, 'src', 'assets', 'fonts', 'pdf');

registerReportFonts({
  interRegular: join(fontDir, 'Inter-Regular.ttf'),
  interSemiBold: join(fontDir, 'Inter-SemiBold.ttf'),
  interBold: join(fontDir, 'Inter-Bold.ttf'),
  monoRegular: join(fontDir, 'JetBrainsMono-Regular.ttf'),
  monoSemiBold: join(fontDir, 'JetBrainsMono-SemiBold.ttf'),
});

const logo = join(root, 'public', 'brand', 'g3d-mark-192.png');

function keep(name: string, buffer: Buffer) {
  const out = process.env.REPORT_PDF_OUT;
  if (!out) return;
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, name), buffer);
}

describe('report PDF', () => {
  it.each(fixturePeriods)('renders the $name report', async ({ period }) => {
    const report = buildReport({
      jobs: fixtureJobs,
      materials: fixtureMaterials,
      machines: fixtureMachines,
      period,
      now: fixtureNow,
      generatedBy: fixtureGeneratedBy,
    });
    const buffer = await renderToBuffer(<ReportDocument report={report} logoSrc={logo} />);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(10_000);
    keep(reportFilename(period), buffer);
  }, 30_000);

  it('paginates a busy month with long names', async () => {
    const template = fixtureJobs.find((j) => j.status === 'completed' && j.completedAt)!;
    const jobs = Array.from({ length: 300 }, (_, i) => ({
      ...template,
      id: `stress-${i}`,
      orderNumber: `G3D-ST${String(i).padStart(4, '0')}`,
      name: i % 7 === 0 ? 'Replacement housing for the north-wing espresso machine, matte black, revision C' : `Batch ${i}`,
      customer: i % 5 === 0 ? 'The Very Long Named Caribbean Hospitality and Leisure Group Limited' : `Customer ${i % 23}`,
      completedAt: new Date(2026, 8, 1 + (i % 30), 9 + (i % 8)),
      dueDate: new Date(2026, 8, 1 + ((i + (i % 4 === 0 ? -1 : 2)) % 30), 23, 59),
      createdAt: new Date(2026, 7, 25),
    }));
    const report = buildReport({
      jobs,
      materials: fixtureMaterials,
      machines: fixtureMachines,
      period: { kind: 'month', year: 2026, month: 9 },
      now: fixtureNow,
      generatedBy: fixtureGeneratedBy,
    });
    expect(report.appendix).toHaveLength(300);
    const buffer = await renderToBuffer(<ReportDocument report={report} logoSrc={logo} />);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    keep('stress.pdf', buffer);
  }, 60_000);
});
