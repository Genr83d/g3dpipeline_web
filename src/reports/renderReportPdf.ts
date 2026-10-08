import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import interRegular from '../assets/fonts/pdf/Inter-Regular.ttf?url';
import interSemiBold from '../assets/fonts/pdf/Inter-SemiBold.ttf?url';
import interBold from '../assets/fonts/pdf/Inter-Bold.ttf?url';
import monoRegular from '../assets/fonts/pdf/JetBrainsMono-Regular.ttf?url';
import monoSemiBold from '../assets/fonts/pdf/JetBrainsMono-SemiBold.ttf?url';
import type { ReportData } from '../lib/reportData';
import { registerReportFonts } from './pdf/fonts';
import { ReportDocument } from './pdf/ReportDocument';

/** Browser entry for the report PDF. Imported dynamically, so react-pdf and
 *  the report fonts load only when someone actually generates a report. */
export async function renderReportPdf(report: ReportData): Promise<Blob> {
  const absolute = (url: string) => new URL(url, window.location.origin).href;
  registerReportFonts({
    interRegular: absolute(interRegular),
    interSemiBold: absolute(interSemiBold),
    interBold: absolute(interBold),
    monoRegular: absolute(monoRegular),
    monoSemiBold: absolute(monoSemiBold),
  });
  const document = createElement(ReportDocument, {
    report,
    logoSrc: absolute('/brand/g3d-mark-192.png'),
  });
  // pdf() is typed for a <Document> element; ReportDocument renders one.
  return pdf(document as Parameters<typeof pdf>[0]).toBlob();
}

/** Saves a blob under `filename` through a temporary download link. Every
 *  supported browser honours `download` on a same-origin blob URL, including
 *  Safari on iOS 13+, which offers it to Files. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking at once can cancel the download in Safari; give it a minute.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
