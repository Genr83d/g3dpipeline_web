import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { pdfColors as c, pdfFonts } from './theme';

export const s = StyleSheet.create({
  label: {
    fontFamily: pdfFonts.mono,
    fontSize: 6.5,
    fontWeight: 600,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: c.label,
  },
  body: { fontFamily: pdfFonts.sans, fontSize: 8.5, lineHeight: 1.45, color: c.body },
  mono: { fontFamily: pdfFonts.mono, fontSize: 8, color: c.ink },
  muted: { fontFamily: pdfFonts.sans, fontSize: 7.5, color: c.label, lineHeight: 1.4 },
});

/** Registration ticks at a sheet's four corners — the drafting-sheet
 *  signature, in the sheet's signal colour. */
export function CornerTicks({ color = c.primary, size = 6 }: { color?: string; size?: number }) {
  const w = 0.9;
  const tick = (pos: Style, borders: Style) => (
    <View style={{ position: 'absolute', width: size, height: size, ...pos, ...borders }} />
  );
  return (
    <>
      {tick({ top: -0.5, left: -0.5 }, { borderTopWidth: w, borderLeftWidth: w, borderColor: color })}
      {tick({ top: -0.5, right: -0.5 }, { borderTopWidth: w, borderRightWidth: w, borderColor: color })}
      {tick({ bottom: -0.5, left: -0.5 }, { borderBottomWidth: w, borderLeftWidth: w, borderColor: color })}
      {tick({ bottom: -0.5, right: -0.5 }, { borderBottomWidth: w, borderRightWidth: w, borderColor: color })}
    </>
  );
}

/** A sheet: hairline border, 4px corners, corner ticks. */
export function Sheet({
  children,
  style,
  tick,
}: {
  children: ReactNode;
  style?: Style;
  tick?: string;
}) {
  return (
    <View
      style={{
        position: 'relative',
        borderWidth: 0.6,
        borderColor: c.rule,
        borderRadius: 3,
        backgroundColor: c.paper,
        padding: 10,
        ...style,
      }}
      wrap={false}
    >
      <CornerTicks color={tick} />
      {children}
    </View>
  );
}

/** Numbered section heading with a hairline rule and a one-line caption. The
 *  heading never strands at the foot of a page without its content. */
export function SectionHeading({
  number,
  title,
  caption,
}: {
  number: string;
  title: string;
  caption?: string;
}) {
  return (
    <View style={{ marginTop: 18, marginBottom: 8 }} minPresenceAhead={90} wrap={false}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          style={{ fontFamily: pdfFonts.mono, fontSize: 8, fontWeight: 600, color: c.primary, width: 20 }}
        >
          {number}
        </Text>
        <Text style={{ fontFamily: pdfFonts.sans, fontSize: 12.5, fontWeight: 700, color: c.ink }}>
          {title}
        </Text>
      </View>
      <View style={{ marginTop: 5, height: 0.6, backgroundColor: c.ink, opacity: 0.85 }} />
      {caption && <Text style={{ ...s.muted, marginTop: 5 }}>{caption}</Text>}
    </View>
  );
}

export function SubHeading({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 5 }} minPresenceAhead={40}>
      <Text style={s.label}>{children}</Text>
      <View style={{ flexGrow: 1, marginLeft: 6, height: 0.5, backgroundColor: c.rule }} />
    </View>
  );
}

export function EmptyLine({ children }: { children: string }) {
  return (
    <View style={{ paddingVertical: 8, paddingHorizontal: 10, backgroundColor: c.sheet, borderRadius: 2 }}>
      <Text style={s.muted}>{children}</Text>
    </View>
  );
}

/** A status lamp: a small filled dot in a signal colour. */
export function Led({ color, size = 5 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** Tables up to this many rows never split across pages. */
export const SHORT_TABLE_ROWS = 8;

export interface Column {
  label: string;
  /** Flex weight. */
  flex: number;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
}

/** A ruled table. The header row repeats on every page the table spans, and
 *  rows never split across a page break. */
export function Table({
  columns,
  rows,
  zebra = true,
  lead,
  dense = false,
}: {
  columns: readonly Column[];
  rows: ReadonlyArray<ReadonlyArray<ReactNode>>;
  zebra?: boolean;
  /** Tighter rows and smaller type, for long listings. */
  dense?: boolean;
  /** Heading that must stay on the same page as the table's first rows. */
  lead?: ReactNode;
}) {
  const header = (
    <View
      fixed
      style={{
        flexDirection: 'row',
        paddingVertical: 4,
        paddingHorizontal: 4,
        borderBottomWidth: 0.8,
        borderBottomColor: c.ink,
      }}
    >
      {columns.map((col, i) => (
        <Text key={i} style={{ ...s.label, flex: col.flex, textAlign: col.align ?? 'left', paddingRight: cellGap(col) }}>
          {col.label}
        </Text>
      ))}
    </View>
  );
  const body = rows.map((row, r) => (
    <View
      key={r}
      wrap={false}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: dense ? 3 : 4,
        paddingHorizontal: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: c.hairline,
        backgroundColor: zebra && r % 2 === 1 ? c.sheet : c.paper,
      }}
    >
      {row.map((cell, i) => {
        const col = columns[i];
        return (
          <View key={i} style={{ flex: col.flex, paddingRight: cellGap(col), alignItems: alignToFlex(col.align) }}>
            {typeof cell === 'string' || typeof cell === 'number' ? (
              <Text
                style={{
                  ...(col.mono
                    ? { ...s.mono, fontSize: dense ? 7 : 8 }
                    : { ...s.body, fontSize: dense ? 7.5 : 8.5, lineHeight: dense ? 1.3 : 1.45, color: c.ink }),
                  textAlign: col.align ?? 'left',
                  ...(dense ? { maxLines: 2, textOverflow: 'ellipsis' as const } : {}),
                }}
              >
                {cell}
              </Text>
            ) : (
              cell
            )}
          </View>
        );
      })}
    </View>
  ));
  // A short table moves to the next page whole, heading and all. A long one
  // may break between rows; its lead (the heading above it) insists on a few
  // rows following it on the same page, and its header repeats on every page
  // the table spans.
  if (rows.length <= SHORT_TABLE_ROWS) {
    return (
      <View wrap={false}>
        {lead}
        {header}
        {body}
      </View>
    );
  }
  return (
    <View>
      {lead && <View minPresenceAhead={70}>{lead}</View>}
      {header}
      {body}
    </View>
  );
}

/** Right-aligned figures sit hard against the next column's left edge, so
 *  they get a wider gutter than text columns. */
function cellGap(col: Column): number {
  return col.align === 'right' ? 12 : 6;
}

function alignToFlex(align: Column['align']): Style['alignItems'] {
  if (align === 'right') return 'flex-end';
  if (align === 'center') return 'center';
  return 'flex-start';
}

/** Horizontal proportion bar on a faint track. */
export function ProportionBar({
  value,
  color = c.primary,
  width = 80,
}: {
  value: number;
  color?: string;
  width?: number;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width, height: 5, backgroundColor: c.hairline, borderRadius: 1 }}>
      <View style={{ width: width * clamped, height: 5, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

/** A rate in mono with a lamp that turns amber below 80% and red below 60%. */
export function RateCell({ rate, text }: { rate: number | null; text: string }) {
  const color = rate === null ? c.faint : rate >= 0.8 ? c.secondary : rate >= 0.6 ? c.amber : c.danger;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Text style={{ ...s.mono, marginRight: 4 }}>{text}</Text>
      <Led color={color} size={4} />
    </View>
  );
}

/** A table, or a one-line note when it has no rows, either way kept on the
 *  same page as the heading passed in `lead`. */
export function TableBlock({
  lead,
  empty,
  rows,
  ...table
}: {
  lead: ReactNode;
  empty: string;
  columns: readonly Column[];
  rows: ReadonlyArray<ReadonlyArray<ReactNode>>;
  zebra?: boolean;
  dense?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <View wrap={false}>
        {lead}
        <EmptyLine>{empty}</EmptyLine>
      </View>
    );
  }
  return <Table {...table} rows={rows} lead={lead} />;
}
