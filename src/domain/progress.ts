// Pure computations behind the Progress tab (06c PFB-002, PFB-010 to PFB-018, PFB-024, PFB-033, PFB-034; 06a LOG-025;
// 08 MOT-032). No storage and no copy here: screens turn these results into words.
import { addDays, diffDays, type LocalDate } from './dates';
import { isValid, trend, type CheckForTrend, type Measure } from './selfcheck';

export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Range tabs on each card (round 2 P1, P4). 'all' = since the first training week (PFB-018 default). */
export type Range = '12w' | '12m' | 'all';

/** Week starts from `first` to `thisWeek` (both week starts), oldest first. */
export function weekStartsFrom(first: LocalDate, thisWeek: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let w = first; w <= thisWeek; w = addDays(w, 7)) out.push(w);
  return out.length ? out : [thisWeek];
}

/** The last `n` week starts up to and including `thisWeek`, oldest first. */
export function lastWeekStarts(thisWeek: LocalDate, n: number): LocalDate[] {
  return Array.from({ length: n }, (_, i) => addDays(thisWeek, -7 * (n - 1 - i)));
}

export interface WeekCount {
  start: LocalDate;
  /** Days trained; null for a week before training started (a gap, never a zero: PFB-002). */
  days: number | null;
  /** This week, still in progress. */
  current: boolean;
  onTarget: boolean;
}

/** PFB-010: days trained per week against the weekly target. Extra sessions do not count (a day is a day). */
export function weekCounts(
  trained: ReadonlySet<LocalDate>,
  starts: readonly LocalDate[],
  thisWeek: LocalDate,
  target: number,
  firstWeek: LocalDate | null
): WeekCount[] {
  return starts.map((start) => {
    const before = !firstWeek || start < firstWeek;
    let n = 0;
    for (let i = 0; i < 7; i++) if (trained.has(addDays(start, i))) n++;
    const days = before && n === 0 ? null : n;
    return { start, days, current: start === thisWeek, onTarget: days != null && days >= target };
  });
}

/**
 * "Weeks on target: 9 of the last 12" (no streak wording: MOT-005, MOT-020). Only full weeks count; this week is still in
 * progress. `of` is smaller than `last` while fewer full weeks exist since training started.
 */
export function weeksOnTarget(counts: readonly WeekCount[], last = 12): { on: number; of: number } {
  const full = counts.filter((w) => !w.current && w.days != null).slice(-last);
  return { on: full.filter((w) => w.onTarget).length, of: full.length };
}

export interface MonthAverage {
  /** 'YYYY-MM' */
  month: string;
  /** First day counted (the 1st, or the first training week start in the first month). */
  from: LocalDate;
  /** Average days trained a week in the month, 1 decimal; null before training started. */
  avg: number | null;
  current: boolean;
  onTarget: boolean;
}

function monthKey(d: LocalDate): string {
  return d.slice(0, 7);
}

function monthStart(key: string): LocalDate {
  return `${key}-01`;
}

function nextMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * 12 months on a narrow screen: one bar per month, the average days trained a week (round 2 Progress §1). The current month
 * counts only the days so far. Months before `start` are gaps.
 */
export function monthlyAverages(trained: ReadonlySet<LocalDate>, start: LocalDate | null, today: LocalDate, target: number, months = 12): MonthAverage[] {
  let key = monthKey(today);
  const keys: string[] = [key];
  for (let i = 1; i < months; i++) {
    const [y, m] = key.split('-').map(Number);
    key = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    keys.unshift(key);
  }
  return keys.map((k) => {
    const first = monthStart(k);
    const last = addDays(monthStart(nextMonth(k)), -1);
    const from = start && start > first ? start : first;
    const to = today < last ? today : last;
    const current = k === monthKey(today);
    if (!start || from > to) return { month: k, from: first, avg: null, current, onTarget: false };
    let n = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) if (trained.has(d)) n++;
    const span = diffDays(from, to) + 1;
    const avg = Math.min(7, Math.round(((n * 7) / span) * 10) / 10);
    return { month: k, from, avg, current, onTarget: avg >= target };
  });
}

export interface Dated {
  date: LocalDate;
  value: number;
}

/** Median of the values in the `days`-day window ending on `at` (inclusive), or null below `min` entries (PFB-014, PFB-016). */
export function rollingMedian(entries: readonly Dated[], at: LocalDate, min: number, days = 28): { value: number | null; count: number } {
  const from = addDays(at, -(days - 1));
  const xs = entries.filter((e) => e.date >= from && e.date <= at).map((e) => e.value);
  return { value: xs.length >= min ? median(xs) : null, count: xs.length };
}

/** A 4-week rolling median at each point date (LOG-025: never per day). */
export function rollingSeries(entries: readonly Dated[], at: readonly LocalDate[], min: number, days = 28): { date: LocalDate; value: number | null; count: number }[] {
  return at.map((date) => ({ date, ...rollingMedian(entries, date, min, days) }));
}

export type Direction = 'higher' | 'lower' | 'same';

export interface Comparison {
  current: number | null;
  previous: number | null;
  countCurrent: number;
  countPrevious: number;
  /** Null until both windows have enough entries. */
  direction: Direction | null;
}

/**
 * PFB-024: the last 4 weeks against the 8 weeks before. "About the same" = a difference under `sameBelow` (1 point on 0 to 4
 * and 5-point items, 2 points on 0 to 10 items).
 */
export function compareWithPrevious(entries: readonly Dated[], today: LocalDate, min: number, sameBelow: number): Comparison {
  const cur = rollingMedian(entries, today, min, 28);
  const prev = rollingMedian(entries, addDays(today, -28), min, 56);
  let direction: Direction | null = null;
  if (cur.value != null && prev.value != null) {
    const d = cur.value - prev.value;
    direction = Math.abs(d) < sameBelow ? 'same' : d > 0 ? 'higher' : 'lower';
  }
  return { current: cur.value, previous: prev.value, countCurrent: cur.count, countPrevious: prev.count, direction };
}

/** PFB-024 threshold by scale: 0 to 10 items need 2 points, shorter scales 1. */
export function sameBelowFor(scaleMax: number): number {
  return scaleMax >= 10 ? 2 : 1;
}

export interface Segments {
  /** Indexes joined by one line each. A run of one is a lone point. */
  runs: number[][];
  /** Pairs [a, b] where the line stops because checks are missing between a and b (dashed "no check" connector, AC-PFB-6). */
  gaps: [number, number][];
}

/**
 * PFB-002, AC-PFB-6, PFB-011: a line never joins across missing values, and "strong holds in a row" only joins checks whose
 * hold length differs by at most `tolerance` seconds.
 */
export function lineSegments(values: readonly (number | null)[], holds?: readonly (number | null)[], tolerance = 1): Segments {
  const runs: number[][] = [];
  const gaps: [number, number][] = [];
  let run: number[] = [];
  let lastIdx = -1;
  let sawNull = false;
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null) {
      if (run.length) sawNull = true;
      continue;
    }
    const prev = run[run.length - 1];
    const holdBreak = holds && prev != null && Math.abs((holds[i] ?? 0) - (holds[prev] ?? 0)) > tolerance;
    if (run.length && (sawNull || holdBreak)) {
      runs.push(run);
      if (sawNull) gaps.push([lastIdx, i]);
      run = [];
    }
    run.push(i);
    lastIdx = i;
    sawNull = false;
  }
  if (run.length) runs.push(run);
  return { runs, gaps };
}

/** The personal best among valid (not hollow) points: the first time the highest value was reached. -1 when none. */
export function bestIndex(values: readonly (number | null)[], hollow?: readonly boolean[]): number {
  let best = -1;
  values.forEach((v, i) => {
    if (v == null || hollow?.[i]) return;
    if (best < 0 || v > (values[best] as number)) best = i;
  });
  return best;
}

/**
 * AC-PFB-6: a missed monthly check leaves a visible gap. Inserts a null point at each missed or skipped due date between
 * checks, and one between two checks more than `maxDays` apart when no missed date explains it.
 */
export function withGaps<T extends { date: LocalDate }>(points: readonly T[], missed: readonly LocalDate[], maxDays = 42): (T | { date: LocalDate; gap: true })[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!sorted.length) return [];
  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;
  const gaps: { date: LocalDate; gap: true }[] = missed.filter((d) => d > first && d < last).map((date) => ({ date, gap: true as const }));
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1].date;
    const b = sorted[i].date;
    if (diffDays(a, b) > maxDays && !gaps.some((g) => g.date > a && g.date < b)) gaps.push({ date: addDays(a, Math.round(diffDays(a, b) / 2)), gap: true });
  }
  return [...sorted, ...gaps].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface LeakBlock {
  from: LocalDate;
  to: LocalDate;
  /** Null for a block before the app was in use (a gap, not a zero). */
  total: number | null;
  bySituation: Record<string, number>;
}

/** PFB-015: logged leaks per 4-week block, ending today, oldest first, counted by situation. */
export function leakBlocks(leaks: readonly { date: LocalDate; situation: string | null }[], today: LocalDate, blocks: number, since: LocalDate | null): LeakBlock[] {
  return Array.from({ length: blocks }, (_, k) => {
    const to = addDays(today, -28 * (blocks - 1 - k));
    const from = addDays(to, -27);
    const inBlock = leaks.filter((l) => l.date >= from && l.date <= to);
    const bySituation: Record<string, number> = {};
    for (const l of inBlock) {
      const s = l.situation ?? 'other';
      bySituation[s] = (bySituation[s] ?? 0) + 1;
    }
    const before = !since || to < since;
    return { from, to, total: before && !inBlock.length ? null : inBlock.length, bySituation };
  });
}

/** The end date of the first full week at the weekly target (MOT-032 "first full week at target"), or null. */
export function firstTargetWeek(counts: readonly WeekCount[]): LocalDate | null {
  const w = counts.find((c) => !c.current && c.onTarget);
  return w ? addDays(w.start, 6) : null;
}

/** SC-031: the measures in which check `id` set a new personal best against earlier valid checks of the same position. */
export function newBestsAt(checks: readonly CheckForTrend[], id: string): { measure: Measure; value: number }[] {
  const i = checks.findIndex((c) => c.id === id);
  if (i < 0 || !isValid(checks[i])) return [];
  const c = checks[i];
  const before = checks.slice(0, i).filter((x) => x.position === c.position && isValid(x));
  const out: { measure: Measure; value: number }[] = [];
  const pick = (x: CheckForTrend, m: Measure) => (m === 'longest_hold' ? x.longestHoldS : m === 'repeated_holds' ? x.repeatedHolds : x.quickFlicks);
  for (const m of ['longest_hold', 'repeated_holds', 'quick_flicks'] as Measure[]) {
    const v = pick(c, m);
    if (v == null) continue;
    const prev = before.map((x) => pick(x, m)).filter((x): x is number => x != null);
    if (!prev.length || v > Math.max(...prev)) out.push({ measure: m, value: v });
  }
  return before.length ? out : [];
}

export type PlateauMessage = 'PFB-033' | 'PFB-034' | null;

/**
 * PFB-033 / PFB-034: from week 12, every self-check measure steady, and the weekly target met in at least 9 of the last 12
 * weeks (033) or in fewer than 6 (034). Between 6 and 8 weeks: no plateau message.
 */
export function plateauMessage(lying: readonly CheckForTrend[], trainingWeeks: number, onTarget: { on: number; of: number }): PlateauMessage {
  if (trainingWeeks < 12 || onTarget.of < 12) return null;
  const steady = (['longest_hold', 'repeated_holds', 'quick_flicks'] as Measure[]).every((m) => trend(lying, m).trend === 'steady');
  if (!steady) return null;
  if (onTarget.on >= 9) return 'PFB-033';
  if (onTarget.on < 6) return 'PFB-034';
  return null;
}

export interface ScorePoint {
  date: LocalDate;
  score: number;
}

/**
 * PFB-013: the meaningful-change band, only for modules with an evidence-based fixed MCID and a baseline at or above the
 * module's minimum (ICIQ-UI SF: ±2 around a baseline of 6 or more). Null otherwise.
 */
export function mcidBand(mcid: { type: 'fixed' | 'baselineBands'; values: number[] } | undefined, baseline: number | null): { low: number; high: number } | null {
  if (!mcid || mcid.type !== 'fixed' || baseline == null) return null;
  const [threshold, minBaseline = 0] = mcid.values;
  if (baseline < minBaseline) return null;
  return { low: baseline - threshold, high: baseline + threshold };
}

export type SymptomStatus = 'none' | 'no_change' | 'changed';

/** PFB-017 tile 1: "No change" / "Something changed" from the PFB-040 to PFB-042 signals, with the last check-up date. */
export function symptomStatus(
  responses: readonly { date: LocalDate; complete: boolean }[],
  flags: readonly { key: string; date: LocalDate; open: boolean }[],
  today: LocalDate
): { status: SymptomStatus; last: LocalDate | null } {
  const done = responses.filter((r) => r.complete).map((r) => r.date).sort();
  const last = done.length ? done[done.length - 1] : null;
  const SIGNALS = ['symptom_worsening', 'new_leaks', 'erection_change', 'see_someone_12w'];
  const changed = flags.some((f) => SIGNALS.includes(f.key) && (f.open || diffDays(f.date, today) <= 28));
  if (changed) return { status: 'changed', last };
  return { status: last ? 'no_change' : 'none', last };
}

/** The x position of a date on a time axis from `from` to `to`, as a 0 to 1 fraction. */
export function timeFraction(date: LocalDate, from: LocalDate, to: LocalDate): number {
  const span = diffDays(from, to);
  if (span <= 0) return 0.5;
  return Math.max(0, Math.min(1, diffDays(from, date) / span));
}

/** The first words of a note, for chart markers and table cells. */
export function firstWords(note: string, words = 4): string {
  const parts = note.trim().split(/\s+/);
  return parts.length <= words ? parts.join(' ') : `${parts.slice(0, words).join(' ')}…`;
}
