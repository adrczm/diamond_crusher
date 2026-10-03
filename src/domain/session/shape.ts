// Session timer shapes (spec 03 session screen, motion MO-1 to MO-7, Adrian T2 and D2, 2026-10-03). Pure functions, so
// the ring, the wave and the tests read the same muscle curve from the runner's clock.
import { RELEASE_S, type BlockType, type PhaseKind, type TimelinePhase } from './plan';

/** Cosine ease 0 to 1 (slow in, slow out), clamped. */
export function ease(x: number): number {
  const v = Math.max(0, Math.min(1, x));
  return 0.5 - 0.5 * Math.cos(Math.PI * v);
}

/** The steady level of a long hold, after the onset spike (T2: a quick spike up, then a flat hold). */
export const HOLD_LEVEL = 0.86;
/** Steady holds are done at half strength (INTENSITY.endurance), so the wave draws them lower. */
export const STEADY_LEVEL = 0.55;
/** Breathing pacer during relax (body.breath): 4 s in, 6 s out (MO-4, D1). */
export const BREATH_IN_S = 4;
export const BREATH_OUT_S = 6;
export const BREATH_S = BREATH_IN_S + BREATH_OUT_S;
/** Height of a breath on the wave, so relax reads as nearly flat. */
export const RELAX_WAVE = 0.1;

type Shape = Pick<TimelinePhase, 'kind' | 'block' | 'durationS'>;

/** The level a squeeze settles at: the top of the curve the let-go eases down from. */
export function squeezeTop(block: BlockType): number {
  if (block === 'flick') return 1;
  if (block === 'endurance') return STEADY_LEVEL;
  return HOLD_LEVEL;
}

/** Breath 0 (out) to 1 (in) at `u` seconds into a relax phase: 4 s up, 6 s down. */
export function breath(u: number): number {
  const m = ((u % BREATH_S) + BREATH_S) % BREATH_S;
  return m < BREATH_IN_S ? ease(m / BREATH_IN_S) : 1 - ease((m - BREATH_IN_S) / BREATH_OUT_S);
}

/** Which half of the breath, for the Reduce motion text cue. */
export function breathStep(u: number): 'in' | 'out' {
  const m = ((u % BREATH_S) + BREATH_S) % BREATH_S;
  return m < BREATH_IN_S ? 'in' : 'out';
}

/**
 * Muscle level 0 (let go) to 1 (peak) at `u` seconds into a phase.
 * - Hold: spikes up in 0.2 s, settles to a flat hold by 0.6 s.
 * - Quick squeeze: rises in 0.25 s, then a short flat top.
 * - Steady hold: rises over 0.6 s to half strength, then flat.
 * - Let-go: eases down across the whole phase (2 s), from where the squeeze was.
 * - Relax: a small breath (4 s in, 6 s out). Rest and Get ready: flat.
 */
export function level(p: Shape, u: number): number {
  if (p.kind === 'squeeze') {
    if (p.block === 'flick') return ease(u / 0.25);
    if (p.block === 'endurance') return STEADY_LEVEL * ease(u / 0.6);
    if (u < 0.2) return ease(u / 0.2);
    return HOLD_LEVEL + (1 - HOLD_LEVEL) * (1 - ease((u - 0.2) / 0.4));
  }
  if (p.kind === 'release') return squeezeTop(p.block) * (1 - ease(u / (p.durationS > 0 ? p.durationS : RELEASE_S)));
  if (p.kind === 'relax') return RELAX_WAVE * breath(u);
  return 0;
}

/** A phase placed on the session clock (seconds of active time). */
export interface Placed {
  phase: TimelinePhase;
  startS: number;
}

/** The runner's schedule (start in ms) as seconds. */
export function placeAll(schedule: readonly { phase: TimelinePhase; startMs: number }[]): Placed[] {
  return schedule.map((s) => ({ phase: s.phase, startS: s.startMs / 1000 }));
}

/** Index of the phase running at `t`, or -1 before the start. `hint` speeds up a forward walk. */
export function indexAt(list: readonly Placed[], t: number, hint = 0): number {
  if (!list.length || t < list[0].startS) return -1;
  let i = Math.max(0, Math.min(hint, list.length - 1));
  if (list[i].startS > t) i = 0;
  while (i + 1 < list.length && list[i + 1].startS <= t) i++;
  return i;
}

/** Muscle level on the session clock (for the wave). 0 outside the session. */
export function levelAt(list: readonly Placed[], t: number, hint = 0): number {
  const i = indexAt(list, t, hint);
  if (i < 0) return 0;
  const { phase, startS } = list[i];
  const u = t - startS;
  if (u > phase.durationS) return 0;
  return level(phase, u);
}

/** One block of the session on the thin outer ring or the session bar. Get ready belongs to the block it introduces. */
export interface BlockSpan {
  blockIndex: number;
  block: BlockType;
  startS: number;
  endS: number;
}

export function blockSpans(list: readonly Placed[]): BlockSpan[] {
  const out: BlockSpan[] = [];
  for (const { phase, startS } of list) {
    const endS = startS + phase.durationS;
    const last = out[out.length - 1];
    if (last && last.blockIndex === phase.blockIndex) last.endS = endS;
    else out.push({ blockIndex: phase.blockIndex, block: phase.block, startS, endS });
  }
  return out.filter((b) => b.endS > b.startS);
}

/** What comes next, shown during Rest and Get ready (MO-7, HE-14). */
export type NextUp = { kind: 'rep'; block: BlockType; rep: number; reps: number } | { kind: 'block'; block: BlockType } | null;

export function nextUp(list: readonly Placed[], index: number): NextUp {
  const cur = list[index]?.phase;
  if (!cur || (cur.kind !== 'rest' && cur.kind !== 'transition')) return null;
  for (let i = index + 1; i < list.length; i++) {
    const p = list[i].phase;
    if (p.blockIndex !== cur.blockIndex) return { kind: 'block', block: p.block };
    if (p.kind === 'squeeze') return { kind: 'rep', block: p.block, rep: p.rep, reps: p.reps };
  }
  return null;
}

/** The thick ring of the timer for one step: how much is filled and in which tone (MO-1, MO-2). */
export interface RingStep {
  /** 0 to 1, clockwise from the top. */
  fill: number;
  /** 'squeeze' blue, or 'rest' grey. `mix` 0 to 1 fades blue to grey during the let-go. */
  tone: 'squeeze' | 'rest';
  mix: number;
}

export function ringStep(kind: PhaseKind, u: number, durationS: number): RingStep {
  const x = durationS > 0 ? Math.max(0, Math.min(1, u / durationS)) : 1;
  if (kind === 'squeeze') return { fill: x, tone: 'squeeze', mix: 0 };
  if (kind === 'release') return { fill: 1 - ease(x), tone: 'squeeze', mix: ease(x) };
  return { fill: x, tone: 'rest', mix: 1 };
}

/** Wave time window (seconds of the session clock): scrolling, or the whole current block when motion is reduced. */
export function waveWindow(t: number, spanS: number, nowFrac: number, reduced: boolean, spans: readonly BlockSpan[]): [number, number] {
  if (reduced && spans.length) {
    const b = spans.find((s) => t >= s.startS && t < s.endS) ?? spans[spans.length - 1];
    return [b.startS - 1, b.endS + 1];
  }
  const ws = t - spanS * nowFrac;
  return [ws, ws + spanS];
}
