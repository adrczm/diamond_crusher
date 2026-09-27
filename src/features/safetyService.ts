// Safety screening runs, pain reports and clearances (spec 01 §3 to §6).
import { toLocalDate } from '../domain/dates';
import {
  deriveReasons,
  modeFromReasons,
  painRouteTriggered,
  type Answers,
  type ClearanceTicks,
  type PainReport,
  type QuestionKey,
  type ScreeningKind,
} from '../domain/safety';
import type { Anatomy, SafetyMode } from '../domain/types';
import { getProfile } from '../data/repositories/profile';
import { addLevelChange, getProgramme, updateProgramme } from '../data/repositories/programme';
import { getSafetyState, insertScreeningRun, raiseFlag, setSafetyState } from '../data/repositories/safety';
import { listSessionLogs } from '../data/repositories/sessions';
import { listSelfChecks } from '../data/repositories/checks';
import { nowIso, type SqlDb } from '../data/sql';

export interface ScreeningResult {
  mode: SafetyMode;
  reasons: QuestionKey[];
  runId: string;
  /** New caution reasons, for the caution cards. */
  newCautions: QuestionKey[];
}

export async function completeScreening(
  db: SqlDb,
  input: {
    kind: ScreeningKind;
    answers: Answers;
    startedAt: string;
    surgeryDate?: string | null;
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
      dates: input.surgeryDate ? { 'Q-S3': input.surgeryDate } : undefined,
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
    if (input.answers['Q-S3'] !== undefined) {
      await updateProgramme(db, { planned_surgery_date: input.answers['Q-S3'] === 'yes' ? input.surgeryDate ?? null : null });
    }
  });
  const newCautions = reasons.filter((r) => !prev.reasons.includes(r) && ['Q-G1', 'Q-G2', 'Q-G3', 'Q-G4', 'Q-G5', 'Q-F1', 'Q-F2'].includes(r));
  return { mode, reasons, runId, newCautions };
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
  });
  return true;
}

/** Adds Q-G5 ("squeeze not clearly felt") as a caution reason (LRN-031). */
export async function raiseQG5(db: SqlDb): Promise<void> {
  const prev = await getSafetyState(db);
  if (prev.reasons.includes('Q-G5')) return;
  const reasons = [...prev.reasons, 'Q-G5' as QuestionKey];
  await setSafetyState(db, { mode: modeFromReasons(reasons), reasons, runId: prev.set_by_run_id });
}

export async function clearQG5(db: SqlDb): Promise<void> {
  const prev = await getSafetyState(db);
  if (!prev.reasons.includes('Q-G5')) return;
  const reasons = prev.reasons.filter((r) => r !== 'Q-G5');
  await setSafetyState(db, { mode: modeFromReasons(reasons), reasons, runId: prev.set_by_run_id });
}

export type ClearanceKind = 'urgent' | 'pain' | 'surgery';

/**
 * Clearance ticks (ONB-015 to ONB-017). A clearance is a screening run of kind `clearance`.
 * After surgery the level restarts at 1 and the plan restarts easy (PRG-050 post_surgery).
 */
export async function clear(db: SqlDb, kind: ClearanceKind): Promise<ScreeningResult> {
  const prev = await getSafetyState(db);
  const wasSurgery = prev.reasons.includes('Q-S1') || prev.reasons.includes('Q-S2');
  const answers: Answers = kind === 'surgery' ? { 'Q-S1': 'no', 'Q-S2': 'no' } : {};
  const ticks: ClearanceTicks = kind === 'urgent' ? { urgentChecked: true } : kind === 'pain' ? { painCleared: true } : {};
  const res = await completeScreening(db, { kind: 'clearance', answers, startedAt: nowIso(), ticks });
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

export function todayLocal(now = new Date()): string {
  return toLocalDate(now);
}
