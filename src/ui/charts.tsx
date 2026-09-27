// Minimal SVG charts (06c PFB-010 to PFB-016): own-past comparison only, hollow points for flagged values.
import { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { useColors } from './theme';

export interface Point {
  label: string;
  value: number | null;
  hollow?: boolean;
}

const H = 160;
const PAD = { l: 32, r: 12, t: 12, b: 24 };

function useWidth() {
  const { width } = useWindowDimensions();
  return Math.min(width - 64, 560);
}

function scaleY(v: number, max: number) {
  return PAD.t + (H - PAD.t - PAD.b) * (1 - v / Math.max(1, max));
}

export function LineChart({ points, max, accessibilityLabel }: { points: Point[]; max?: number; accessibilityLabel: string }) {
  const c = useColors();
  const W = useWidth();
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  const top = max ?? Math.max(1, ...vals) * 1.15;
  const step = points.length > 1 ? (W - PAD.l - PAD.r) / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({ x: PAD.l + i * step, y: p.value == null ? null : scaleY(p.value, top), p }));
  const line = xy.filter((q) => q.y != null).map((q) => `${q.x},${q.y}`).join(' ');
  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <Svg width={W} height={H}>
        <Line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke={c.border} strokeWidth={1} />
        <SvgText x={4} y={scaleY(top, top) + 4} fill={c.muted} fontSize={10}>
          {Math.round(top)}
        </SvgText>
        <SvgText x={4} y={H - PAD.b} fill={c.muted} fontSize={10}>
          0
        </SvgText>
        {line ? <Polyline points={line} fill="none" stroke={c.primary} strokeWidth={2} /> : null}
        {xy.map((q, i) =>
          q.y == null ? null : (
            <Circle key={i} cx={q.x} cy={q.y} r={5} fill={q.p.hollow ? c.bg : c.primary} stroke={c.primary} strokeWidth={2} />
          )
        )}
        {xy.length
          ? [xy[0], xy[xy.length - 1]].map((q, i) => (
              <SvgText key={i} x={i === 0 ? q.x : q.x - 30} y={H - 6} fill={c.muted} fontSize={10}>
                {q.p.label}
              </SvgText>
            ))
          : null}
      </Svg>
    </View>
  );
}

export function BarChart({ points, target, max, accessibilityLabel }: { points: Point[]; target?: number; max?: number; accessibilityLabel: string }) {
  const c = useColors();
  const W = useWidth();
  const vals = points.map((p) => p.value ?? 0);
  const top = max ?? Math.max(1, target ?? 0, ...vals);
  const slot = (W - PAD.l - PAD.r) / Math.max(1, points.length);
  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <Svg width={W} height={H}>
        <Line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke={c.border} strokeWidth={1} />
        <SvgText x={4} y={scaleY(top, top) + 4} fill={c.muted} fontSize={10}>
          {Math.round(top)}
        </SvgText>
        {points.map((p, i) => {
          const v = p.value ?? 0;
          const y = scaleY(v, top);
          return <Rect key={i} x={PAD.l + i * slot + slot * 0.15} y={y} width={slot * 0.7} height={H - PAD.b - y} rx={3} fill={c.primary} opacity={p.hollow ? 0.4 : 1} />;
        })}
        {target != null ? (
          <Line x1={PAD.l} x2={W - PAD.r} y1={scaleY(target, top)} y2={scaleY(target, top)} stroke={c.muted} strokeDasharray="4 4" strokeWidth={1} />
        ) : null}
        {points.length
          ? [0, points.length - 1].map((i, k) => (
              <SvgText key={k} x={k === 0 ? PAD.l : W - PAD.r - 30} y={H - 6} fill={c.muted} fontSize={10}>
                {points[i].label}
              </SvgText>
            ))
          : null}
      </Svg>
    </View>
  );
}

/** Chart with a "Show as table" toggle for screen readers and exact values (PFB accessibility). */
export function ChartOrTable({
  kind,
  points,
  target,
  max,
  unit = '',
  label,
  tableLabel,
  chartLabel,
}: {
  kind: 'line' | 'bar';
  points: Point[];
  target?: number;
  max?: number;
  unit?: string;
  label: string;
  tableLabel: string;
  chartLabel: string;
}) {
  const c = useColors();
  const [table, setTable] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      {table ? (
        <View style={{ gap: 4 }}>
          {points.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: c.text, fontSize: 15 }}>{p.label}</Text>
              <Text style={{ color: p.hollow ? c.muted : c.text, fontSize: 15 }}>{p.value == null ? '–' : `${p.value}${unit}${p.hollow ? ' *' : ''}`}</Text>
            </View>
          ))}
        </View>
      ) : kind === 'line' ? (
        <LineChart points={points} max={max} accessibilityLabel={label} />
      ) : (
        <BarChart points={points} target={target} max={max} accessibilityLabel={label} />
      )}
      <Text accessibilityRole="button" onPress={() => setTable(!table)} style={{ color: c.primary, fontSize: 15, fontWeight: '600', paddingVertical: 6 }}>
        {table ? chartLabel : tableLabel}
      </Text>
    </View>
  );
}
