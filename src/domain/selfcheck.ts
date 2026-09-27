// Monthly self-check rules (06a §2) and "what counts as a real change" (06c PFB-020).

export const LONGEST_HOLD_CAP_S = 30;
export const REPEATED_CAP = 10;
export const QUICK_CAP = 10;

/** SC-012: target hold in step 3 = min(step 2, 10 s); 2 s if step 2 was under 2 s. */
export function repeatedHoldLength(longestHoldS: number): number {
  if (longestHoldS < 2) return 2;
  return Math.min(Math.floor(longestHoldS), 10);
}

export type Tri = 'yes' | 'unsure' | 'no';

export interface TechniqueAnswers {
  signResult: Tri | 'not_done' | null;
  bulge: Tri | null;
  breathingOk: Tri | null;
  glutesBellyRelaxed: Tri | null;
  fullRelease: Tri | null;
}

/** SC-022. */
export function techniqueFlag(a: TechniqueAnswers): boolean {
  if (a.signResult === 'no' || a.bulge === 'yes') return true;
  const nos = [a.breathingOk, a.glutesBellyRelaxed, a.fullRelease].filter((x) => x === 'no').length;
  return nos >= 2;
}

export interface CheckForTrend {
  id: string;
  performedAt: string;
  position: 'lying' | 'standing';
  conditionsMet: boolean; // all SC-003 conditions met
  techniqueFlag: boolean;
  longestHoldS: number | null;
  repeatedHolds: number | null;
  repeatedHoldLenS: number | null;
  quickFlicks: number | null;
}

export type Measure = 'longest_hold' | 'repeated_holds' | 'quick_flicks';
export type Trend = 'improvement' | 'steady' | 'decline' | 'too_early';

export function isValid(c: CheckForTrend): boolean {
  return c.conditionsMet && !c.techniqueFlag;
}

function valueOf(c: CheckForTrend, m: Measure): number | null {
  if (m === 'longest_hold') return c.longestHoldS;
  if (m === 'repeated_holds') return c.repeatedHolds;
  return c.quickFlicks;
}

const STEP: Record<Measure, number> = { longest_hold: 2, repeated_holds: 1, quick_flicks: 1 };

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * PFB-020. `checks` in time order, one position. Repeated holds only compare checks with the same H (±1 s)
 * as the latest one.
 */
export function trend(checks: readonly CheckForTrend[], m: Measure): { trend: Trend; reference: number | null; latest: number[] } {
  let valid = checks.filter((c) => isValid(c) && valueOf(c, m) != null);
  if (m === 'repeated_holds' && valid.length) {
    const lastH = valid[valid.length - 1].repeatedHoldLenS ?? 0;
    valid = valid.filter((c) => Math.abs((c.repeatedHoldLenS ?? 0) - lastH) <= 1);
  }
  if (valid.length < 3) return { trend: 'too_early', reference: null, latest: [] };
  const latestTwo = valid.slice(-2).map((c) => valueOf(c, m) as number);
  const before = valid.slice(0, -2).slice(-3).map((c) => valueOf(c, m) as number);
  const R = median(before);
  const step = STEP[m];
  if (latestTwo.every((v) => v >= R + step)) return { trend: 'improvement', reference: R, latest: latestTwo };
  if (latestTwo.every((v) => v <= R - step)) return { trend: 'decline', reference: R, latest: latestTwo };
  return { trend: 'steady', reference: R, latest: latestTwo };
}

/** Overview tile (PFB-017): Up if any measure improved, Down if any declined (and none improved), else Steady / Too early. */
export function overallTrend(checks: readonly CheckForTrend[]): Trend {
  const ts = (['longest_hold', 'repeated_holds', 'quick_flicks'] as Measure[]).map((m) => trend(checks, m).trend);
  if (ts.every((t) => t === 'too_early')) return 'too_early';
  if (ts.includes('decline')) return 'decline';
  if (ts.includes('improvement')) return 'improvement';
  return 'steady';
}

/** SC-031: personal best per measure among valid checks. */
export function personalBest(checks: readonly CheckForTrend[], m: Measure): number | null {
  const vals = checks.filter(isValid).map((c) => valueOf(c, m)).filter((v): v is number => v != null);
  return vals.length ? Math.max(...vals) : null;
}

/** PRG-030: a confirmed drop = a real decline in any lying measure. */
export function confirmedDrop(lyingChecks: readonly CheckForTrend[]): boolean {
  return (['longest_hold', 'repeated_holds', 'quick_flicks'] as Measure[]).some((m) => trend(lyingChecks, m).trend === 'decline');
}

/** Valid lying longest-hold values in order, for the hold ceiling (PRG-013). */
export function validLyingLongest(checks: readonly CheckForTrend[]): number[] {
  return checks.filter((c) => c.position === 'lying' && isValid(c) && c.longestHoldS != null).map((c) => c.longestHoldS as number);
}
