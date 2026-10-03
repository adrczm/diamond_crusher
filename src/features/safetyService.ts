// Safety screening runs, pain reports and clearances (spec 01 §3 to §6).
import { toLocalDate } from '../domain/dates';
import {
  deriveReasons,
  skippedSafety,
  modeFromReasons,
  painRouteTriggered,
  type Answers,
  type ClearanceTicks,
  type PainReport,
  type QuestionKey,
  type ScreeningKind,
} from '../domain/safety';
import { CAUTION, type ScreeningFacts } from '../domain/safety';
import type { Anatomy, SafetyMode } from '../domain/types';
import { getProfile } from '../data/repositories/profile';
import { addLevelChange, getProgramme, updateProgramme } from '../data/repositories/programme';
import {
  getSafetyState,
  insertScreeningRun,
  listFlags,
  raiseFlag,
  respondFlags,
  setSafetyState,
  type FlagResponse,
  type SafetyFlagRow,
} from '../data/repositories/safety';
import { listSessionLogs } from '../data/repositories/sessions';
import { listSelfChecks } from '../data/repositories/checks';
import { nowIso, type SqlDb } from '../data/sql';

export interface ScreeningResult {
  mode: SafetyMode;
  reasons: QuestionKey[];
  runId: string;
  /** New caution reasons, for the caution cards. */
  newCautions: QuestionKey[];
  /** Skipped questions that could stop or limit training (UX audit C1). */
  skipped: QuestionKey[];
}

export async function completeScreening(
  db: SqlDb,
  input: {
    kind: ScreeningKind;
    answers: Answers;
    startedAt: string;
    surgeryDate?: string | null;
    /** Dates given after a "yes" (due date, birth date, planned surgery). */
    dates?: Partial<Record<QuestionKey, string>>;
    ticks?: ClearanceTicks;
    sourceRef?: string | null;
  }
): Promise<ScreeningResult> {
  const profile = await getProfile(db);
  const anatomy: Anatomy = profile?.anatomy ?? 'other_unspecified';
  const prev = await getSafetyState(db);
  const reasons = deriveReasons(prev.reasons, input.answers, input.ticks ?? {});
  const mode = modeFromReasons(reasons);
  let runId = '';
  await db.transaction(async () => {
    runId = await insertScreeningRun(db, {
      kind: input.kind,
      anatomy,
      startedAt: input.startedAt,
      answers: input.answers,
      dates: { ...(input.dates ?? {}), ...(input.surgeryDate ? { 'Q-S3': input.surgeryDate } : {}) },
      outcome: mode,
      sourceRef: input.sourceRef ?? null,
    });
    await setSafetyState(db, {
      mode,
      reasons,
      runId,
      clearanceAt: input.ticks?.painCleared ? nowIso() : undefined,
      pausedReason: mode === 'relax_only' ? (reasons.includes('Q-P4') ? 'pain_report' : 'screen') : 'none',
    });
    // ONB-023 (round 2, A2): a caution answer that turns from no to yes starts a new health note on Today.
    for (const k of reasons.filter((r) => !prev.reasons.includes(r) && CAUTION.includes(r))) {
      await raiseFlag(db, CAUTION_FLAG, { signalKey: k, sourceRef: runId });
    }
    if (input.answers['Q-S3'] !== undefined) {
      await updateProgramme(db, { planned_surgery_date: input.answers['Q-S3'] === 'yes' ? input.surgeryDate ?? null : null });
    }
  });
  const newCautions = reasons.filter((r) => !prev.reasons.includes(r) && CAUTION.includes(r));
  return { mode, reasons, runId, newCautions, skipped: skippedSafety(input.answers) };
}

/** ONB-041 / ONB-042: a pain answer after a session or check. Returns whether relax-only was switched on. */
export async function reportPain(db: SqlDb, levelAnswer: 'no' | 'a_little' | 'yes', sourceRef: string, today: string): Promise<boolean> {
  if (levelAnswer === 'no') return false;
  const logs = await listSessionLogs(db);
  const checks = await listSelfChecks(db);
  const past: PainReport[] = [
    ...logs.filter((l) => l.pain === 'a_little' || l.pain === 'yes').map((l) => ({ date: l.local_date, level: l.pain as 'a_little' | 'yes' })),
    ...checks.filter((c) => c.pain === 'a_little' || c.pain === 'yes').map((c) => ({ date: c.local_date, level: c.pain as 'a_little' | 'yes' })),
  ].filter((r) => !(r.date === today && r.level === levelAnswer)); // the new report itself may already be saved
  const triggered = painRouteTriggered(past, { date: today, level: levelAnswer });
  if (!triggered) return false;
  const prev = await getSafetyState(db);
  const reasons = Array.from(new Set<QuestionKey>([...prev.reasons, 'Q-P4']));
  await db.transaction(async () => {
    const runId = await insertScreeningRun(db, {
      kind: 'post_session',
      anatomy: (await getProfile(db))?.anatomy ?? 'other_unspecified',
      startedAt: nowIso(),
      answers: { 'Q-P4': 'yes' },
      outcome: modeFromReasons(reasons),
      sourceRef,
    });
    await setSafetyState(db, { mode: modeFromReasons(reasons), reasons, runId, pausedReason: 'pain_report' });
    await raiseFlag(db, 'pain_route', { signalKey: 'Q-P4', sourceRef });
    // SX22: pain from the exercises keeps the gentle squeeze locked until the person says the pain has gone.
    await updateProgramme(db, { gentle_pain_lock: true });
  });
  return true;
}

/** Adds Q-G5 ("squeeze not clearly felt") as a caution reason (LRN-031). */
export async function raiseQG5(db: SqlDb): Promise<void> {
  const prev = await getSafetyState(db);
  if (prev.reasons.includes('Q-G5')) return;
  const reasons = [...prev.reasons, 'Q-G5' as QuestionKey];
  await setSafetyState(db, { mode: modeFromReasons(reasons), reasons, runId: prev.set_by_run_id });
  await raiseFlag(db, CAUTION_FLAG, { signalKey: 'Q-G5' });
}

export async function clearQG5(db: SqlDb): Promise<void> {
  const prev = await getSafetyState(db);
  if (!prev.reasons.includes('Q-G5')) return;
  const reasons = prev.reasons.filter((r) => r !== 'Q-G5');
  await setSafetyState(db, { mode: modeFromReasons(reasons), reasons, runId: prev.set_by_run_id });
}

export type ClearanceKind = 'urgent' | 'pain' | 'surgery' | 'maternity';

/**
 * Clearance ticks (ONB-015 to ONB-017). A clearance is a screening run of kind `clearance`.
 * After surgery the level restarts at 1 and the plan restarts easy (PRG-050 post_surgery).
 */
export async function clear(db: SqlDb, kind: ClearanceKind): Promise<ScreeningResult> {
  const prev = await getSafetyState(db);
  const wasSurgery = prev.reasons.includes('Q-S1') || prev.reasons.includes('Q-S2');
  const answers: Answers = kind === 'surgery' ? { 'Q-S1': 'no', 'Q-S2': 'no' } : kind === 'maternity' ? { 'Q-F2a1': 'no' } : {};
  const ticks: ClearanceTicks = kind === 'urgent' ? { urgentChecked: true } : kind === 'pain' ? { painCleared: true } : {};
  const res = await completeScreening(db, { kind: 'clearance', answers, startedAt: nowIso(), ticks });
  // A professional cleared the pain: the exercise-pain lock on the gentle squeeze ends too.
  if (kind === 'pain') await updateProgramme(db, { gentle_pain_lock: false });
  if (kind === 'surgery' && wasSurgery) {
    const prog = await getProgramme(db);
    await db.transaction(async () => {
      await addLevelChange(db, { reason: 'post_surgery', variable: 'phase', before: prog.phase, after: 'build' });
      await updateProgramme(db, {
        hold_s: 3,
        hold_reps: 8,
        position_tier: 0,
        unlocked_positions: ['lying'],
        endurance_enabled: false,
        planned_surgery_date: null,
        phase: prog.phase === 'learn' ? 'learn' : 'build',
      });
    });
  }
  return res;
}

/** One answer as last given, with its date (skips do not count). */
export interface LatestAnswer {
  answer: 'yes' | 'no';
  valueDate: string | null;
  /** Local date the run completed. */
  on: string;
}

/** The latest yes or no to each safety question, across all runs. */
export async function latestAnswers(db: SqlDb): Promise<Partial<Record<QuestionKey, LatestAnswer>>> {
  const rows = await db.all<{ question_key: QuestionKey; answer: 'yes' | 'no'; value_date: string | null; completed_at: string }>(
    `SELECT a.question_key, a.answer, a.value_date, r.completed_at FROM screening_answer a JOIN screening_run r ON r.id = a.run_id
     WHERE a.answer != 'skipped' AND r.completed_at IS NOT NULL ORDER BY r.completed_at, r.rowid`
  );
  const out: Partial<Record<QuestionKey, LatestAnswer>> = {};
  for (const r of rows) out[r.question_key] = { answer: r.answer, valueDate: r.value_date, on: toLocalDate(new Date(r.completed_at)) };
  return out;
}

/** Life-stage and history facts from the answers (SX-A.17, SX-E.20, G2). Read by screens, the session plan and Learn. */
export interface ProfileFacts extends ScreeningFacts {
  pregnant: boolean;
  dueDate: string | null;
  /** Gave birth in the last 12 weeks (the postnatal flag ends 12 weeks after the birth date). */
  postnatal: boolean;
  birthDate: string | null;
  birthWithin6Weeks: boolean;
  prostateTreatment: boolean;
  /** Pain with sex or tampons is an active reason (hides the inside check, SX-C.10). */
  painWithInsertion: boolean;
  /** A heaviness or bulge answer is active: 16-week build and "squeeze before you lift" (SX4). */
  bulge: boolean;
  /** Urgency reported: offers the urge control skill (SX6). */
  urgency: boolean;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function factsFrom(latest: Partial<Record<QuestionKey, LatestAnswer>>, reasons: readonly QuestionKey[], anatomy: Anatomy | null, today: string): ProfileFacts {
  const female = anatomy === 'female';
  const yes = (k: QuestionKey) => latest[k]?.answer === 'yes';
  const birth = female && yes('Q-F2b') ? latest['Q-F2b']!.valueDate ?? latest['Q-F2b']!.on : null;
  const sinceBirth = birth ? daysBetween(birth, today) : null;
  const postnatal = sinceBirth !== null && sinceBirth >= 0 && sinceBirth < 84;
  return {
    pregnant: female && yes('Q-F2a'),
    dueDate: female && yes('Q-F2a') ? latest['Q-F2a']!.valueDate : null,
    postnatal,
    birthDate: postnatal ? birth : null,
    birthWithin6Weeks: postnatal && sinceBirth! < 42,
    prostateTreatment: anatomy !== 'female' && yes('Q-M1'),
    painWithInsertion: female && reasons.includes('Q-F3'),
    bulge: female && reasons.includes('Q-F1'),
    urgency: reasons.includes('Q-G1'),
  };
}

export async function profileFacts(db: SqlDb, today = todayLocal()): Promise<ProfileFacts> {
  const profile = await getProfile(db);
  const safety = await getSafetyState(db);
  return factsFrom(await latestAnswers(db), safety.reasons, profile?.anatomy ?? null, today);
}

export function todayLocal(now = new Date()): string {
  return toLocalDate(now);
}

// ---------- Health note on Today (ONB-023, ONB-032 as changed by round 2 decision A2, 2026-10-03) ----------

/** safety_flag.flag_key for a caution answer (signal_key = the question, e.g. Q-G1). */
export const CAUTION_FLAG = 'caution';

/**
 * Logged-result signals (06c PFB-040 to PFB-042) and the caution card text each one uses. Nothing raises these flags
 * yet: when the signal checks are built, an open row of one of these keys brings the note back on its own.
 */
export const SIGNAL_FLAG_CARD: Record<string, QuestionKey> = {
  symptom_worsening: 'Q-G1',
  new_leaks: 'Q-G1',
  erection_change: 'Q-G2',
};

export interface HealthNoteState {
  /** Caution card keys to show, in order, without repeats. */
  keys: QuestionKey[];
  /** Open flags that an answer on the card closes. */
  openIds: string[];
  /** Active caution reasons with no flag row yet (from before round 2): they count as open. */
  missing: QuestionKey[];
  /** The card shows at the top of Today. */
  show: boolean;
  /** Every note was answered: Today shows the quiet "1 health note" row instead. */
  hidden: boolean;
}

/**
 * Whether the doctor note shows (A2). It shows while any active caution reason has an open flag (or none at all), or a
 * logged-result signal is open. An answer closes them all. It comes back only when something changes: a caution
 * answer turns from no to yes (completeScreening raises a new flag), or a new signal flag is raised. A re-check with
 * the same "yes" answers raises nothing, so the note stays hidden. Only shown in caution mode, as before.
 */
export function healthNoteState(mode: SafetyMode, reasons: readonly QuestionKey[], flags: readonly SafetyFlagRow[]): HealthNoteState {
  const cautions = mode === 'caution' ? reasons.filter((r) => CAUTION.includes(r)) : [];
  const openIds: string[] = [];
  const missing: QuestionKey[] = [];
  let open = false;
  for (const r of cautions) {
    const rows = flags.filter((f) => f.flag_key === CAUTION_FLAG && f.signal_key === r);
    if (!rows.length) {
      missing.push(r);
      open = true;
    }
    for (const f of rows) {
      if (f.dismissed_at) continue;
      openIds.push(f.id);
      open = true;
    }
  }
  const signalKeys: QuestionKey[] = [];
  if (mode === 'normal' || mode === 'caution') {
    for (const f of flags) {
      const card = SIGNAL_FLAG_CARD[f.flag_key];
      if (!card || f.dismissed_at) continue;
      openIds.push(f.id);
      signalKeys.push(card);
      open = true;
    }
  }
  const keys = Array.from(new Set<QuestionKey>([...cautions, ...signalKeys]));
  return { keys, openIds, missing, show: open && keys.length > 0, hidden: !open && keys.length > 0 };
}

/** Gives active caution reasons from before round 2 their flag row, so an answer can be stored on it. */
export async function ensureCautionFlags(db: SqlDb): Promise<SafetyFlagRow[]> {
  const safety = await getSafetyState(db);
  const flags = await listFlags(db);
  const { missing } = healthNoteState(safety.mode, safety.reasons, flags);
  if (!missing.length) return flags;
  for (const k of missing) await raiseFlag(db, CAUTION_FLAG, { signalKey: k, sourceRef: safety.set_by_run_id });
  return listFlags(db);
}

/** Got it / I will book a check / Already seen someone: hides the note and keeps the answer on each flag (PFB-047). */
export async function answerHealthNote(db: SqlDb, response: FlagResponse): Promise<void> {
  const flags = await ensureCautionFlags(db);
  const safety = await getSafetyState(db);
  await respondFlags(db, healthNoteState(safety.mode, safety.reasons, flags).openIds, response);
}
