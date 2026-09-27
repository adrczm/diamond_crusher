// Session templates, timelines, durations and day plans (spec 03, PRG-010).
import type { Position, SessionPosition } from '../types';

export type BlockType = 'relax' | 'hold' | 'flick' | 'endurance';

export interface Load {
  holdS: number; // H
  holdReps: number; // N
  flickReps: number; // F
  enduranceEnabled: boolean;
  enduranceHoldS: number; // E
  tier: number; // 0-3
}

export const DEFAULT_LOAD: Load = {
  holdS: 3,
  holdReps: 8,
  flickReps: 10,
  enduranceEnabled: false,
  enduranceHoldS: 5,
  tier: 0,
};

export const RELAX_IN_S = 30;
export const RELAX_OUT_S = 30;
export const TRANSITION_S = 5;
export const RELEASE_S = 2;
export const FLICK_ON_S = 1;
export const FLICK_OFF_S = 2;
export const ENDURANCE_REPS = 10;
export const ENDURANCE_REST_S = 5;

/** ENG-003: rest after a strong hold, including the 2 s let-go. */
export function restFor(holdS: number): number {
  return Math.max(holdS, 5);
}

export type PhaseKind = 'relax' | 'transition' | 'squeeze' | 'release' | 'rest';

/** Relax-only template step keys (ENG-060). */
export type RelaxStep = 'settle' | 'letgo_breath' | 'body_release' | 'quiet' | 'relax_in' | 'relax_out';

export interface TimelinePhase {
  kind: PhaseKind;
  blockIndex: number;
  block: BlockType;
  /** 1-based rep within the block, 0 for relax/transition. */
  rep: number;
  reps: number;
  durationS: number;
  relaxStep?: RelaxStep;
}

export interface PlannedBlock {
  type: BlockType;
  reps: number;
  onS: number;
  releaseS: number;
  restS: number; // rest after the let-go
  relaxStep?: RelaxStep;
  /** relax blocks only */
  durationS?: number;
}

export type TemplateKey = 'strength' | 'relax_only';
export const TEMPLATE_VERSION = 1;

export interface SessionPlan {
  templateKey: TemplateKey;
  templateVersion: number;
  position: SessionPosition;
  blocks: PlannedBlock[];
  load: { H: number; R: number; N: number; F: number; E: number | null; enduranceReps: number };
}

/** ENG-010: relax-in → holds × N → flicks × F → [endurance × 10] → relax-out. */
export function strengthPlan(load: Load, includeEndurance: boolean, position: SessionPosition): SessionPlan {
  const R = restFor(load.holdS);
  const blocks: PlannedBlock[] = [
    { type: 'relax', reps: 0, onS: 0, releaseS: 0, restS: 0, durationS: RELAX_IN_S, relaxStep: 'relax_in' },
    { type: 'hold', reps: load.holdReps, onS: load.holdS, releaseS: RELEASE_S, restS: R - RELEASE_S },
    { type: 'flick', reps: load.flickReps, onS: FLICK_ON_S, releaseS: FLICK_OFF_S, restS: 0 },
  ];
  const withEndurance = includeEndurance && load.enduranceEnabled;
  if (withEndurance) {
    blocks.push({
      type: 'endurance',
      reps: ENDURANCE_REPS,
      onS: load.enduranceHoldS,
      releaseS: RELEASE_S,
      restS: ENDURANCE_REST_S - RELEASE_S,
    });
  }
  blocks.push({ type: 'relax', reps: 0, onS: 0, releaseS: 0, restS: 0, durationS: RELAX_OUT_S, relaxStep: 'relax_out' });
  return {
    templateKey: 'strength',
    templateVersion: TEMPLATE_VERSION,
    position,
    blocks,
    load: {
      H: load.holdS,
      R,
      N: load.holdReps,
      F: load.flickReps,
      E: withEndurance ? load.enduranceHoldS : null,
      enduranceReps: withEndurance ? ENDURANCE_REPS : 0,
    },
  };
}

/** ENG-060: about 4 minutes, relax blocks only. */
export function relaxPlan(position: SessionPosition = 'lying'): SessionPlan {
  const relax = (durationS: number, relaxStep: RelaxStep, reps = 0): PlannedBlock => ({
    type: 'relax',
    reps,
    onS: 0,
    releaseS: 0,
    restS: 0,
    durationS,
    relaxStep,
  });
  return {
    templateKey: 'relax_only',
    templateVersion: TEMPLATE_VERSION,
    position,
    blocks: [relax(60, 'settle'), relax(60, 'letgo_breath', 6), relax(60, 'body_release'), relax(60, 'quiet')],
    load: { H: 0, R: 0, N: 0, F: 0, E: null, enduranceReps: 0 },
  };
}

/** Expand a plan into timed phases. Transitions sit between contraction blocks (ENG-014 reference timings). */
export function timeline(plan: SessionPlan): TimelinePhase[] {
  const out: TimelinePhase[] = [];
  plan.blocks.forEach((b, blockIndex) => {
    if (blockIndex > 0 && plan.templateKey === 'strength') {
      out.push({ kind: 'transition', blockIndex, block: b.type, rep: 0, reps: b.reps, durationS: TRANSITION_S });
    }
    if (b.type === 'relax') {
      if (b.relaxStep === 'letgo_breath' && b.reps > 0) {
        const each = (b.durationS ?? 0) / b.reps;
        for (let rep = 1; rep <= b.reps; rep++) {
          out.push({ kind: 'relax', blockIndex, block: 'relax', rep, reps: b.reps, durationS: each, relaxStep: b.relaxStep });
        }
      } else {
        out.push({ kind: 'relax', blockIndex, block: 'relax', rep: 0, reps: 0, durationS: b.durationS ?? 0, relaxStep: b.relaxStep });
      }
      return;
    }
    for (let rep = 1; rep <= b.reps; rep++) {
      out.push({ kind: 'squeeze', blockIndex, block: b.type, rep, reps: b.reps, durationS: b.onS });
      out.push({ kind: 'release', blockIndex, block: b.type, rep, reps: b.reps, durationS: b.releaseS });
      if (b.restS > 0) out.push({ kind: 'rest', blockIndex, block: b.type, rep, reps: b.reps, durationS: b.restS });
    }
  });
  return out;
}

/** ENG-014: estimated duration in seconds. */
export function durationS(plan: SessionPlan): number {
  return timeline(plan).reduce((s, p) => s + p.durationS, 0);
}

/** Strong holds in a plan, for the 30-per-day cap (PRG-040, PRG-041). */
export function strongHolds(plan: SessionPlan): number {
  return plan.blocks.filter((b) => b.type === 'hold').reduce((s, b) => s + b.reps, 0);
}

export const DAILY_STRONG_HOLD_CAP = 30;

/** PRG-010: session positions for each slot of the day. */
export function slotPositions(tier: number, sessionsPerDay: number): Position[] {
  const three: Position[][] = [
    ['lying', 'lying', 'lying'],
    ['lying', 'sitting', 'sitting'],
    ['lying', 'sitting', 'standing'],
    ['sitting', 'standing', 'standing'],
  ];
  const two: Position[][] = [
    ['lying', 'lying'],
    ['lying', 'sitting'],
    ['sitting', 'standing'],
    ['standing', 'standing'],
  ];
  const t = Math.max(0, Math.min(3, tier));
  return sessionsPerDay >= 3 ? three[t] : two[t];
}

export function unlockedPositions(tier: number): Position[] {
  if (tier <= 0) return ['lying'];
  if (tier === 1) return ['lying', 'sitting'];
  return ['lying', 'sitting', 'standing'];
}

export interface DaySlot {
  slotNo: number;
  position: Position;
  endurance: boolean;
}

/** ENG-030, ENG-031: build = N sessions a day; maintenance = 1 session a day. Endurance in the day's last session. */
export function dayPlan(load: Load, sessionsPerDay: number, maintenance: boolean): DaySlot[] {
  if (maintenance) {
    const position: Position = load.tier >= 2 ? 'standing' : load.tier === 1 ? 'sitting' : 'lying';
    return [{ slotNo: 1, position, endurance: load.enduranceEnabled }];
  }
  const positions = slotPositions(load.tier, sessionsPerDay);
  return positions.map((position, i) => ({
    slotNo: i + 1,
    position,
    endurance: load.enduranceEnabled && i === positions.length - 1,
  }));
}
