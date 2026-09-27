// Minimal SVG charts (06c PFB-010 to PFB-016): own-past comparison only, hollow points for flagged values.
import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Text } from './text';
import Svg, { Circle, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { Icon } from './icons';
import { FONTS, space, type, useColors } from './theme';

export interface Point {
  label: string;
  value: number | null;
  hollow?: boolean;
}

const H = 160;
const PAD = { l: 32, r: 12, t: 12, b: 24 };

/** Charts fill the card they sit in (measured), falling back to the window on first draw. */
function useWidth(measured?: number) {
  const { width } = useWindowDimensions();
  return measured && measured > 0 ? Math.floor(measured) : Math.min(width - 64, 560);
}

function scaleY(v: number, max: number) {
  return PAD.t + (H - PAD.t - PAD.b) * (1 - v / Math.max(1, max));
}

export function LineChart({ points, max, accessibilityLabel, width }: { points: Point[]; max?: number; accessibilityLabel: string; width?: number }) {
  const c = useColors();
  const W = useWidth(width);
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  const top = max ?? Math.max(1, ...vals) * 1.15;
  const step = points.length > 1 ? (W - PAD.l - PAD.r) / (points.length - 1) : 0;
  // One point sits in the middle with one label under it (UX audit M5: two labels at one x overlapped).
  const x0 = points.length === 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l;
  const xy = points.map((p, i) => ({ x: x0 + i * step, y: p.value == null ? null : scaleY(p.value, top), p }));
  const drawn = xy.filter((q) => q.y != null);
  const line = drawn.map((q) => `${q.x},${q.y}`).join(' ');
  const area = drawn.length > 1 ? `${drawn[0].x},${H - PAD.b} ${line} ${drawn[drawn.length - 1].x},${H - PAD.b}` : '';
  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <Svg width={W} height={H}>
        <Line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke={c.border} strokeWidth={1} />
        <SvgText x={4} y={scaleY(top, top) + 4} fill={c.muted} fontSize={11} fontFamily={FONTS.regular}>
          {Math.round(top)}
        </SvgText>
        <SvgText x={4} y={H - PAD.b} fill={c.muted} fontSize={11} fontFamily={FONTS.regular}>
          0
        </SvgText>
        {area ? <Polygon points={area} fill={c.primary} opacity={0.08} /> : null}
        {line ? <Polyline points={line} fill="none" stroke={c.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {xy.map((q, i) =>
          q.y == null ? null : (
            <Circle key={i} cx={q.x} cy={q.y} r={5} fill={q.p.hollow ? c.bg : c.primary} stroke={c.primary} strokeWidth={2} />
          )
        )}
        {xy.length === 1 ? (
          <SvgText x={xy[0].x} y={H - 6} textAnchor="middle" fill={c.muted} fontSize={11} fontFamily={FONTS.regular}>
            {xy[0].p.label}
          </SvgText>
        ) : xy.length ? (
          [xy[0], xy[xy.length - 1]].map((q, i) => (
            <SvgText key={i} x={q.x} y={H - 6} textAnchor={i === 0 ? 'start' : 'end'} fill={c.muted} fontSize={11} fontFamily={FONTS.regular}>
              {q.p.label}
            </SvgText>
          ))
        ) : null}
      </Svg>
    </View>
  );
}

export function BarChart({
  points,
  target,
  max,
  accessibilityLabel,
  width,
}: {
  points: Point[];
  target?: number;
  max?: number;
  accessibilityLabel: string;
  width?: number;
}) {
  const c = useColors();
  const W = useWidth(width);
  const vals = points.map((p) => p.value ?? 0);
  const top = max ?? Math.max(1, target ?? 0, ...vals);
  const slot = (W - PAD.l - PAD.r) / Math.max(1, points.length);
  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <Svg width={W} height={H}>
        <Line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke={c.border} strokeWidth={1} />
        <SvgText x={4} y={scaleY(top, top) + 4} fill={c.muted} fontSize={11} fontFamily={FONTS.regular}>
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
        {points.length === 1 ? (
          <SvgText x={PAD.l + slot / 2} y={H - 6} textAnchor="middle" fill={c.muted} fontSize={11} fontFamily={FONTS.regular}>
            {points[0].label}
          </SvgText>
        ) : points.length ? (
          [0, points.length - 1].map((i, k) => (
            <SvgText key={k} x={k === 0 ? PAD.l : W - PAD.r} y={H - 6} textAnchor={k === 0 ? 'start' : 'end'} fill={c.muted} fontSize={11} fontFamily={FONTS.regular}>
              {points[i].label}
            </SvgText>
          ))
        ) : null}
      </Svg>
    </View>
  );
}

/** Stands in for a chart that has too little data to mean anything yet (UX audit M5): a small drawing and one line. */
export function ChartEmpty({ title, body }: { title: string; body: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(1) }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="progress" size={28} color={c.muted} />
      </View>
      <View style={{ flex: 1, gap: space(0.5) }}>
        <Text style={[type('heading-sm'), { color: c.text }]}>{title}</Text>
        <Text style={[type('body-sm'), { color: c.muted }]}>{body}</Text>
      </View>
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
  const [w, setW] = useState(0);
  return (
    <View style={{ gap: 8 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
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
        <LineChart points={points} max={max} accessibilityLabel={label} width={w} />
      ) : (
        <BarChart points={points} target={target} max={max} accessibilityLabel={label} width={w} />
      )}
      <Text accessibilityRole="button" onPress={() => setTable(!table)} style={{ color: c.link, fontSize: 15, fontWeight: '600', paddingVertical: 6 }}>
        {table ? chartLabel : tableLabel}
      </Text>
    </View>
  );
}
