// Session timer pictures (spec 03 session screen; design round 2: T1-T4, D1-D3, M2; motion MO-1 to MO-6).
// Ring: the thick ring is the current step, the thin outer ring the whole session in blocks.
// Wave: up is squeeze, the baseline is let go; it scrolls so the next squeeze shows, with the session bar under it.
// One clock: each animation frame reads the runner (phase, time left, elapsed) and draws one SVG. The frame also
// lets the parent advance the runner, so a cue and its picture change on the same frame (motion 3.5).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, PanResponder, Platform, Pressable, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { SESSION } from '../../content/en/exercise';
import { DESKTOP } from '../../content/en/strings';
import type { TimerView } from '../../data/repositories/settings';
import type { SessionRunner } from '../../domain/session/engine';
import {
  blockSpans,
  breath,
  breathStep,
  BREATH_IN_S,
  BREATH_OUT_S,
  indexAt,
  levelAt,
  placeAll,
  ringStep,
  waveWindow,
  type BlockSpan,
  type Placed,
} from '../../domain/session/shape';
import { ViewSwitch } from '../../ui/kit';
import { fadeOut, FADE_MS, mixColor } from '../../ui/mix';
import { fontFor, space, useColors, type Colors } from '../../ui/theme';
import { Text } from '../../ui/text';

const mono = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());
/** Android draws at about 30 frames a second to stay cheap on low-cost phones; the motion is slow, so it stays smooth. */
const MIN_FRAME_MS = Platform.OS === 'android' ? 30 : 0;
const FADE_S = FADE_MS / 1000;

/** The schedule, placed in seconds, cached while the runner keeps the same list (it changes only on a jump). */
function useSchedule(runner: SessionRunner): { list: Placed[]; spans: BlockSpan[] } {
  const cache = useRef<{ src: unknown; list: Placed[]; spans: BlockSpan[] } | null>(null);
  const src = runner.schedule();
  if (!cache.current || cache.current.src !== src || cache.current.list.length !== src.length) {
    const list = placeAll(src);
    cache.current = { src, list, spans: blockSpans(list) };
  }
  return cache.current;
}

/** Redraws once per animation frame while time moves; still while paused. */
function useFrameClock(runner: SessionRunner, onFrame?: () => void): number {
  const [now, setNow] = useState(mono);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;
  useEffect(() => {
    let id = 0;
    let last = 0;
    let drawnElapsed = -1;
    const loop = () => {
      id = requestAnimationFrame(loop);
      const n = mono();
      if (n - last < MIN_FRAME_MS) return;
      last = n;
      frameRef.current?.();
      const e = runner.elapsedMs(n);
      if (e === drawnElapsed) return;
      drawnElapsed = e;
      setNow(n);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [runner]);
  return now;
}

interface Step {
  t: number;
  total: number;
  index: number;
  u: number;
  left: number;
  pct: number;
}

function readStep(runner: SessionRunner, now: number): Step {
  const total = runner.totalS();
  const t = runner.elapsedMs(now) / 1000;
  const p = runner.currentPhase();
  const remaining = runner.phaseRemainingS(now);
  return {
    t,
    total,
    index: runner.currentIndex(),
    u: p ? Math.max(0, p.durationS - remaining) : 0,
    left: Math.max(0, Math.ceil(remaining - 1e-6)),
    pct: total > 0 ? Math.round((t / total) * 100) : 0,
  };
}

/** The squeeze tone of the number and the dot: fades in over 150 ms at a squeeze, out over 150 ms at the let-go (MO-5). */
function squeezeTone(kind: string | undefined, u: number): number {
  if (kind === 'squeeze') return fadeOut(u / FADE_S);
  if (kind === 'release') return 1 - fadeOut(u / FADE_S);
  return 0;
}

export function SessionTimer({
  runner,
  view,
  reduced,
  wide,
  phaseAtDot,
  phaseWord,
  onFrame,
}: {
  runner: SessionRunner;
  view: TimerView;
  reduced: boolean;
  /** Desktop layout: bigger ring, wave as wide as the page. */
  wide: boolean;
  /** Draw the phase word above the countdown at the now dot (wave on the desktop, 04-final-critique). */
  phaseAtDot?: boolean;
  phaseWord?: string;
  onFrame?: () => void;
}) {
  const now = useFrameClock(runner, onFrame);
  const sched = useSchedule(runner);
  const step = readStep(runner, now);
  const [w, setW] = useState(0);
  return (
    <View style={{ width: '100%', alignItems: 'center' }} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w > 0 ? (
        view === 'wave' ? (
          <Wave runner={runner} step={step} sched={sched} width={Math.min(w, 1100)} wide={wide} reduced={reduced} phaseAtDot={phaseAtDot} phaseWord={phaseWord} />
        ) : (
          <RingTimer runner={runner} step={step} sched={sched} size={Math.min(w, wide ? 320 : 280)} wide={wide} reduced={reduced} />
        )
      ) : (
        <View style={{ height: view === 'wave' ? waveHeight(wide) : wide ? 320 : 280 }} />
      )}
    </View>
  );
}

/** Arc of a circle from fraction a0 to a1 (clockwise from the top), drawn with a dash on a circle. */
function Arc({ r, a0, a1, width, color, opacity = 1 }: { r: number; a0: number; a1: number; width: number; color: string; opacity?: number }) {
  const len = 2 * Math.PI * r;
  const d = Math.max(0, a1 - a0);
  if (d <= 0.0005) return null;
  return (
    <Circle
      cx={150}
      cy={150}
      r={r}
      stroke={color}
      strokeOpacity={opacity}
      strokeWidth={width}
      fill="none"
      strokeDasharray={[len * d, len]}
      strokeDashoffset={-len * a0}
    />
  );
}

function RingTimer({ runner, step, sched, size, wide, reduced }: { runner: SessionRunner; step: Step; sched: { spans: BlockSpan[] }; size: number; wide: boolean; reduced: boolean }) {
  const c = useColors();
  const p = runner.currentPhase();
  const kind = p?.kind;
  const rs = p ? ringStep(p.kind, step.u, p.durationS) : { fill: 0, tone: 'rest' as const, mix: 1 };
  const relax = kind === 'relax';
  // D1: during relax the ring breathes, 4 s in and 6 s out. With Reduce motion it keeps its size (MO 3.4).
  const b = relax ? breath(step.u) : 0;
  const width = relax && !reduced ? 12 + 14 * b : 18;
  const arcColor =
    kind === 'squeeze' ? mixColor(c.muted, c.squeeze, fadeOut(step.u / FADE_S)) : rs.tone === 'squeeze' ? mixColor(c.squeeze, c.muted, rs.mix) : c.muted;
  const arcOpacity = rs.tone === 'squeeze' ? 1 - 0.55 * rs.mix : 0.45;
  const tone = squeezeTone(kind, step.u);
  const numColor = mixColor(c.text, c.squeeze, tone);
  const gap = 0.012;
  const total = step.total || 1;
  const pos = step.t / total;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={DESKTOP.sessionRingAlt(step.left, step.pct)}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} viewBox="0 0 300 300" style={{ position: 'absolute' }}>
        <G transform="rotate(-90 150 150)">
          {/* Thin outer ring: the whole session, one segment per block, creeping smoothly (MO-6, D3, HE-06). */}
          {sched.spans.map((s) => {
            const a0 = s.startS / total + gap / 2;
            const a1 = s.endS / total - gap / 2;
            return (
              <G key={s.blockIndex}>
                <Arc r={140} a0={a0} a1={a1} width={3} color={c.border} />
                <Arc r={140} a0={a0} a1={Math.min(a1, Math.max(a0, pos))} width={3} color={c.muted} />
              </G>
            );
          })}
          {/* Thick ring: this step. Fills while squeezing, drains over the 2 s let-go, grey counts rest (MO-1, MO-2). */}
          <Circle cx={150} cy={150} r={104} stroke={c.border} strokeWidth={width} fill="none" />
          <Arc r={104} a0={0} a1={rs.fill} width={width} color={arcColor} opacity={arcOpacity} />
        </G>
        {/* Rep dots for this block: done, now (blue, bigger), still to come. */}
        {p && p.reps > 0 && p.block !== 'relax'
          ? Array.from({ length: p.reps }, (_, i) => {
              const ang = -Math.PI / 2 + (i - (p.reps - 1) / 2) * 0.13;
              const cur = i === p.rep - 1 && kind === 'squeeze';
              const done = i < p.rep - 1 || (i === p.rep - 1 && kind !== 'squeeze' && kind !== 'transition');
              return (
                <Circle
                  key={i}
                  cx={150 + 124 * Math.cos(ang)}
                  cy={150 + 124 * Math.sin(ang)}
                  r={cur ? 3.6 : 2.6}
                  fill={cur ? c.squeeze : done ? c.text : c.controlOff}
                />
              );
            })
          : null}
      </Svg>
      <Text style={{ fontSize: wide ? 88 : 64, fontWeight: '700', color: numColor, fontVariant: ['tabular-nums'] }} maxFontSizeMultiplier={1.3}>
        {step.left}
      </Text>
      {reduced ? <BreathCue active={relax} u={step.u} c={c} /> : null}
    </View>
  );
}

/** Reduce motion: the breathing pacer as words and a thin bar that fills (in) and empties (out). */
function BreathCue({ active, u, c, align = 'center' }: { active: boolean; u: number; c: Colors; align?: 'center' | 'flex-end' }) {
  const m = ((u % (BREATH_IN_S + BREATH_OUT_S)) + BREATH_IN_S + BREATH_OUT_S) % (BREATH_IN_S + BREATH_OUT_S);
  const inStep = breathStep(u) === 'in';
  const f = inStep ? m / BREATH_IN_S : 1 - (m - BREATH_IN_S) / BREATH_OUT_S;
  return (
    <View style={{ height: 34, alignItems: align, justifyContent: 'center', gap: 4 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted }}>{active ? (inStep ? SESSION.breatheIn : SESSION.breatheOut) : ''}</Text>
      {active ? (
        <View style={{ width: 72, height: 3, borderRadius: 2, backgroundColor: c.border }}>
          <View style={{ width: 72 * Math.max(0, Math.min(1, f)), height: 3, borderRadius: 2, backgroundColor: c.muted }} />
        </View>
      ) : null}
    </View>
  );
}

function waveHeight(wide: boolean): number {
  return wide ? 300 : 280;
}

function Wave({
  runner,
  step,
  sched,
  width: W,
  wide,
  reduced,
  phaseAtDot,
  phaseWord,
}: {
  runner: SessionRunner;
  step: Step;
  sched: { list: Placed[]; spans: BlockSpan[] };
  width: number;
  wide: boolean;
  reduced: boolean;
  phaseAtDot?: boolean;
  phaseWord?: string;
}) {
  const c = useColors();
  const H = waveHeight(wide);
  const padL = 8;
  const padR = 8;
  const top = phaseAtDot ? 84 : 70;
  const base = wide ? 226 : 206;
  const barY = base + 34;
  const p = runner.currentPhase();
  const { list, spans } = sched;
  const t = step.t;
  // About 24 px a second on a phone (14 s in view); 40 px a second on a wide window, up to 30 s ahead.
  const span = wide ? Math.max(14, Math.min(30, W / 40)) : 14;
  const [ws, we] = waveWindow(t, span, 0.32, reduced, spans);
  const X = (tt: number) => padL + ((tt - ws) / (we - ws)) * (W - padL - padR);
  const Y = (l: number) => base - l * (base - top);
  const stepPx = Platform.OS === 'android' ? 3.5 : 2.5;
  const line = (from: number, to: number, close?: boolean) => {
    if (to <= from) return '';
    const n = Math.max(2, Math.ceil((X(to) - X(from)) / stepPx));
    let hint = Math.max(0, indexAt(list, from));
    let d = '';
    for (let i = 0; i <= n; i++) {
      const tt = from + ((to - from) * i) / n;
      hint = Math.max(0, indexAt(list, tt, hint));
      d += `${i ? 'L' : 'M'}${X(tt).toFixed(1)},${Y(levelAt(list, tt, hint)).toFixed(1)}`;
    }
    if (close) d += `L${X(to).toFixed(1)},${base}L${X(from).toFixed(1)},${base}Z`;
    return d;
  };
  const nowX = X(t);
  const ny = Y(levelAt(list, t, Math.max(0, step.index)));
  // Soft fill under the squeeze in progress and its let-go.
  let fill = '';
  if (p && (p.kind === 'squeeze' || p.kind === 'release')) {
    const sqI = p.kind === 'squeeze' ? step.index : step.index - 1;
    const sq = list[sqI];
    if (sq && sq.phase.kind === 'squeeze') {
      const rel = list[sqI + 1];
      fill = line(sq.startS, sq.startS + sq.phase.durationS + (rel?.phase.kind === 'release' ? rel.phase.durationS : 0), true);
    }
  }
  const tone = squeezeTone(p?.kind, step.u);
  const dotColor = mixColor(c.text, c.squeeze, tone);
  // The countdown rides on its own row above the top line, so it never covers the words or the wave.
  const countY = top - 22;
  const total = step.total || 1;
  const bw = W - padL - padR;
  const font = fontFor('700').fontFamily;
  const semi = fontFor('600').fontFamily;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={DESKTOP.sessionWaveAlt(step.left, step.pct)}
      style={{ width: W, height: H }}
    >
      <Svg width={W} height={H}>
        <Line x1={padL} y1={top} x2={W - padR} y2={top} stroke={c.border} strokeWidth={1} strokeDasharray={[2, 4]} />
        <Line x1={padL} y1={base} x2={W - padR} y2={base} stroke={c.border} strokeWidth={1} strokeDasharray={[2, 4]} />
        <SvgText x={padL} y={top - 8} fill={c.muted} fontSize={11} fontFamily={semi} letterSpacing={0.6}>
          {SESSION.waveTop.toUpperCase()}
        </SvgText>
        <SvgText x={padL} y={base + 18} fill={c.muted} fontSize={11} fontFamily={semi} letterSpacing={0.6}>
          {SESSION.waveBase.toUpperCase()}
        </SvgText>
        {fill ? <Path d={fill} fill={c.squeeze} fillOpacity={0.12} /> : null}
        {/* Past dimmed, ahead full (T2: long holds spike, hold flat, let go over 2 s, rest; quick squeezes a short flat top). */}
        <Path d={line(ws, Math.min(t, we))} stroke={c.squeeze} strokeOpacity={0.35} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" fill="none" />
        <Path d={line(Math.max(t, ws), we)} stroke={c.squeeze} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" fill="none" />
        <Line x1={nowX} y1={ny} x2={nowX} y2={base + 10} stroke={c.border} strokeWidth={1} />
        <Circle cx={nowX} cy={ny} r={10} fill={c.bg} />
        <Circle cx={nowX} cy={ny} r={6.5} fill={dotColor} />
        {phaseAtDot && phaseWord ? (
          <SvgText x={nowX} y={countY - 36} fill={dotColor} fontSize={20} fontFamily={font} textAnchor="middle">
            {phaseWord}
          </SvgText>
        ) : null}
        <SvgText x={nowX} y={countY} fill={dotColor} fontSize={wide ? 34 : 30} fontFamily={font} textAnchor="middle">
          {String(step.left)}
        </SvgText>
        {/* The whole session, one segment per block (D3 keeps the wave's own bar). */}
        {spans.map((s) => {
          const x0 = padL + (s.startS / total) * bw + 2;
          const x1 = padL + (s.endS / total) * bw - 2;
          const f = Math.min(x1, Math.max(x0, padL + (t / total) * bw));
          return (
            <G key={s.blockIndex}>
              <Rect x={x0} y={barY} width={Math.max(0, x1 - x0)} height={4} rx={2} fill={c.border} />
              {f > x0 ? <Rect x={x0} y={barY} width={f - x0} height={4} rx={2} fill={c.muted} /> : null}
            </G>
          );
        })}
        <SvgText x={padL} y={barY + 20} fill={c.muted} fontSize={12} fontFamily={semi}>
          {SESSION.sessionBar}
        </SvgText>
        <SvgText x={W - padR} y={barY + 20} fill={c.muted} fontSize={12} fontFamily={semi} textAnchor="end">
          {SESSION.percent(step.pct)}
        </SvgText>
      </Svg>
      {reduced ? (
        <View style={{ position: 'absolute', right: padR, top: 0 }}>
          <BreathCue active={p?.kind === 'relax'} u={step.u} c={c} align="flex-end" />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The timer with its view switch. Phone: swipe sideways inside the timer, or tap the dots under it. Desktop: a
 * "Ring · Wave" control above (V switches too, set by the screen). Only the shown view is drawn.
 */
export function TimerSwitcher({
  view,
  onView,
  desktop,
  reduced,
  children,
}: {
  view: TimerView;
  onView: (v: TimerView) => void;
  desktop: boolean;
  reduced: boolean;
  children: ReactNode;
}) {
  const c = useColors();
  const options = useMemo(
    () => [
      { value: 'ring' as TimerView, label: DESKTOP.sessionViewRing },
      { value: 'wave' as TimerView, label: DESKTOP.sessionViewWave },
    ],
    []
  );
  const drag = useRef(new Animated.Value(0)).current;
  const viewRef = useRef(view);
  viewRef.current = view;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;
  const widthRef = useRef(1);
  const pan = useMemo(() => {
    // Swipes that start near the screen edge belong to the system Back gesture, not to the timer.
    const EDGE = 32;
    const nearEdge = (x0: number) => x0 < EDGE || x0 > Dimensions.get('window').width - EDGE;
    const native = Platform.OS !== 'web';
    return PanResponder.create({
      // g.x0 is set only once the gesture is granted, so the start comes from the touch now minus the distance moved.
      onMoveShouldSetPanResponder: (e, g) => !nearEdge(e.nativeEvent.pageX - g.dx) && Math.abs(g.dx) > 12 && Math.abs(g.dx) > 1.5 * Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (reduced) return;
        const room = viewRef.current === 'ring' ? Math.min(0, g.dx) : Math.max(0, g.dx);
        drag.setValue(room * 0.5);
      },
      onPanResponderRelease: (_, g) => {
        const th = widthRef.current * 0.18;
        const to: TimerView | null = g.dx < -th && viewRef.current === 'ring' ? 'wave' : g.dx > th && viewRef.current === 'wave' ? 'ring' : null;
        if (to) {
          drag.setValue(0);
          onViewRef.current(to);
        } else if (reduced) drag.setValue(0);
        else Animated.spring(drag, { toValue: 0, friction: 8, tension: 80, useNativeDriver: native }).start();
      },
      onPanResponderTerminate: () => drag.setValue(0),
      onPanResponderTerminationRequest: () => true,
    });
  }, [drag, reduced]);
  if (desktop) {
    return (
      <View style={{ width: '100%', alignItems: 'center', gap: space(1.5) }}>
        <View style={{ alignSelf: 'center' }}>
          <ViewSwitch options={options} value={view} onChange={onView} label={DESKTOP.sessionView} />
        </View>
        {children}
      </View>
    );
  }
  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      <Animated.View
        {...pan.panHandlers}
        onLayout={(e) => (widthRef.current = e.nativeEvent.layout.width || 1)}
        style={{ width: '100%', alignItems: 'center', transform: [{ translateX: drag }] }}
      >
        {children}
      </Animated.View>
      <View accessibilityRole="radiogroup" accessibilityLabel={DESKTOP.sessionView} style={{ flexDirection: 'row', justifyContent: 'center' }}>
        {options.map((o) => {
          const on = o.value === view;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: on }}
              onPress={() => onView(o.value)}
              hitSlop={8}
              style={{ paddingHorizontal: 8, paddingVertical: 10 }}
            >
              <View style={{ width: on ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: on ? c.text : c.inputBorder }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
