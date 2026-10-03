// Learn the squeeze: attempt classification, sitting result and retry rules (spec 02).
import type { Anatomy, LearnStatus } from './types';

/** Female mirror check (SX-C.8): yes = lifted in, no = widened or bulged (a push-down sign), unsure. */
export type MirrorCheck = 'yes' | 'no' | 'unsure' | 'not_done';
export type TouchCheck = 'lifted' | 'bulged' | 'unsure' | 'not_done';
/** Optional female inside check (SX-C.10). "pushed" is a push-down sign. */
export type InsideCheck = 'lifted' | 'pushed' | 'nothing' | 'unsure' | 'not_done';
export type ReleaseAnswer = 'yes' | 'no' | 'unsure';
export type LiftAnswer = 'lift' | 'push' | 'unsure';

export interface Mistakes {
  breathing: boolean | null; // "Did you keep breathing?" yes = true
  buttocks: boolean | null; // buttocks relaxed
  thighs: boolean | null; // thighs relaxed and apart
  tummy: boolean | null; // upper tummy soft
  lift: LiftAnswer | null; // lift in vs push out
  leak: boolean | null; // any leak (true = yes, a leak happened)
}

export interface AttemptInput {
  checkMirror: MirrorCheck;
  checkTouch: TouchCheck;
  /** Female only; absent or not_done elsewhere. */
  checkInside?: InsideCheck;
  /** The profile changes what a mirror "No" means: for the female check it is "Widened or bulged". */
  anatomy?: Anatomy;
  feltRelease: ReleaseAnswer;
  mistakes: Mistakes;
}

export interface AttemptClass {
  pushDownSign: boolean;
  good: boolean;
}

/**
 * LRN-021, LRN-022: push-down signs are a "bulged down" fingertip check, "push out", or a leak. Female (SX-C.8,
 * SX-C.10): also a mirror "Widened or bulged" and an inside check "Felt a push out".
 */
export function hasPushDownSign(a: AttemptInput): boolean {
  const femaleMirrorBulge = a.anatomy === 'female' && a.checkMirror === 'no';
  return (
    a.checkTouch === 'bulged' || a.checkInside === 'pushed' || femaleMirrorBulge || a.mistakes.lift === 'push' || a.mistakes.leak === true
  );
}

/**
 * LRN-023: self-check Yes/Lifted, release Yes, no push-down sign, items 1 to 4 all Yes. Female pass rule (SX-C.12):
 * at least one clear lift on the mirror, outside touch or inside check, and no push-down sign.
 */
export function classifyAttempt(a: AttemptInput): AttemptClass {
  const pushDownSign = hasPushDownSign(a);
  const selfCheckOk = a.checkMirror === 'yes' || a.checkTouch === 'lifted' || a.checkInside === 'lifted';
  const m = a.mistakes;
  const itemsOk = m.breathing === true && m.buttocks === true && m.thighs === true && m.tummy === true;
  const good = selfCheckOk && a.feltRelease === 'yes' && !pushDownSign && itemsOk;
  return { pushDownSign, good };
}

/** What the inside check reads from profileFacts. */
export interface InsideCheckFacts {
  painWithInsertion: boolean;
  birthWithin6Weeks: boolean;
}

/** SX-C.10, Adrian SX30 note: the optional inside check is female only, and hidden with pain with sex or tampons
 * (Q-F3) and in the first 6 weeks after birth. */
export function insideCheckAllowed(anatomy: Anatomy, facts: InsideCheckFacts | null | undefined): boolean {
  if (anatomy !== 'female') return false;
  if (!facts) return false;
  return !facts.painWithInsertion && !facts.birthWithin6Weeks;
}

/** Female: the mirror check is lying propped and required on every attempt (SX-C.8). Male and other: optional, standing. */
export function mirrorCheckRequired(anatomy: Anatomy): boolean {
  return anatomy === 'female';
}

export type SittingResult = 'pass' | 'not_sure' | 'push_down';

export const MIN_ATTEMPTS = 3;
export const MAX_ATTEMPTS = 5;

/** LRN-030. Push-down wins over pass when 2+ attempts show a push-down sign. */
export function sittingResult(attempts: readonly AttemptClass[]): SittingResult {
  const pushDowns = attempts.filter((a) => a.pushDownSign).length;
  if (pushDowns >= 2) return 'push_down';
  if (attempts.length >= MIN_ATTEMPTS && pushDowns === 0 && attempts.some((a) => a.good)) return 'pass';
  return 'not_sure';
}

/** LRN-004: a sitting ends after 5 attempts, or earlier once passed after at least 3. */
export function sittingShouldEnd(attempts: readonly AttemptClass[]): boolean {
  if (attempts.length >= MAX_ATTEMPTS) return true;
  if (attempts.length >= MIN_ATTEMPTS && sittingResult(attempts) === 'pass') return true;
  return false;
}

export interface LearnProgress {
  status: LearnStatus;
  unsureSittings: number;
  firstSittingAt: string | null; // ISO ts
  passedAt: string | null;
}

export interface SittingOutcome {
  progress: LearnProgress;
  /** Set Q-G5 ("worth getting checked") now (LRN-031). */
  raiseQG5: boolean;
  /** "Start training anyway" is on offer (LRN-032). */
  canStartAnyway: boolean;
}

const DAY_MS = 86400000;

/** Applies a finished sitting to the learn progress (LRN-030 to LRN-032). */
export function applySitting(
  prev: LearnProgress,
  result: SittingResult,
  at: Date,
  anyPushDownSign: boolean
): SittingOutcome {
  const firstSittingAt = prev.firstSittingAt ?? at.toISOString();
  if (result === 'pass') {
    return {
      progress: { status: 'passed', unsureSittings: prev.unsureSittings, firstSittingAt, passedAt: at.toISOString() },
      raiseQG5: false,
      canStartAnyway: false,
    };
  }
  const unsureSittings = prev.unsureSittings + 1;
  const daysSinceFirst = (at.getTime() - Date.parse(firstSittingAt)) / DAY_MS;
  const raiseQG5 = unsureSittings >= 3 || daysSinceFirst >= 21;
  const alreadyProceeding = prev.status === 'unconfirmed_proceeding';
  let status: LearnStatus;
  if (result === 'push_down') status = 'locked_push_down';
  else status = alreadyProceeding ? 'unconfirmed_proceeding' : 'in_progress';
  return {
    progress: { status, unsureSittings, firstSittingAt, passedAt: prev.passedAt },
    raiseQG5,
    canStartAnyway: raiseQG5 && result === 'not_sure' && !anyPushDownSign,
  };
}

/** LRN-031: the 21-day rule can also fire without a new sitting. */
export function qg5DueByTime(prev: LearnProgress, now: Date): boolean {
  if (prev.status === 'passed' || !prev.firstSittingAt) return false;
  return (now.getTime() - Date.parse(prev.firstSittingAt)) / DAY_MS >= 21;
}

/** LRN-001, LRN-032: strengthening unlocks on passed or unconfirmed_proceeding. */
export function strengthUnlocked(status: LearnStatus): boolean {
  return status === 'passed' || status === 'unconfirmed_proceeding';
}

export type RetryTip = 'another_cue' | 'lie_down' | 'other_check' | 'tomorrow';

/** LRN-031 retry help, in order. */
export function retryTips(triedLying: boolean): RetryTip[] {
  const tips: RetryTip[] = ['another_cue'];
  if (!triedLying) tips.push('lie_down');
  tips.push('other_check', 'tomorrow');
  return tips;
}

/** LRN-015: rotate in-session reminder cues, never the same twice in a row. */
export function reminderCueIndex(rep: number, count: number): number {
  return ((rep % count) + count) % count;
}
