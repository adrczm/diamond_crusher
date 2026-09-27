// Load, weekly progression, caps, gaps and levels (spec 04). All numbers are Design choice on cited findings.
import { addDays, diffDays, type LocalDate } from './dates';
import type { AgeBand, Phase, SafetyMode } from './types';
import { isRestricted } from './safety';

export const LIMITS = {
  holdMin: 3,
  holdMax: 10,
  repsMin: 3,
  repsMax: 10,
  repsStartMax: 8,
  enduranceMin: 5,
  enduranceMax: 10,
  tierMax: 3,
  flicks: 10,
  defaultCeiling: 5,
} as const;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type Category = 'strength' | 'endurance' | 'position';
export type StrengthVar = 'hold_s' | 'hold_reps';
export type ChangeVariable = 'hold_s' | 'hold_reps' | 'flick_reps' | 'endurance' | 'endurance_hold_s' | 'position' | 'phase' | 'none';
export type ChangeReason =
  | 'initial'
  | 'progression'
  | 'monthly_check'
  | 'ceiling'
  | 'confirmed_drop'
  | 'hold'
  | 'step_back'
  | 'position_unlock'
  | 'to_maintenance'
  | 'keep_building'
  | 'return_to_build'
  | 'restart_after_gap'
  | 'post_surgery'
  | 'pain_pause'
  | 'manual'
  | 'import';

export interface Prescription {
  holdS: number;
  holdReps: number;
  flickReps: number;
  enduranceEnabled: boolean;
  enduranceHoldS: number;
  tier: number;
  holdCeiling: number;
  /** Index into ROTATION of the category used last; -1 = none yet. */
  rotationIndex: number;
  lastCategory: Category | null;
  lastStrengthVariable: StrengthVar | null;
  tier2QualifyingWeeks: number;
}

export const INITIAL_PRESCRIPTION: Prescription = {
  holdS: 3,
  holdReps: 8,
  flickReps: 10,
  enduranceEnabled: false,
  enduranceHoldS: 5,
  tier: 0,
  holdCeiling: LIMITS.defaultCeiling,
  rotationIndex: -1,
  lastCategory: null,
  lastStrengthVariable: null,
  tier2QualifyingWeeks: 0,
};

export interface Change {
  variable: ChangeVariable;
  before: number | boolean | string;
  after: number | boolean | string;
}

export interface SelfCheckLoadInput {
  longestHoldS: number | null;
  repeatedHolds: number | null;
}

/** PRG-002: starting load from a baseline self-check. */
export function startingLoad(sc: SelfCheckLoadInput | null): Pick<Prescription, 'holdS' | 'holdReps' | 'enduranceHoldS' | 'enduranceEnabled' | 'tier' | 'flickReps'> {
  const holdS = sc?.longestHoldS != null ? clamp(Math.floor(sc.longestHoldS), LIMITS.holdMin, LIMITS.holdMax) : 3;
  const holdReps = sc?.repeatedHolds != null ? clamp(sc.repeatedHolds, LIMITS.repsMin, LIMITS.repsStartMax) : 8;
  return { holdS, holdReps, enduranceHoldS: 5, enduranceEnabled: false, tier: 0, flickReps: LIMITS.flicks };
}

/**
 * PRG-013: ceiling = min(10, floor(max of the last two valid lying checks) + 2); 5 with none.
 * `validLyingLongest` is in check order (oldest first).
 */
export function holdCeiling(validLyingLongest: readonly number[]): number {
  if (validLyingLongest.length === 0) return LIMITS.defaultCeiling;
  const lastTwo = validLyingLongest.slice(-2);
  return clamp(Math.floor(Math.max(...lastTwo)) + 2, LIMITS.holdMin, LIMITS.holdMax);
}

/** Apply a new ceiling; lowers H at once if it's above (PRG-013). Never raises H (PRG-014). */
export function applyCeiling(p: Prescription, ceiling: number): { next: Prescription; change: Change | null } {
  const next = { ...p, holdCeiling: ceiling };
  if (p.holdS > ceiling) {
    next.holdS = Math.max(LIMITS.holdMin, ceiling);
    return { next, change: { variable: 'hold_s', before: p.holdS, after: next.holdS } };
  }
  return { next, change: null };
}

export const ROTATION: Category[] = ['strength', 'endurance', 'strength', 'position'];

function strengthChange(p: Prescription): { next: Prescription; change: Change } | null {
  if (p.holdReps < LIMITS.repsStartMax) {
    return {
      next: { ...p, holdReps: p.holdReps + 1, lastStrengthVariable: 'hold_reps' },
      change: { variable: 'hold_reps', before: p.holdReps, after: p.holdReps + 1 },
    };
  }
  const holdOk = p.holdS + 1 <= p.holdCeiling && p.holdS < LIMITS.holdMax;
  const repsOk = p.holdReps < LIMITS.repsMax;
  const prefer: StrengthVar = p.lastStrengthVariable === 'hold_s' ? 'hold_reps' : 'hold_s';
  const pick: StrengthVar | null =
    prefer === 'hold_s' ? (holdOk ? 'hold_s' : repsOk ? 'hold_reps' : null) : repsOk ? 'hold_reps' : holdOk ? 'hold_s' : null;
  if (pick === 'hold_s') {
    return { next: { ...p, holdS: p.holdS + 1, lastStrengthVariable: 'hold_s' }, change: { variable: 'hold_s', before: p.holdS, after: p.holdS + 1 } };
  }
  if (pick === 'hold_reps') {
    return {
      next: { ...p, holdReps: p.holdReps + 1, lastStrengthVariable: 'hold_reps' },
      change: { variable: 'hold_reps', before: p.holdReps, after: p.holdReps + 1 },
    };
  }
  return null;
}

function categoryChange(p: Prescription, cat: Category): { next: Prescription; change: Change } | null {
  if (cat === 'strength') return strengthChange(p);
  if (cat === 'endurance') {
    if (!p.enduranceEnabled || p.enduranceHoldS >= LIMITS.enduranceMax) return null;
    return {
      next: { ...p, enduranceHoldS: p.enduranceHoldS + 1 },
      change: { variable: 'endurance_hold_s', before: p.enduranceHoldS, after: p.enduranceHoldS + 1 },
    };
  }
  if (p.tier === 2 && p.tier2QualifyingWeeks >= 2) {
    return { next: { ...p, tier: 3 }, change: { variable: 'position', before: 2, after: 3 } };
  }
  return null;
}

/**
 * PRG-006: the one change after a qualifying week. `weekEnded` is the programme week that just ended.
 * Returns null when nothing is eligible ("You're at the top of the programme").
 */
export function chooseChange(p: Prescription, weekEnded: number): { next: Prescription; change: Change } | null {
  if (p.tier === 0) return { next: { ...p, tier: 1 }, change: { variable: 'position', before: 0, after: 1 } };
  if (p.tier === 1) return { next: { ...p, tier: 2 }, change: { variable: 'position', before: 1, after: 2 } };
  if (!p.enduranceEnabled && weekEnded >= 3) {
    return { next: { ...p, enduranceEnabled: true }, change: { variable: 'endurance', before: false, after: true } };
  }
  for (let i = 1; i <= ROTATION.length; i++) {
    const idx = (p.rotationIndex + i + ROTATION.length) % ROTATION.length;
    const cat = ROTATION[idx];
    const res = categoryChange(p, cat);
    if (res) return { next: { ...res.next, rotationIndex: idx, lastCategory: cat }, change: res.change };
  }
  return null;
}

export interface DaySessions {
  date: LocalDate;
  /** Counted sessions (not extra) that ended `complete`. */
  completeSessions: number;
}

export interface WeekEvidence {
  days: DaySessions[]; // the week's 7 active days
  painReported: boolean;
  couldNotRelease: boolean;
  regressionHold: boolean;
}

export interface Qualification {
  qualifies: boolean;
  /** PFB-054: failed only on the session count. */
  failedOnlyOnSessions: boolean;
}

/** PRG-004. */
export function weekQualifies(w: WeekEvidence, minSessionsPerDay = 2): Qualification {
  const sessionsOk = w.days.filter((d) => d.completeSessions >= minSessionsPerDay).length >= 5;
  const othersOk = !w.painReported && !w.couldNotRelease && !w.regressionHold;
  return { qualifies: sessionsOk && othersOk, failedOnlyOnSessions: !sessionsOk && othersOk };
}

/** Records a qualifying week at tier 2, before the change is chosen (PRG-006 position rule). */
export function countTier2Week(p: Prescription): Prescription {
  return p.tier === 2 ? { ...p, tier2QualifyingWeeks: p.tier2QualifyingWeeks + 1 } : p;
}

/**
 * PRG-003: active days exclude restricted-mode days and days of gaps longer than 7 days without a
 * strengthening session. Gap days count only once a session closes the gap, so the week never runs backwards.
 */
export function activeDates(
  buildStart: LocalDate,
  today: LocalDate,
  strengthDates: ReadonlySet<LocalDate>,
  modeOn: (d: LocalDate) => SafetyMode
): LocalDate[] {
  const out: LocalDate[] = [];
  let gap: LocalDate[] = [];
  for (let d = buildStart; d <= today; d = addDays(d, 1)) {
    if (strengthDates.has(d)) {
      if (gap.length <= 7) out.push(...gap.filter((g) => !isRestricted(modeOn(g))));
      gap = [];
      if (!isRestricted(modeOn(d))) out.push(d);
    } else {
      gap.push(d);
    }
  }
  return out;
}

/** PRG-003: programme week = floor(activeDays / 7) + 1. */
export function programmeWeek(activeDays: number): number {
  return Math.floor(activeDays / 7) + 1;
}

export type GapBand = 'none' | 'short' | 'medium' | 'long';

/** Days without a strengthening session before `today`. */
export function gapDays(lastSessionDate: LocalDate | null, today: LocalDate): number {
  if (!lastSessionDate) return 0;
  return Math.max(0, diffDays(lastSessionDate, today) - 1);
}

export function gapBand(days: number): GapBand {
  if (days <= 7) return 'none';
  if (days <= 14) return 'short';
  if (days <= 28) return 'medium';
  return 'long';
}

export interface GapResult {
  next: Prescription;
  changes: Change[];
  holdNextCheck: boolean;
  needsSelfCheck: boolean;
  needsShortScreen: boolean;
  needsTechniqueRecheck: boolean;
  returnToBuild: boolean;
}

/** PRG-032. For gaps over 28 days, the load is re-set after the new self-check (PRG-002); here only the tier drops. */
export function applyGap(p: Prescription, days: number, maintenance: boolean, pickUpWhereIWas: boolean): GapResult {
  const band = gapBand(days);
  const res: GapResult = {
    next: { ...p },
    changes: [],
    holdNextCheck: band !== 'none' && band !== 'long',
    needsSelfCheck: band === 'long',
    needsShortScreen: band === 'long',
    needsTechniqueRecheck: band === 'long',
    returnToBuild: band === 'long' && maintenance,
  };
  if (band === 'none') return res;
  if (pickUpWhereIWas) {
    res.needsSelfCheck = false;
    res.needsTechniqueRecheck = false;
    res.returnToBuild = false;
    res.holdNextCheck = false;
    return res;
  }
  const set = (variable: ChangeVariable, key: 'holdS' | 'holdReps' | 'tier', value: number) => {
    if (res.next[key] !== value) {
      res.changes.push({ variable, before: res.next[key], after: value });
      res.next = { ...res.next, [key]: value };
    }
  };
  if (band === 'short') set('hold_s', 'holdS', Math.max(LIMITS.holdMin, p.holdS - 1));
  if (band === 'medium') {
    set('hold_s', 'holdS', Math.max(LIMITS.holdMin, p.holdS - 2));
    set('hold_reps', 'holdReps', Math.max(LIMITS.repsMin, p.holdReps - 2));
    set('position', 'tier', Math.max(0, p.tier - 1));
  }
  if (band === 'long') set('position', 'tier', Math.max(0, p.tier - 1));
  if (res.next.tier < 2) res.next.tier2QualifyingWeeks = 0;
  return res;
}

export interface LevelChangeRecord {
  reason: ChangeReason;
  variable: ChangeVariable;
  before: unknown;
  after: unknown;
}

function stepValue(c: LevelChangeRecord): number {
  if (c.reason === 'initial' || c.reason === 'import') return 0;
  if (c.variable === 'endurance') return c.after === true ? 1 : c.before === true && c.after === false ? -1 : 0;
  if (['hold_s', 'hold_reps', 'endurance_hold_s', 'position'].includes(c.variable)) {
    const b = Number(c.before);
    const a = Number(c.after);
    return Number.isFinite(a - b) ? a - b : 0;
  }
  return 0;
}

/** PRG-050: level = 1 + increases − increases undone (never below 1). */
export function level(changes: readonly LevelChangeRecord[]): number {
  let lvl = 1;
  for (const c of changes) {
    if (c.reason === 'post_surgery' && c.variable === 'phase') lvl = 1;
    lvl = Math.max(1, lvl + stepValue(c));
  }
  return lvl;
}

/** The last increase, for "Level 6: standing unlocked". */
export function lastIncrease(changes: readonly LevelChangeRecord[]): LevelChangeRecord | null {
  for (let i = changes.length - 1; i >= 0; i--) if (stepValue(changes[i]) > 0) return changes[i];
  return null;
}

/** MOT-031: the next thing the plan will unlock. */
export function nextMilestone(p: Prescription, week: number): 'sitting' | 'standing' | 'endurance' | 'more_standing' | 'longer_holds' | 'top' {
  if (p.tier === 0) return 'sitting';
  if (p.tier === 1) return 'standing';
  if (!p.enduranceEnabled) return week >= 3 ? 'endurance' : 'endurance';
  if (p.tier === 2) return 'more_standing';
  if (p.holdS < Math.min(p.holdCeiling, LIMITS.holdMax) || p.holdReps < LIMITS.repsMax || p.enduranceHoldS < LIMITS.enduranceMax) return 'longer_holds';
  return 'top';
}

/** PRG-021. */
export function maintenanceTarget(ageBand: AgeBand | null, setting: number | null): number {
  if (setting != null) return clamp(setting, 3, 7);
  return ageBand === '60_74' || ageBand === '75_plus' ? 5 : 4;
}

/** PRG-020: maintenance is offered once programme week 13 begins and the 12-week review is done or skipped. */
export function maintenanceDue(opts: {
  phase: Phase;
  activeDays: number;
  reviewDoneOrSkipped: boolean;
  keepBuildingUntilActiveDay: number | null;
}): boolean {
  if (opts.phase !== 'build') return false;
  if (programmeWeek(opts.activeDays) < 13) return false;
  if (!opts.reviewDoneOrSkipped) return false;
  if (opts.keepBuildingUntilActiveDay != null && opts.activeDays < opts.keepBuildingUntilActiveDay) return false;
  return true;
}

/** PRG-022: maintenance change after the monthly self-check. */
export function maintenanceQualifies(opts: { weeksTargetMet: boolean[]; painReported: boolean; daysSinceLastChange: number | null }): boolean {
  if (opts.painReported) return false;
  if (opts.daysSinceLastChange != null && opts.daysSinceLastChange < 28) return false;
  return opts.weeksTargetMet.slice(-4).filter(Boolean).length >= 3;
}

/** PRG-041 / MOT-010: whether another session today is within the plan, extra, or blocked by the cap. */
export function extraSessionAllowed(holdsDoneToday: number, nextSessionHolds: number): boolean {
  return holdsDoneToday + nextSessionHolds <= 30;
}

/** PRG-040: clamp any prescription into the hard caps (used on import and after every rule). */
export function enforceCaps(p: Prescription): Prescription {
  const holdCeiling = clamp(p.holdCeiling, LIMITS.holdMin, LIMITS.holdMax);
  return {
    ...p,
    holdCeiling,
    holdS: clamp(Math.min(p.holdS, Math.max(LIMITS.holdMin, holdCeiling)), LIMITS.holdMin, LIMITS.holdMax),
    holdReps: clamp(p.holdReps, LIMITS.repsMin, LIMITS.repsMax),
    flickReps: LIMITS.flicks,
    enduranceHoldS: clamp(p.enduranceHoldS, LIMITS.enduranceMin, LIMITS.enduranceMax),
    tier: clamp(p.tier, 0, LIMITS.tierMax),
  };
}
