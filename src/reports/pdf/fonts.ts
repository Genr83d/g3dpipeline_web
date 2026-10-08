import { Font } from '@react-pdf/renderer';
import { pdfFonts } from './theme';

export interface ReportFontSources {
  interRegular: string;
  interSemiBold: string;
  interBold: string;
  monoRegular: string;
  monoSemiBold: string;
}

let registered = false;

/** Static TTFs (react-pdf cannot read variable fonts or woff2). Sources are
 *  passed in so the browser can hand over bundled asset URLs while the
 *  sample-render script hands over file paths. */
export function registerReportFonts(sources: ReportFontSources): void {
  if (registered) return;
  registered = true;
  Font.register({
    family: pdfFonts.sans,
    fonts: [
      { src: sources.interRegular, fontWeight: 400 },
      { src: sources.interSemiBold, fontWeight: 600 },
      { src: sources.interBold, fontWeight: 700 },
    ],
  });
  Font.register({
    family: pdfFonts.mono,
    fonts: [
      { src: sources.monoRegular, fontWeight: 400 },
      { src: sources.monoSemiBold, fontWeight: 600 },
    ],
  });
  // Report text is prose and data, not running copy: never hyphenate an
  // order number or a customer's name across lines.
  Font.registerHyphenationCallback((word) => [word]);
}
