/** Drafting-sheet tokens for print, mirrored from DESIGN.md. Print is always
 *  the light sheet: ink on paper, blue for the active signal, and status hue
 *  only on instruments (chart marks, LEDs, ticks). */
export const pdfColors = {
  ink: '#0d1726',
  body: '#475569',
  label: '#64748b',
  faint: '#94a3b8',
  rule: '#d5dde7',
  hairline: '#e6ebf1',
  paper: '#ffffff',
  sheet: '#f6f8fb',
  primary: '#2454d8',
  primarySoft: '#dfe8ff',
  secondary: '#087f74',
  secondarySoft: '#d7f2ed',
  amber: '#f59e0b',
  amberSoft: '#fef3c7',
  danger: '#b42318',
  dangerSoft: '#fde2df',
  /** Title-block ink and its grid lines. */
  night: '#0d1726',
  nightGrid: '#1e2b40',
  nightGridMajor: '#2a3a55',
  nightText: '#e2e8f0',
  nightMuted: '#94a3b8',
} as const;

export const pdfFonts = {
  sans: 'Inter',
  mono: 'JetBrains Mono',
} as const;

/** A4 in points. */
export const PAGE = { width: 595.28, height: 841.89, margin: 40 } as const;
export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
