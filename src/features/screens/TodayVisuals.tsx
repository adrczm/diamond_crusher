// Small drawings for Today (round 2, A1 and A3): segmented rings, the session's shape, check bars and position badges.
// All are still pictures (no animation), so Reduce motion has nothing to change. Each has one spoken sentence.
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { timeline, type SessionPlan } from '../../domain/session/plan';
import type { Position } from '../../domain/types';
import { useColors } from '../../ui/theme';

/**
 * A ring cut into `total` equal parts, `done` of them filled. Empty parts use the input outline grey, which meets 3:1
 * on cards (WCAG 1.4.11), so an empty day is visible without colour.
 */
export function SegRing({
  done,
  total,
  size,
  stroke,
  color,
  tick,
}: {
  done: number;
  total: number;
  size: number;
  stroke: number;
  color: string;
  /** Draw a tick in the middle (the day's plan is done). */
  tick?: boolean;
}) {
  const c = useColors();
  const n = Math.max(1, total);
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const gap = n > 1 ? Math.min(3, len / n / 3) : 0;
  const seg = len / n;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: n }, (_, i) => (
        <Circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={i < done ? color : c.inputBorder}
          strokeWidth={i < done ? stroke : Math.max(1.5, stroke / 2)}
          strokeDasharray={`${Math.max(seg - gap, 1)} ${len - Math.max(seg - gap, 1)}`}
          strokeDashoffset={-i * seg + len / 4}
        />
      ))}
      {tick ? (
        <Path
          d={`M${size * 0.33} ${size * 0.52} l${size * 0.1} ${size * 0.1} l${size * 0.23} ${-size * 0.23}`}
          fill="none"
          stroke={color}
          strokeWidth={Math.max(2, size / 14)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </Svg>
  );
}

/** Points of the session's shape: flat for relax and rest, flat tops for holds, spikes for quick squeezes (HE-10, T2). */
export function shapePoints(plan: SessionPlan, w: number, h: number): string {
  const phases = timeline(plan);
  const total = phases.reduce((s, p) => s + p.durationS, 0) || 1;
  const base = h - 6;
  const top = 6;
  const pts: [number, number][] = [[0, base]];
  let t = 0;
  const x = (s: number) => (s / total) * w;
  for (const p of phases) {
    const x0 = x(t);
    const x1 = x(t + p.durationS);
    if (p.kind === 'squeeze') {
      if (p.block === 'flick') {
        pts.push([x0, base], [(x0 + x1) / 2, top + 4], [x1, base]);
      } else {
        // A quick rise, a flat hold (half strength for steady holds).
        const y = p.block === 'endurance' ? (base + top) / 2 : top;
        pts.push([x0, base], [Math.min(x0 + 1.5, x1), y], [x1, y]);
      }
    } else if (p.kind === 'release') {
      pts.push([x1, base]);
    } else {
      pts.push([x1, base]);
    }
    t += p.durationS;
  }
  return pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
}

/** The session's shape, stretched to the width it has. */
export function SessionShape({ plan, label }: { plan: SessionPlan; label: string }) {
  const c = useColors();
  const [w, setW] = useState(0);
  const h = 44;
  const pts = w > 0 ? shapePoints(plan, w, h) : '';
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ height: h }} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w > 0 ? (
        <Svg width={w} height={h}>
          <Path d={`M${pts.split(' ').join(' L')} L${w},${h} L0,${h} Z`} fill={c.release} opacity={0.35} />
          <Path d={`M${pts.split(' ').join(' L')}`} fill="none" stroke={c.squeeze} strokeWidth={2} strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

/** One small bar per monthly check; the latest is green. Heights only, no axis (a tile accent, not a chart). */
export function CheckBars({ values, label }: { values: number[]; label: string }) {
  const c = useColors();
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const w = 8 + values.length * 10;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={w} height={26}>
        {values.map((v, i) => {
          const bh = Math.max((v / max) * 20, 2);
          return <Rect key={i} x={4 + i * 10} y={24 - bh} width={6} height={bh} rx={1.5} fill={i === values.length - 1 ? c.good : c.inputBorder} />;
        })}
      </Svg>
    </View>
  );
}

const POSE: Record<string, string> = {
  lying: 'M3 15h18M5 15v-3h6l3 3M7 11a1.6 1.6 0 1 0 0-.01',
  sitting: 'M9 4.5a1.5 1.5 0 1 0 0 .01M9 7v6h6v6M9 13l-3 6M5 13h10',
  standing: 'M12 3.5a1.5 1.5 0 1 0 0 .01M12 6v8M12 14l-3 6M12 14l3 6M8 9h8',
};

/** A dark round badge with a figure lying, sitting or standing. Decorative: the row names the position in words. */
export function PositionBadge({ position }: { position: Position }) {
  const c = useColors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d={POSE[position] ?? POSE.standing} fill="none" stroke={c.onPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/** Good-week pips: filled for done, outlined for still to come. */
export function Pips({ done, total }: { done: number; total: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{ width: 14, height: 6, borderRadius: 3, backgroundColor: i < done ? c.good : 'transparent', borderWidth: 1.5, borderColor: i < done ? c.good : c.inputBorder }}
        />
      ))}
    </View>
  );
}
