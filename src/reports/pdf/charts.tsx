import { G, Line, Rect, Svg, Text, View } from '@react-pdf/renderer';
import type { ThroughputBucket } from '../../lib/reportData';
import { s } from './primitives';
import { pdfColors as c, pdfFonts } from './theme';

/** The smallest 1/2/5 × 10ⁿ at or above `max`, so gridlines land on round
 *  numbers. Never below 4, which keeps a quiet month from drawing 0.25-job
 *  gridlines. */
export function niceCeiling(max: number): number {
  if (max <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * magnitude >= max) return step * magnitude;
  }
  return 10 * magnitude;
}

const AXIS_W = 22;
const LABEL_H = 12;

/** Grouped bars: jobs received (blueprint wash, blue outline) beside jobs
 *  completed (machinist teal), one pair per bucket. Axis labels are laid out
 *  as text over the SVG so they use the report's fonts. */
export function ThroughputChart({
  buckets,
  width,
  height = 150,
}: {
  buckets: readonly ThroughputBucket[];
  width: number;
  height?: number;
}) {
  const plotW = width - AXIS_W;
  const plotH = height - LABEL_H;
  const max = niceCeiling(Math.max(0, ...buckets.map((b) => Math.max(b.received, b.completed))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const groupW = plotW / Math.max(1, buckets.length);
  const barW = Math.max(1.5, Math.min(12, groupW * 0.34));
  const gap = Math.min(1.5, barW * 0.15);
  const labelEvery = Math.ceil(buckets.length / 16);
  const y = (v: number) => plotH - (v / max) * plotH;

  return (
    <View style={{ position: 'relative', width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {ticks.map((t, i) => (
          <Line
            key={i}
            x1={AXIS_W}
            x2={width}
            y1={y(t)}
            y2={y(t)}
            stroke={i === 0 ? c.ink : c.rule}
            strokeWidth={i === 0 ? 0.8 : 0.4}
            strokeDasharray={i === 0 ? undefined : '2 2'}
          />
        ))}
        {buckets.map((b, i) => {
          const cx = AXIS_W + groupW * i + groupW / 2;
          const receivedH = plotH - y(b.received);
          const completedH = plotH - y(b.completed);
          return (
            <G key={i}>
              {b.received > 0 && (
                <Rect
                  x={cx - barW - gap / 2}
                  y={y(b.received)}
                  width={barW}
                  height={receivedH}
                  fill={c.primarySoft}
                  stroke={c.primary}
                  strokeWidth={0.6}
                />
              )}
              {b.completed > 0 && (
                <Rect
                  x={cx + gap / 2}
                  y={y(b.completed)}
                  width={barW}
                  height={completedH}
                  fill={c.secondary}
                />
              )}
            </G>
          );
        })}
      </Svg>
      {ticks.map((t, i) => (
        <Text
          key={`t${i}`}
          style={{
            ...s.mono,
            position: 'absolute',
            left: 0,
            width: AXIS_W - 4,
            top: y(t) - 4,
            fontSize: 6,
            color: c.label,
            textAlign: 'right',
          }}
        >
          {Number.isInteger(t) ? String(t) : t.toFixed(1)}
        </Text>
      ))}
      {buckets.map((b, i) =>
        i % labelEvery === 0 ? (
          <Text
            key={`l${i}`}
            style={{
              position: 'absolute',
              top: plotH + 3,
              left: AXIS_W + groupW * i + groupW / 2 - 20,
              width: 40,
              textAlign: 'center',
              fontFamily: pdfFonts.mono,
              fontSize: 6,
              color: c.label,
            }}
          >
            {b.label}
          </Text>
        ) : null,
      )}
    </View>
  );
}

export function ChartLegend() {
  const swatch = (fill: string, stroke?: string) => (
    <View
      style={{
        width: 8,
        height: 8,
        backgroundColor: fill,
        borderWidth: stroke ? 0.6 : 0,
        borderColor: stroke ?? fill,
        marginRight: 4,
      }}
    />
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {swatch(c.primarySoft, c.primary)}
      <Text style={{ ...s.label, marginRight: 12 }}>Received</Text>
      {swatch(c.secondary)}
      <Text style={s.label}>Completed</Text>
    </View>
  );
}
