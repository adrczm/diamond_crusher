// Safety screening routing (spec 01 §3-§6).
import type { Anatomy, SafetyMode } from './types';

export type QuestionKey =
  | 'Q-R1' | 'Q-R2' | 'Q-R3' | 'Q-R4'
  | 'Q-S1' | 'Q-S2' | 'Q-S2b' | 'Q-S3'
  | 'Q-P1' | 'Q-P2' | 'Q-P3' | 'Q-P4'
  | 'Q-G1' | 'Q-G2' | 'Q-G3' | 'Q-G4' | 'Q-G5'
  | 'Q-F1' | 'Q-F2' | 'Q-F3';

export type ScreeningAnswer = 'yes' | 'no' | 'skipped';
export type Answers = Partial<Record<QuestionKey, ScreeningAnswer>>;

export type ScreeningKind =
  | 'onboarding'
  | 'something_changed'
  | 'review_12w'
  | 'anatomy_change'
  | 'periodic'
  | 'after_gap'
  | 'post_session'
  | 'post_learn'
  | 'clearance';

export const URGENT: QuestionKey[] = ['Q-R1', 'Q-R2', 'Q-R3', 'Q-R4'];
export const PAIN: QuestionKey[] = ['Q-P1', 'Q-P2', 'Q-P3', 'Q-P4', 'Q-F3'];
export const CAUTION: QuestionKey[] = ['Q-G1', 'Q-G2', 'Q-G3', 'Q-G4', 'Q-G5', 'Q-F1', 'Q-F2'];

const PROFILES: Record<QuestionKey, Anatomy[]> = {
  'Q-R1': ['male', 'female', 'other_unspecified'],
  'Q-R2': ['male', 'female', 'other_unspecified'],
  'Q-R3': ['male', 'female', 'other_unspecified'],
  'Q-R4': ['male', 'female', 'other_unspecified'],
  'Q-S1': ['male', 'female', 'other_unspecified'],
  'Q-S2': ['male', 'female', 'other_unspecified'],
  'Q-S2b': ['male', 'female', 'other_unspecified'],
  'Q-S3': ['male', 'other_unspecified'],
  'Q-P1': ['male', 'female', 'other_unspecified'],
  'Q-P2': ['male', 'female', 'other_unspecified'],
  'Q-P3': ['male', 'female', 'other_unspecified'],
  'Q-P4': ['male', 'female', 'other_unspecified'],
  'Q-G1': ['male', 'female', 'other_unspecified'],
  'Q-G2': ['male'],
  'Q-G3': ['male', 'female', 'other_unspecified'],
  'Q-G4': ['male', 'female', 'other_unspecified'],
  'Q-G5': ['male', 'female', 'other_unspecified'],
  'Q-F1': ['female'],
  'Q-F2': ['female'],
  'Q-F3': ['female'],
};

const FULL_ORDER: QuestionKey[] = [
  'Q-R1', 'Q-R2', 'Q-R3', 'Q-R4',
  'Q-S1', 'Q-S2', 'Q-S2b', 'Q-S3',
  'Q-P1', 'Q-P2', 'Q-P3', 'Q-F3',
  'Q-G1', 'Q-G2', 'Q-G3', 'Q-G4', 'Q-F1', 'Q-F2',
];
const SHORT_ORDER: QuestionKey[] = ['Q-R1', 'Q-R2', 'Q-R3', 'Q-R4', 'Q-S1', 'Q-P1', 'Q-P2', 'Q-P3', 'Q-F3'];

export function appliesTo(key: QuestionKey, anatomy: Anatomy): boolean {
  return PROFILES[key].includes(anatomy);
}

export type ScreenSize = 'full' | 'short';

export function screenSizeFor(kind: ScreeningKind): ScreenSize {
  return kind === 'periodic' || kind === 'after_gap' ? 'short' : 'full';
}

/**
 * Questions shown for a screen (ONB-010, ONB-030, ONB-031). Q-P4 and Q-G5 are never asked here;
 * Q-S2b only follows a "yes" to Q-S2.
 */
export function questionsFor(size: ScreenSize, anatomy: Anatomy): QuestionKey[] {
  const order = size === 'full' ? FULL_ORDER : SHORT_ORDER;
  return order.filter((k) => appliesTo(k, anatomy));
}

/** Whether a question should be shown given the answers so far (Q-S2b depends on Q-S2). */
export function isVisible(key: QuestionKey, answers: Answers): boolean {
  if (key === 'Q-S2b') return answers['Q-S2'] === 'yes';
  return true;
}

const MODE_RANK: Record<SafetyMode, number> = {
  normal: 0,
  caution: 1,
  relax_only: 2,
  blocked_until_cleared: 3,
  blocked_urgent: 4,
};

export function higherMode(a: SafetyMode, b: SafetyMode): SafetyMode {
  return MODE_RANK[a] >= MODE_RANK[b] ? a : b;
}

export function modeRank(m: SafetyMode): number {
  return MODE_RANK[m];
}

/** Mode from a set of active reasons (ONB-012 priority: Stop > Wait > Relax-only > Caution > Start). */
export function modeFromReasons(reasons: readonly QuestionKey[]): SafetyMode {
  const has = (keys: QuestionKey[]) => reasons.some((r) => keys.includes(r));
  if (has(URGENT)) return 'blocked_urgent';
  if (reasons.includes('Q-S1') || reasons.includes('Q-S2')) return 'blocked_until_cleared';
  if (has(PAIN)) return 'relax_only';
  if (has(CAUTION)) return 'caution';
  return 'normal';
}

export interface ClearanceTicks {
  /** ONB-017: "I've been seen, or this has been checked." */
  urgentChecked?: boolean;
  /** ONB-016: "A health professional has checked me and said strengthening exercises are OK." */
  painCleared?: boolean;
}

/**
 * Combine a new screening with the reasons already active (ONB-012 to ONB-017).
 *
 * - Urgent and pain reasons persist until the matching clearance is ticked, even when the new answers are "no".
 * - Surgery reasons follow the latest answers to Q-S1 / Q-S2 + Q-S2b; if a screen didn't ask them, the old ones stay.
 * - Caution reasons follow the latest answers where asked; unasked ones stay (e.g. short screens, Q-G5).
 */
export function deriveReasons(prev: readonly QuestionKey[], answers: Answers, ticks: ClearanceTicks = {}): QuestionKey[] {
  const yes = (k: QuestionKey) => answers[k] === 'yes';
  const asked = (k: QuestionKey) => answers[k] !== undefined;
  const out = new Set<QuestionKey>();

  // Urgent (ONB-017)
  for (const k of URGENT) {
    if (yes(k)) out.add(k);
    else if (prev.includes(k) && !ticks.urgentChecked) out.add(k);
  }

  // Surgery / catheter (ONB-015)
  if (asked('Q-S1')) {
    if (yes('Q-S1')) out.add('Q-S1');
  } else if (prev.includes('Q-S1')) out.add('Q-S1');

  if (asked('Q-S2') || asked('Q-S2b')) {
    const s2Yes = asked('Q-S2') ? yes('Q-S2') : prev.includes('Q-S2');
    if (s2Yes && answers['Q-S2b'] !== 'yes') out.add('Q-S2');
  } else if (prev.includes('Q-S2')) out.add('Q-S2');

  if (asked('Q-S3')) {
    if (yes('Q-S3')) out.add('Q-S3');
  } else if (prev.includes('Q-S3')) out.add('Q-S3');

  // Pain (ONB-016, ONB-042): a "no" alone never clears it.
  for (const k of PAIN) {
    if (yes(k)) out.add(k);
    else if (prev.includes(k) && !ticks.painCleared) out.add(k);
  }

  // Caution
  for (const k of CAUTION) {
    if (asked(k)) {
      if (yes(k)) out.add(k);
    } else if (prev.includes(k)) out.add(k);
  }

  return FULL_ORDER.concat(['Q-P4', 'Q-G5']).filter((k) => out.has(k));
}

/** Caution-card keys that should (re)appear after a screen (ONB-023, ONB-032). */
export function cautionCards(reasons: readonly QuestionKey[]): QuestionKey[] {
  return reasons.filter((r) => CAUTION.includes(r));
}

export function isBlocked(mode: SafetyMode): boolean {
  return mode === 'blocked_urgent' || mode === 'blocked_until_cleared';
}

export function strengthAllowed(mode: SafetyMode): boolean {
  return mode === 'normal' || mode === 'caution';
}

/** Days in these modes don't advance the programme week (PRG-003). */
export function isRestricted(mode: SafetyMode): boolean {
  return mode === 'relax_only' || isBlocked(mode);
}

export interface PainReport {
  date: string; // local date
  level: 'a_little' | 'yes';
}

/** ONB-041: two "A little" answers within 7 days count as a pain "yes" (Q-P4). Day 1 and 7 → yes; 1 and 9 → no. */
export function painRouteTriggered(reports: readonly PainReport[], newReport: PainReport): boolean {
  if (newReport.level === 'yes') return true;
  const newMs = Date.parse(newReport.date);
  return reports.some((r) => {
    if (r.level !== 'a_little') return false;
    const days = Math.abs(newMs - Date.parse(r.date)) / 86400000;
    return days <= 6;
  });
}

/** Whether a surgery reason came from a planned surgery date that has now arrived (ONB-014). */
export function preSurgeryDue(plannedDate: string | null, today: string): boolean {
  return plannedDate !== null && today >= plannedDate;
}

/** ONB-014: suggest starting now only when surgery is 3 weeks or more away. */
export function preSurgeryAdvice(plannedDate: string, today: string): 'start_now' | 'short_notice' {
  const days = Math.round((Date.parse(plannedDate) - Date.parse(today)) / 86400000);
  return days >= 21 ? 'start_now' : 'short_notice';
}
