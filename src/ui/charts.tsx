// SVG charts for Progress (06c PFB-002, PFB-005, PFB-006, PFB-010 to PFB-016): own-past comparison only, gaps never drawn as
// zeros or joined, hollow points for flagged values, real tables, and summaries for screen readers (chart accessibility
// review, round 2: items 1 to 11).
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { PROGRESS } from '../content/en/strings';
import { lineSegments, timeFraction } from '../domain/progress';
import type { LocalDate } from '../domain/dates';
import { Icon } from './icons';
import { Button } from './kit';
import { Text } from './text';
import { textScale } from './textSize';
import { FONTS, radius, space, type, useColors } from './theme';

export interface Point {
  label: string;
  value: number | null;
  /** Real date, for a time axis and for day-note markers. */
  date?: LocalDate;
  /** A flagged value: drawn hollow (line) or as an outline (bar), never faded (review item 3). */
  hollow?: boolean;
  /** This week or month, still in progress: a dashed outline. */
  current?: boolean;
  onTarget?: boolean;
  /** Words for the table and the point label. */
  note?: string | null;
  /** Value as text (with its unit) for labels; defaults to the number. */
  valueText?: string;
  /** Stacked parts of a bar (leaks by situation). */
  stack?: { key: string; value: number }[];
}

export interface Marker {
  date: LocalDate;
  text: string;
}

/** Chart label size follows the text size (review item 6): at least 12, larger with the system or in-app size. */
export function useChartText(): { font: number; extra: number } {
  const { fontScale } = useWindowDimensions();
  const k = Math.max(1, Math.min(2, textScale() * (Platform.OS === 'web' ? 1 : fontScale || 1)));
  const font = Math.max(12, Math.round(12 * k));
  return { font, extra: (font - 12) * 3 };
}

/** Chart height: taller on wide pages (Mac 02-desktop-patterns §4), and grown to fit larger labels. */
export function chartHeight(width: number, extra: number): number {
  return (width >= 600 ? 220 : 170) + extra;
}

interface FrameProps {
  summary: string;
  height: number;
  count: number;
  /** x position of point i for a given width (hover columns and the crosshair). */
  xAt: (i: number, w: number) => number;
  /** Words for point i (date, value, note). */
  tip: (i: number) => string;
  onSelect?: (i: number) => void;
  children: (w: number, active: number | null) => ReactNode;
}

/**
 * Measures the width, gives the chart one summary label for screen readers, and on the web lets the pointer or the
 * keyboard (Tab into the chart, then ← →) show the date, value and note of each point (Mac 02-desktop-patterns §4).
 */
function ChartFrame({ summary, height, count, xAt, tip, onSelect, children }: FrameProps) {
  const c = useColors();
  const [w, setW] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const web = Platform.OS === 'web';
  const onKey = (e: { key?: string; nativeEvent?: { key?: string }; preventDefault?: () => void }) => {
    const key = e.key ?? e.nativeEvent?.key;
    if (!count) return;
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      e.preventDefault?.();
      const from = active ?? (key === 'ArrowRight' ? -1 : count);
      setActive(Math.max(0, Math.min(count - 1, from + (key === 'ArrowRight' ? 1 : -1))));
    } else if (key === 'Home' || key === 'End') {
      e.preventDefault?.();
      setActive(key === 'Home' ? 0 : count - 1);
    } else if ((key === 'Enter' || key === ' ') && active != null && onSelect) {
      e.preventDefault?.();
      onSelect(active);
    } else if (key === 'Escape') setActive(null);
  };
  const bounds = (i: number) => {
    const x = xAt(i, w);
    const l = i === 0 ? 0 : (xAt(i - 1, w) + x) / 2;
    const r = i === count - 1 ? w : (x + xAt(i + 1, w)) / 2;
    return { left: l, width: Math.max(1, r - l) };
  };
  const tipW = Math.min(220, w);
  return (
    <View>
      <View
        onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))}
        accessible
        accessibilityRole="image"
        accessibilityLabel={web && count ? `${summary} ${PROGRESS.spoken.chartKeys}` : summary}
        {...(web ? ({ focusable: true, tabIndex: 0, onKeyDown: onKey, onBlur: () => setActive(null) } as object) : {})}
        style={{ width: '100%', height, borderRadius: radius.md }}
      >
        {w > 0 ? children(w, active) : null}
        {w > 0
          ? Array.from({ length: count }, (_, i) => (
              <Pressable
                key={i}
                accessible={false}
                focusable={false}
                importantForAccessibility="no"
                onHoverIn={() => setActive(i)}
                onHoverOut={() => setActive((a) => (a === i ? null : a))}
                onPress={() => {
                  setActive(i);
                  onSelect?.(i);
                }}
                style={{ position: 'absolute', top: 0, bottom: 0, ...bounds(i) }}
              />
            ))
          : null}
        {active != null && w > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: Math.max(0, Math.min(w - tipW, xAt(active, w) - tipW / 2)),
              width: tipW,
              padding: space(0.75),
              borderRadius: radius.md,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.inputBorder,
            }}
          >
            <Text style={[type('body-sm'), { color: c.text }]}>{tip(active)}</Text>
          </View>
        ) : null}
      </View>
      {web ? (
        <Text accessibilityLiveRegion="polite" style={visuallyHidden}>
          {active != null ? tip(active) : ''}
        </Text>
      ) : null}
    </View>
  );
}

const visuallyHidden = { position: 'absolute' as const, width: 1, height: 1, overflow: 'hidden' as const, opacity: 0 };

const PAD = { l: 34, r: 40, t: 26, b: 30 };

function xLabels(n: number, w: number): number[] {
  if (n <= 1) return n ? [0] : [];
  const fit = Math.max(2, Math.min(n, Math.floor(w / 90)));
  if (fit >= n) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (fit - 1);
  return Array.from({ length: fit }, (_, k) => Math.round(k * step));
}

/** Drops labels that would sit closer than `min` px to the one before (a time axis spaces points unevenly); keeps the last. */
function spaced(idx: number[], x: (i: number) => number, min: number): number[] {
  const out: number[] = [];
  idx.forEach((i, k) => {
    const last = k === idx.length - 1;
    while (last && out.length && x(i) - x(out[out.length - 1]) < min) out.pop();
    if (!out.length || x(i) - x(out[out.length - 1]) >= min || last) out.push(i);
  });
  return out;
}

/** A five-point star, the personal best mark (PFB-011). Drawn, not typed, so it is not an emoji. */
function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`);
  }
  return pts.join(' ');
}

export interface LineChartProps {
  points: Point[];
  max?: number;
  min?: number;
  summary: string;
  /** Hold length per point: "strong holds in a row" starts a new segment when it changes (PFB-011). */
  holds?: (number | null)[];
  /** Index of the personal best to mark with a star and its value (PFB-011). */
  best?: number;
  /** Time axis from..to (PFB-018 real dates). Without it, points are evenly spaced. */
  domain?: [LocalDate, LocalDate];
  markers?: Marker[];
  /** Meaningful-change band (PFB-013). */
  band?: { low: number; high: number } | null;
  onSelect?: (i: number) => void;
}

/** Line chart with breaks at gaps (PFB-002, AC-PFB-6) and a dashed "no check" connector across them. */
export function LineChart({ points, max, min = 0, summary, holds, best = -1, domain, markers = [], band, onSelect }: LineChartProps) {
  const c = useColors();
  const { font, extra } = useChartText();
  const [measured, setMeasured] = useState(0);
  const H = chartHeight(measured, extra);
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  const top = max ?? Math.max(1, ...vals) * 1.15;
  const plotB = H - PAD.b - extra / 2;
  const y = (v: number) => PAD.t + (plotB - PAD.t) * (1 - (v - min) / Math.max(1, top - min));
  const xAt = (i: number, W: number) => {
    const p = points[i];
    if (domain && p?.date) return PAD.l + (W - PAD.l - PAD.r) * timeFraction(p.date, domain[0], domain[1]);
    return points.length === 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l + (i * (W - PAD.l - PAD.r)) / (points.length - 1);
  };
  const xDate = (d: LocalDate, W: number) => (domain ? PAD.l + (W - PAD.l - PAD.r) * timeFraction(d, domain[0], domain[1]) : null);
  const seg = lineSegments(
    points.map((p) => p.value),
    holds
  );
  const last = (() => {
    for (let i = points.length - 1; i >= 0; i--) if (points[i].value != null) return i;
    return -1;
  })();
  const text = (p: Point) => p.valueText ?? (p.value == null ? '–' : String(p.value));
  return (
    <View onLayout={(e) => setMeasured(Math.floor(e.nativeEvent.layout.width))}>
      <ChartFrame
        summary={summary}
        height={H}
        count={points.length}
        xAt={xAt}
        tip={(i) => PROGRESS.point(points[i].label, points[i].value == null ? PROGRESS.noCheck : text(points[i]), points[i].note ?? null)}
        onSelect={onSelect}
      >
        {(W, active) => (
          <Svg width={W} height={H}>
            {band ? (
              <>
                <Rect x={PAD.l} y={y(Math.min(top, band.high))} width={W - PAD.l - PAD.r} height={Math.max(0, y(Math.max(min, band.low)) - y(Math.min(top, band.high)))} fill={c.soft} />
                <Line x1={PAD.l} x2={W - PAD.r} y1={y(Math.min(top, band.high))} y2={y(Math.min(top, band.high))} stroke={c.muted} strokeDasharray="2 3" strokeWidth={1} />
                <Line x1={PAD.l} x2={W - PAD.r} y1={y(Math.max(min, band.low))} y2={y(Math.max(min, band.low))} stroke={c.muted} strokeDasharray="2 3" strokeWidth={1} />
              </>
            ) : null}
            <Line x1={PAD.l} y1={plotB} x2={W - PAD.r} y2={plotB} stroke={c.muted} strokeWidth={1} />
            <SvgText x={4} y={y(top) + font / 3} fill={c.muted} fontSize={font} fontFamily={FONTS.regular}>
              {Math.round(top)}
            </SvgText>
            <SvgText x={4} y={plotB} fill={c.muted} fontSize={font} fontFamily={FONTS.regular}>
              {min}
            </SvgText>
            {active != null ? <Line x1={xAt(active, W)} x2={xAt(active, W)} y1={PAD.t - 6} y2={plotB} stroke={c.muted} strokeWidth={1} /> : null}
            {seg.gaps.map(([a, b], k) => {
              const xa = xAt(a, W);
              const xb = xAt(b, W);
              return (
                <Line key={`g${k}`} x1={xa} y1={y(points[a].value as number)} x2={xb} y2={y(points[b].value as number)} stroke={c.muted} strokeWidth={1} strokeDasharray="2 4" />
              );
            })}
            {seg.gaps.map(([a, b], k) =>
              xAt(b, W) - xAt(a, W) > font * 4 ? (
                <SvgText key={`gt${k}`} x={(xAt(a, W) + xAt(b, W)) / 2} y={plotB - 6} textAnchor="middle" fill={c.muted} fontSize={font} fontFamily={FONTS.regular}>
                  {PROGRESS.noCheck}
                </SvgText>
              ) : null
            )}
            {seg.runs
              .filter((r) => r.length > 1)
              .map((r, k) => (
                <Polyline
                  key={`r${k}`}
                  points={r.map((i) => `${xAt(i, W)},${y(points[i].value as number)}`).join(' ')}
                  fill="none"
                  stroke={c.primary}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            {points.map((p, i) =>
              p.value == null ? null : (
                <Circle key={i} cx={xAt(i, W)} cy={y(p.value)} r={i === active ? 6.5 : 5} fill={p.hollow ? c.card : c.primary} stroke={c.primary} strokeWidth={2} />
              )
            )}
            {best >= 0 && points[best]?.value != null ? (
              <>
                <Polygon points={star(xAt(best, W) - font * 0.9, y(points[best].value as number) - 14 - font / 3, font / 2)} fill={c.good} />
                <SvgText
                  x={xAt(best, W) - font * 0.3}
                  y={y(points[best].value as number) - 10}
                  fill={c.text}
                  fontSize={font}
                  fontFamily={FONTS.semibold}
                  fontWeight="600"
                >
                  {text(points[best])}
                </SvgText>
              </>
            ) : null}
            {last >= 0 && last !== best ? (
              <SvgText x={Math.min(W - 4, xAt(last, W) + 8)} y={y(points[last].value as number) + font / 3} textAnchor={xAt(last, W) + 40 > W ? 'end' : 'start'} fill={c.text} fontSize={font} fontFamily={FONTS.regular}>
                {text(points[last])}
              </SvgText>
            ) : null}
            {markers.map((m, k) => {
              const x = xDate(m.date, W);
              if (x == null) return null;
              return <Polygon key={`m${k}`} points={`${x},${plotB + 2} ${x - 5},${plotB + 10} ${x + 5},${plotB + 10}`} fill={c.muted} />;
            })}
            {spaced(xLabels(points.length, W), (i) => xAt(i, W), font * 5).map((i, k, all) => (
              <SvgText
                key={`x${k}`}
                x={xAt(i, W)}
                y={H - 4}
                textAnchor={all.length === 1 ? 'middle' : k === 0 ? 'start' : k === all.length - 1 ? 'end' : 'middle'}
                fill={c.muted}
                fontSize={font}
                fontFamily={FONTS.regular}
              >
                {points[i].label}
              </SvgText>
            ))}
          </Svg>
        )}
      </ChartFrame>
    </View>
  );
}

export interface BarChartProps {
  points: Point[];
  target?: number;
  max?: number;
  summary: string;
  /** Slots that have a day note (PFB-005), with the note's first words for the table. */
  markers?: number[];
  /** Fill per stack key (leaks by situation). */
  fills?: Record<string, string>;
  selected?: number | null;
  onSelect?: (i: number) => void;
}

/**
 * Bars: on target in green with a tick (never colour alone, review item 11), others in ink, this week as a dashed outline,
 * flagged as a solid outline (review item 3), a dashed target line with its value, and the current value labelled.
 */
export function BarChart({ points, target, max, summary, markers = [], fills, selected, onSelect }: BarChartProps) {
  const c = useColors();
  const { font, extra } = useChartText();
  const [measured, setMeasured] = useState(0);
  const H = chartHeight(measured, extra);
  const vals = points.map((p) => p.value ?? 0);
  const top = max ?? Math.max(1, target ?? 0, ...vals);
  const plotB = H - PAD.b - extra / 2;
  const y = (v: number) => PAD.t + (plotB - PAD.t) * (1 - v / Math.max(1, top));
  const slot = (W: number) => (W - PAD.l - PAD.r + 16) / Math.max(1, points.length);
  const xAt = (i: number, W: number) => PAD.l - 8 + i * slot(W) + slot(W) / 2;
  const text = (p: Point) => p.valueText ?? (p.value == null ? '–' : String(p.value));
  const labelIdx = (() => {
    for (let i = points.length - 1; i >= 0; i--) if (points[i].value != null) return i;
    return -1;
  })();
  return (
    <View onLayout={(e) => setMeasured(Math.floor(e.nativeEvent.layout.width))}>
      <ChartFrame
        summary={summary}
        height={H}
        count={points.length}
        xAt={xAt}
        tip={(i) => PROGRESS.point(points[i].label, points[i].value == null ? PROGRESS.spoken.noValue : text(points[i]), points[i].note ?? null)}
        onSelect={onSelect}
      >
        {(W, active) => {
          const s = slot(W);
          const bw = Math.max(3, s * 0.64);
          return (
            <Svg width={W} height={H}>
              <Line x1={PAD.l - 8} y1={plotB} x2={W - PAD.r + 8} y2={plotB} stroke={c.muted} strokeWidth={1} />
              <SvgText x={4} y={y(top) + font / 3} fill={c.muted} fontSize={font} fontFamily={FONTS.regular}>
                {Math.round(top)}
              </SvgText>
              {points.map((p, i) => {
                if (p.value == null) return null;
                const x = xAt(i, W) - bw / 2;
                const yy = y(p.value);
                const h = plotB - yy;
                const hl = i === active || i === selected;
                if (p.stack && fills) {
                  let base = plotB;
                  return (
                    <G key={i}>
                      {p.stack.map((part, k) => {
                        const ph = (plotB - y(part.value)) || 0;
                        base -= ph;
                        return <Rect key={k} x={x} y={base} width={bw} height={ph} fill={fills[part.key] ?? c.primary} stroke={c.card} strokeWidth={1} />;
                      })}
                      {hl ? <Rect x={x - 2} y={yy - 2} width={bw + 4} height={h + 2} fill="none" stroke={c.text} strokeWidth={1.5} rx={3} /> : null}
                    </G>
                  );
                }
                if (p.current || p.hollow) {
                  return (
                    <Rect
                      key={i}
                      x={x + 1}
                      y={yy + 1}
                      width={bw - 2}
                      height={Math.max(0, h - 1)}
                      rx={3}
                      fill="none"
                      stroke={hl ? c.text : c.primary}
                      strokeWidth={2}
                      strokeDasharray={p.current ? '4 3' : undefined}
                    />
                  );
                }
                return <Rect key={i} x={x} y={yy} width={bw} height={h} rx={3} fill={p.onTarget ? c.good : c.primary} stroke={hl ? c.text : undefined} strokeWidth={hl ? 2 : 0} />;
              })}
              {points.map((p, i) =>
                p.onTarget && !p.current && p.value != null && s >= 12 ? (
                  <Polyline
                    key={`t${i}`}
                    points={`${xAt(i, W) - 4},${y(p.value) - 8} ${xAt(i, W) - 1},${y(p.value) - 5} ${xAt(i, W) + 4},${y(p.value) - 11}`}
                    fill="none"
                    stroke={c.good}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null
              )}
              {target != null ? (
                <>
                  <Line x1={PAD.l - 8} x2={W - PAD.r + 8} y1={y(target)} y2={y(target)} stroke={c.muted} strokeDasharray="4 4" strokeWidth={1} />
                  <SvgText x={W - PAD.r + 12} y={y(target) + font / 3} fill={c.muted} fontSize={font} fontFamily={FONTS.regular}>
                    {target}
                  </SvgText>
                </>
              ) : null}
              {labelIdx >= 0 && s >= font * 1.6 ? (
                <SvgText
                  x={xAt(labelIdx, W)}
                  y={y(points[labelIdx].value as number) - (points[labelIdx].onTarget && !points[labelIdx].current ? 14 : 5)}
                  textAnchor="middle"
                  fill={c.text}
                  fontSize={font}
                  fontFamily={FONTS.semibold}
                  fontWeight="600"
                >
                  {text(points[labelIdx])}
                </SvgText>
              ) : null}
              {markers.map((i) => (
                <Polygon key={`m${i}`} points={`${xAt(i, W)},${plotB + 2} ${xAt(i, W) - 5},${plotB + 10} ${xAt(i, W) + 5},${plotB + 10}`} fill={c.muted} />
              ))}
              {active != null ? <Line x1={xAt(active, W)} x2={xAt(active, W)} y1={PAD.t - 6} y2={plotB} stroke={c.muted} strokeWidth={1} /> : null}
              {xLabels(points.length, W).map((i, k, all) => (
                <SvgText
                  key={`x${k}`}
                  x={xAt(i, W)}
                  y={H - 4}
                  textAnchor={all.length === 1 ? 'middle' : k === 0 ? 'start' : k === all.length - 1 ? 'end' : 'middle'}
                  fill={c.muted}
                  fontSize={font}
                  fontFamily={FONTS.regular}
                >
                  {points[i].label}
                </SvgText>
              ))}
            </Svg>
          );
        }}
      </ChartFrame>
    </View>
  );
}

export interface Column {
  title: string;
  /** Relative width. */
  flex?: number;
  align?: 'left' | 'right';
}

/**
 * A real table (review item 2, PFB-006): a header row with units, the note in words, and table roles on the web. `strong`
 * marks a row (the selected bar, the best value).
 */
export function DataTable({ columns, rows, label, strong }: { columns: Column[]; rows: string[][]; label: string; strong?: number | null }) {
  const c = useColors();
  const cell = (t: string, k: number, header: boolean, bold: boolean) => (
    <View key={k} role={header ? 'columnheader' : 'cell'} style={{ flex: columns[k]?.flex ?? 1, minWidth: 0, paddingVertical: space(0.75), paddingRight: space(0.75) }}>
      <Text style={[type(header ? 'heading-sm' : 'body-sm'), { color: header ? c.muted : c.text, textAlign: columns[k]?.align ?? 'left', fontWeight: bold ? '600' : undefined }]}>{t}</Text>
    </View>
  );
  return (
    <View role="table" aria-label={label} accessibilityLabel={Platform.OS === 'web' ? undefined : label}>
      <View role="row" style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: c.inputBorder }}>
        {columns.map((col, k) => cell(col.title, k, true, false))}
      </View>
      {rows.map((r, i) => (
        <View
          key={i}
          role="row"
          accessible={Platform.OS !== 'web'}
          accessibilityLabel={Platform.OS !== 'web' ? r.map((v, k) => `${columns[k]?.title}: ${v || '–'}`).join(', ') : undefined}
          style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: i === strong ? c.selected : 'transparent' }}
        >
          {r.map((v, k) => cell(v, k, false, i === strong))}
        </View>
      ))}
    </View>
  );
}

/**
 * A chart with a "Show as table" button of full touch size (review item 9). With `toggle` false (the Mac's right panel
 * shows the table, decision M3), only the chart shows.
 */
export function ChartOrTable({ chart, table, toggle = true }: { chart: ReactNode; table: ReactNode; toggle?: boolean }) {
  const [showTable, setShowTable] = useState(false);
  if (!toggle) return <>{chart}</>;
  return (
    <View style={{ gap: space(1) }}>
      {showTable ? table : chart}
      <Button
        kind="quiet"
        label={showTable ? PROGRESS.chart : PROGRESS.table}
        onPress={() => setShowTable(!showTable)}
        style={{ alignSelf: 'flex-start', paddingHorizontal: space(1), minWidth: 0 }}
      />
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
