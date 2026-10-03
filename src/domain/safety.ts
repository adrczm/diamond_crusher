// Safety screening routing (spec 01 §3-§6).
import type { Anatomy, SafetyMode } from './types';

export type QuestionKey =
  | 'Q-R1' | 'Q-R2' | 'Q-R3' | 'Q-R4' | 'Q-R5'
  | 'Q-S1' | 'Q-S2' | 'Q-S2b' | 'Q-S3'
  | 'Q-P1' | 'Q-P2' | 'Q-P3' | 'Q-P4'
  | 'Q-G1' | 'Q-G2' | 'Q-G3' | 'Q-G4' | 'Q-G5' | 'Q-G6' | 'Q-G7'
  | 'Q-B1' | 'Q-X1' | 'Q-M1'
  | 'Q-F1' | 'Q-F1b' | 'Q-F1c'
  | 'Q-F2' // until 1.5.0: "pregnant or given birth in the last 3 months"; kept for old answers
  | 'Q-F2a' | 'Q-F2a1' | 'Q-F2a2' | 'Q-F2a3'
  | 'Q-F2b' | 'Q-F2b1' | 'Q-F2b2' | 'Q-F2b3'
  | 'Q-F3' | 'Q-F4' | 'Q-F5' | 'Q-F6' | 'Q-F7' | 'Q-F7b' | 'Q-F8' | 'Q-F9' | 'Q-F10';

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

/** Stop: get medical help today. Q-R5 (bowel, SX25), Q-F2a2 (pregnancy) and Q-F2b1 (after birth) added 2026-10-03. */
export const URGENT: QuestionKey[] = ['Q-R1', 'Q-R2', 'Q-R3', 'Q-R4', 'Q-R5', 'Q-F2a2', 'Q-F2b1'];
/** The urgent questions with a maternity wording (contact the maternity unit or midwife now). */
export const MATERNITY_URGENT: QuestionKey[] = ['Q-F2a2', 'Q-F2b1'];
export const PAIN: QuestionKey[] = ['Q-P1', 'Q-P2', 'Q-P3', 'Q-P4', 'Q-F3'];
/** Wait: training waits until the person confirms the OK (catheter, recent surgery, maternity team said no exercise). */
export const WAIT: QuestionKey[] = ['Q-S1', 'Q-S2', 'Q-F2a1'];
export const CAUTION: QuestionKey[] = [
  'Q-G1', 'Q-G2', 'Q-G3', 'Q-G4', 'Q-G5', 'Q-G6', 'Q-G7', 'Q-B1', 'Q-X1',
  'Q-F1', 'Q-F1b', 'Q-F1c', 'Q-F2', 'Q-F2a3', 'Q-F2b2', 'Q-F2b3', 'Q-F4', 'Q-F5', 'Q-F6', 'Q-F7b', 'Q-F8', 'Q-F9', 'Q-F10',
];
/** Facts, not reasons: they set what is asked next and how training is shaped (pregnancy, birth, prostate treatment, mesh). */
export const FACTS: QuestionKey[] = ['Q-M1', 'Q-F2a', 'Q-F2b', 'Q-F7'];
/** Caution cards that stay until the person says they booked a check or were seen (SX10: bleeding after menopause). */
export const STICKY_CAUTION: QuestionKey[] = ['Q-F4'];

const ALL: Anatomy[] = ['male', 'female', 'other_unspecified'];
const M_O: Anatomy[] = ['male', 'other_unspecified'];
const F: Anatomy[] = ['female'];

const PROFILES: Record<QuestionKey, Anatomy[]> = {
  'Q-R1': ALL, 'Q-R2': ALL, 'Q-R3': ALL, 'Q-R4': ALL, 'Q-R5': ALL,
  'Q-S1': ALL, 'Q-S2': ALL, 'Q-S2b': ALL, 'Q-S3': M_O,
  'Q-P1': ALL, 'Q-P2': ALL,
  // SX11: for women, straining to pee or poo is a get-checked card, not the pain route (Q-F10).
  'Q-P3': M_O,
  'Q-P4': ALL,
  'Q-G1': ALL, 'Q-G2': ['male'], 'Q-G3': ALL, 'Q-G4': ALL, 'Q-G5': ALL, 'Q-G6': ALL, 'Q-G7': M_O,
  'Q-B1': ALL, 'Q-X1': ALL, 'Q-M1': M_O,
  'Q-F1': F, 'Q-F1b': F, 'Q-F1c': F, 'Q-F2': F,
  'Q-F2a': F, 'Q-F2a1': F, 'Q-F2a2': F, 'Q-F2a3': F,
  'Q-F2b': F, 'Q-F2b1': F, 'Q-F2b2': F, 'Q-F2b3': F,
  'Q-F3': F, 'Q-F4': F, 'Q-F5': F, 'Q-F6': F, 'Q-F7': F, 'Q-F7b': F, 'Q-F8': F, 'Q-F9': F, 'Q-F10': F,
};

const FULL_ORDER: QuestionKey[] = [
  'Q-R1', 'Q-R2', 'Q-R3', 'Q-R4', 'Q-R5',
  'Q-S1', 'Q-S2', 'Q-S2b', 'Q-S3', 'Q-M1', 'Q-G7',
  'Q-F2a', 'Q-F2a2', 'Q-F2a1', 'Q-F2a3',
  'Q-F2b', 'Q-F2b1', 'Q-F2b2', 'Q-F2b3',
  'Q-P1', 'Q-P2', 'Q-P3', 'Q-F3', 'Q-F10',
  'Q-G1', 'Q-G2', 'Q-G3', 'Q-B1', 'Q-G4', 'Q-G6', 'Q-X1',
  'Q-F1', 'Q-F1b', 'Q-F1c', 'Q-F4', 'Q-F5', 'Q-F6', 'Q-F7', 'Q-F7b', 'Q-F8', 'Q-F9',
];
/** ONB-030. For women it adds the pregnancy warning signs (if pregnant), emptying after birth (first 6 weeks) and Q-F4. */
const SHORT_ORDER: QuestionKey[] = ['Q-R1', 'Q-R2', 'Q-R3', 'Q-R4', 'Q-R5', 'Q-F2a2', 'Q-F2b1', 'Q-S1', 'Q-P1', 'Q-P2', 'Q-P3', 'Q-F3', 'Q-F4'];

/** Facts from earlier answers that decide follow-up questions (see screeningFacts). */
export interface ScreeningFacts {
  pregnant?: boolean;
  /** Gave birth less than 6 weeks ago. */
  birthWithin6Weeks?: boolean;
  prostateTreatment?: boolean;
}

export function appliesTo(key: QuestionKey, anatomy: Anatomy): boolean {
  return PROFILES[key].includes(anatomy);
}

export type ScreenSize = 'full' | 'short';

export function screenSizeFor(kind: ScreeningKind): ScreenSize {
  return kind === 'periodic' || kind === 'after_gap' ? 'short' : 'full';
}

/**
 * Questions shown for a screen (ONB-010, ONB-030, ONB-031). Q-P4 and Q-G5 are never asked here, nor the old Q-F2.
 * Follow-up questions show only after the answer they depend on (isVisible).
 */
export function questionsFor(size: ScreenSize, anatomy: Anatomy, facts: ScreeningFacts = {}): QuestionKey[] {
  const order = size === 'full' ? FULL_ORDER : SHORT_ORDER;
  return order.filter((k) => {
    if (!appliesTo(k, anatomy)) return false;
    if (size === 'short' && k === 'Q-F2a2') return !!facts.pregnant;
    if (size === 'short' && k === 'Q-F2b1') return !!facts.birthWithin6Weeks;
    return true;
  });
}

/** What the person says changed, on "Something changed?" (UX audit M10). Pregnancy or birth: female profile only. */
export type ChangeTopic = 'pain' | 'leaks' | 'surgery_health' | 'pregnancy' | 'other';

/** Questions per change topic. The urgent questions are always asked as well. */
const CHANGE_QUESTIONS: Record<Exclude<ChangeTopic, 'other'>, QuestionKey[]> = {
  pain: ['Q-P1', 'Q-P2', 'Q-P3', 'Q-F3', 'Q-F2b3'],
  leaks: ['Q-G1', 'Q-G3', 'Q-B1', 'Q-P3', 'Q-F10', 'Q-G6', 'Q-M1', 'Q-G7', 'Q-F1', 'Q-F1b', 'Q-F1c', 'Q-F6', 'Q-F8'],
  surgery_health: [
    'Q-S1', 'Q-S2', 'Q-S2b', 'Q-S3', 'Q-M1', 'Q-G7', 'Q-G2', 'Q-G4', 'Q-X1',
    'Q-F1', 'Q-F1b', 'Q-F1c', 'Q-F4', 'Q-F5', 'Q-F7', 'Q-F7b', 'Q-F9',
  ],
  pregnancy: ['Q-F2a', 'Q-F2a2', 'Q-F2a1', 'Q-F2a3', 'Q-F2b', 'Q-F2b1', 'Q-F2b2', 'Q-F2b3'],
};

/**
 * Questions for "Something changed?" (ONB-031, narrowed by UX audit M10): the urgent questions, then only the ones
 * about what changed, in the full-screen order. "Other", or no answer, gives the full screen. Questions not asked
 * keep their earlier result (see deriveReasons) and do not count as skipped.
 */
export function questionsForChange(topics: readonly ChangeTopic[], anatomy: Anatomy): QuestionKey[] {
  const full = questionsFor('full', anatomy);
  if (topics.length === 0 || topics.includes('other')) return full;
  const keys = new Set<QuestionKey>([...URGENT, ...topics.flatMap((t) => CHANGE_QUESTIONS[t as Exclude<ChangeTopic, 'other'>])]);
  return full.filter((k) => keys.has(k));
}

/** Follow-up questions and the answer each one depends on. */
const PARENT: Partial<Record<QuestionKey, QuestionKey>> = {
  'Q-S2b': 'Q-S2',
  'Q-G7': 'Q-M1',
  'Q-F1b': 'Q-F1',
  'Q-F1c': 'Q-F1',
  'Q-F2a1': 'Q-F2a',
  'Q-F2a2': 'Q-F2a',
  'Q-F2a3': 'Q-F2a',
  'Q-F2b1': 'Q-F2b',
  'Q-F2b2': 'Q-F2b',
  'Q-F2b3': 'Q-F2b',
  'Q-F7b': 'Q-F7',
};

/**
 * Whether a question shows, given the answers so far. A follow-up shows after a "yes" to its parent; when this screen
 * did not ask the parent, the earlier fact decides (G2: Q-G7 needs recorded prostate treatment; pregnancy follow-ups).
 */
export function isVisible(key: QuestionKey, answers: Answers, facts: ScreeningFacts = {}): boolean {
  const parent = PARENT[key];
  if (!parent) return true;
  if (answers[parent] !== undefined) return answers[parent] === 'yes';
  if (key === 'Q-G7') return !!facts.prostateTreatment;
  if (key === 'Q-F2a1' || key === 'Q-F2a2' || key === 'Q-F2a3') return !!facts.pregnant;
  if (key === 'Q-F2b1') return !!facts.birthWithin6Weeks;
  return false;
}

/** Children whose reasons end when the parent question is answered "no" (pregnancy over, no bulge, no mesh). */
function endedByParent(k: QuestionKey, answers: Answers): boolean {
  const parent = PARENT[k];
  return !!parent && answers[parent] === 'no';
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
  if (has(WAIT)) return 'blocked_until_cleared';
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

  // Maternity team said no exercise (SX9): waits until the person confirms the team says yes, or is no longer pregnant.
  if (asked('Q-F2a1')) {
    if (yes('Q-F2a1')) out.add('Q-F2a1');
  } else if (prev.includes('Q-F2a1') && !endedByParent('Q-F2a1', answers)) out.add('Q-F2a1');

  // Pain (ONB-016, ONB-042): a "no" alone never clears it.
  for (const k of PAIN) {
    if (yes(k)) out.add(k);
    else if (prev.includes(k) && !ticks.painCleared) out.add(k);
  }

  // Caution
  for (const k of CAUTION) {
    if (asked(k)) {
      if (yes(k)) out.add(k);
    } else if (prev.includes(k) && !endedByParent(k, answers)) out.add(k);
  }

  return ([...FULL_ORDER, 'Q-F2', 'Q-P4', 'Q-G5'] as QuestionKey[]).filter((k) => out.has(k));
}

/**
 * Safety questions the person skipped whose "yes" would stop or limit training (urgent, surgery or catheter, pain).
 * A skip is not a "no": the outcome screen names them (UX audit C1, 2026-09-27).
 */
export function skippedSafety(answers: Answers): QuestionKey[] {
  const keys: QuestionKey[] = [...URGENT, 'Q-S1', 'Q-S2', 'Q-F2a1', ...PAIN];
  return keys.filter((k) => answers[k] === 'skipped');
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
