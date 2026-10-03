// Today's plan, saving sessions, weekly progression and breaks (specs 03 and 04).
import { addDays, toLocalDate, tzOffsetMin, type LocalDate } from '../domain/dates';
import type { SessionForDay } from '../domain/adherence';
import {
  activeDates,
  applyGap,
  chooseChange,
  countTier2Week,
  enforceCaps,
  extraSessionAllowed,
  gapBand,
  gapDays,
  type Change,
  type ChangeReason,
  type GapBand,
  type Prescription,
  programmeWeek,
  weekQualifies,
} from '../domain/progression';
import { isBlocked, strengthAllowed } from '../domain/safety';
import type { BlockResult } from '../domain/session/engine';
import { dayPlan, relaxPlan, strengthPlan, type Load, type SessionPlan } from '../domain/session/plan';
import type { Completion, SafetyMode, SessionPosition } from '../domain/types';
import { strengthUnlocked } from '../domain/learn';
import { checkinRecords, holdState, lighterLoad, lighterWeekUntil } from '../domain/symptomCheckin';
import { CHECKIN_MODULE_ID } from '../content/en/questionnaires';
import { listResponses, listSelfChecks } from '../data/repositories/checks';
import { markContentSeen, reachMilestone, seenContent } from '../data/repositories/misc';
import { addLevelChange, fromPrescription, getProgramme, toPrescription, updateProgramme, type ProgrammeRow } from '../data/repositories/programme';
import { getSafetyState, listScreeningRuns } from '../data/repositories/safety';
import { insertSession, listSessionLogs, listSessionsWithReps, type SessionRow, type SessionWithReps } from '../data/repositories/sessions';
import { getSettings } from '../data/repositories/settings';
import type { SqlDb } from '../data/sql';

export function toDay(s: SessionWithReps): SessionForDay {
  return {
    localDate: s.local_date,
    completion: s.completion,
    countsTowardDay: s.counts_toward_day,
    plannedReps: s.planned_reps,
    completedReps: s.completed_reps,
    templateKey: s.template_key,
  };
}

export function loadOf(p: Prescription): Load {
  return {
    holdS: p.holdS,
    holdReps: p.holdReps,
    flickReps: p.flickReps,
    enduranceEnabled: p.enduranceEnabled,
    enduranceHoldS: p.enduranceHoldS,
    tier: p.tier,
  };
}

export type TodayKind = 'learn' | 'blocked' | 'relax' | 'strength' | 'day_done';

export interface TodayPlan {
  kind: TodayKind;
  mode: SafetyMode;
  plan: SessionPlan | null;
  slotNo: number | null;
  slotsDone: number;
  slotsTotal: number;
  /** After the day's plan: an extra session is on offer (not counted, MOT-010). */
  extraPlan: SessionPlan | null;
  extraAllowed: boolean;
  holdsToday: number;
  maintenance: boolean;
  /** PRG-035: the person chose a lighter week; today's plan uses the lighter load (the stored level is unchanged). */
  lighter: boolean;
}

export function isMaintenance(prog: ProgrammeRow): boolean {
  return prog.phase === 'maintenance';
}

export async function planToday(db: SqlDb, now = new Date()): Promise<TodayPlan> {
  const [prog, safety, settings] = await Promise.all([getProgramme(db), getSafetyState(db), getSettings(db)]);
  const today = toLocalDate(now);
  const sessions = await listSessionsWithReps(db, today, today);
  const holdsToday = sessions.reduce((a, s) => a + s.strong_holds, 0);
  const base: TodayPlan = {
    kind: 'learn',
    mode: safety.mode,
    plan: null,
    slotNo: null,
    slotsDone: 0,
    slotsTotal: 0,
    extraPlan: null,
    extraAllowed: false,
    holdsToday,
    maintenance: isMaintenance(prog),
    lighter: false,
  };
  if (isBlocked(safety.mode)) return { ...base, kind: 'blocked' };
  if (!strengthAllowed(safety.mode)) return { ...base, kind: 'relax', plan: relaxPlan('lying') };
  if (!strengthUnlocked(prog.learn_status)) return { ...base, kind: 'learn', plan: relaxPlan('lying') };
  const lighter = lighterWeekUntil(await seenContent(db), today) != null;
  const stored = loadOf(toPrescription(prog));
  const load = lighter ? lighterLoad(stored) : stored;
  const slots = dayPlan(load, settings.sessions_per_day_target, isMaintenance(prog));
  const done = sessions.filter((s) => s.template_key === 'strength' && s.counts_toward_day).length;
  const res = { ...base, lighter, slotsDone: Math.min(done, slots.length), slotsTotal: slots.length };
  if (done < slots.length) {
    const slot = slots[done];
    return { ...res, kind: 'strength', slotNo: slot.slotNo, plan: strengthPlan(load, slot.endurance, slot.position) };
  }
  const last = slots[slots.length - 1];
  const extraPlan = strengthPlan(load, false, last.position);
  return { ...res, kind: 'day_done', extraPlan, extraAllowed: extraSessionAllowed() };
}

export interface SaveSessionInput {
  plan: SessionPlan;
  slotNo: number | null;
  extra: boolean;
  startedAt: Date;
  endedAt: Date;
  completion: Completion;
  activeS: number;
  results: BlockResult[];
  position: SessionPosition;
  fromReminderId?: string | null;
}

export interface SaveSessionResult {
  id: string;
  changes: Change[];
  milestones: string[];
}

export async function saveSession(db: SqlDb, s: SaveSessionInput): Promise<SaveSessionResult> {
  const prog = await getProgramme(db);
  const localDate = toLocalDate(s.startedAt);
  const mode: SessionRow['mode'] =
    s.plan.templateKey === 'relax_only' ? 'relax_only' : prog.phase === 'maintenance' ? 'maintenance' : prog.planned_surgery_date ? 'pre_surgery' : 'standard';
  const id = await insertSession(
    db,
    {
      started_at: s.startedAt.toISOString(),
      ended_at: s.endedAt.toISOString(),
      local_date: localDate,
      tz_offset_min: tzOffsetMin(s.startedAt),
      slot_no: s.extra ? null : s.slotNo,
      mode,
      position: s.position,
      template_key: s.plan.templateKey,
      template_version: s.plan.templateVersion,
      planned: s.plan,
      completion: s.completion,
      active_duration_s: s.activeS,
      counts_toward_day: !s.extra && s.plan.templateKey === 'strength',
      from_reminder_id: s.fromReminderId ?? null,
    },
    s.results
  );
  const milestones: string[] = [];
  if (s.plan.templateKey === 'strength') {
    await updateProgramme(db, { last_session_date: localDate });
    if (s.position === 'standing' && s.completion === 'complete' && (await reachMilestone(db, 'first_standing', id))) milestones.push('first_standing');
  }
  const changes = await evaluateProgression(db, toLocalDate(s.endedAt));
  if (changes.length && (await reachMilestone(db, `level:${Date.now()}`, id))) milestones.push('level');
  const p2 = await getProgramme(db);
  if (p2.active_days >= 7 && (await reachMilestone(db, 'first_week', id))) milestones.push('first_week');
  return { id, changes, milestones };
}

/** Safety mode on each date, from the screening history (for PRG-003 restricted days). */
async function modeHistory(db: SqlDb): Promise<(d: LocalDate) => SafetyMode> {
  const runs = await listScreeningRuns(db);
  const points = runs
    .filter((r) => r.completed_at && r.outcome)
    .map((r) => ({ date: toLocalDate(new Date(r.completed_at as string)), mode: r.outcome as SafetyMode }));
  return (d: LocalDate) => {
    let m: SafetyMode = 'normal';
    for (const p of points) if (p.date <= d) m = p.mode;
    return m;
  };
}

export async function computeActiveDates(db: SqlDb, today: LocalDate): Promise<LocalDate[]> {
  const prog = await getProgramme(db);
  if (!prog.build_started_on) return [];
  const sessions = await listSessionsWithReps(db, prog.build_started_on);
  const strength = new Set(sessions.filter((s) => s.template_key === 'strength').map((s) => s.local_date));
  return activeDates(prog.build_started_on, today, strength, await modeHistory(db));
}

async function recordChanges(db: SqlDb, changes: Change[], reason: ChangeReason, evidenceRef: string | null = null) {
  for (const c of changes) await addLevelChange(db, { reason, variable: c.variable, before: c.before, after: c.after, evidenceRef });
}

/**
 * PRG-004 to PRG-006: evaluate every programme week that has ended since the last evaluation.
 * One change at most per qualifying week.
 */
export async function evaluateProgression(db: SqlDb, today: LocalDate): Promise<Change[]> {
  const prog = await getProgramme(db);
  const dates = await computeActiveDates(db, today);
  const out: Change[] = [];
  const settings = await getSettings(db);
  if (prog.phase === 'return_to_build' && prog.return_to_build_until_active_day != null && dates.length >= prog.return_to_build_until_active_day) {
    await updateProgramme(db, { phase: 'maintenance', return_to_build_until_active_day: null });
    await addLevelChange(db, { reason: 'to_maintenance', variable: 'phase', before: 'return_to_build', after: 'maintenance' });
  }
  if (prog.phase !== 'build' && prog.phase !== 'return_to_build') {
    await updateProgramme(db, { active_days: dates.length });
    return out;
  }
  const weeksDone = Math.floor(dates.length / 7);
  let p = toPrescription(prog);
  let lastWeek = prog.last_evaluated_week;
  if (weeksDone > lastWeek) {
    const sessions = (await listSessionsWithReps(db, prog.build_started_on ?? undefined)).filter((s) => s.template_key === 'strength');
    const logs = await listSessionLogs(db, prog.build_started_on ?? undefined);
    const checks = await listSelfChecks(db);
    // PRG-004 condition 5, PRG-035: a "worse" check-in open at the week's end, or now, holds the week.
    const checkins = checkinRecords(await listResponses(db), CHECKIN_MODULE_ID);
    const worseNow = holdState(checkins).active;
    for (let w = lastWeek + 1; w <= weeksDone; w++) {
      const wk = dates.slice((w - 1) * 7, w * 7);
      const inWeek = (d: string) => wk.includes(d);
      const days = wk.map((date) => ({
        date,
        completeSessions: sessions.filter((s) => s.local_date === date && s.counts_toward_day && s.completion === 'complete').length,
      }));
      const painReported =
        logs.some((l) => inWeek(l.local_date) && (l.pain === 'yes' || l.pain === 'a_little')) ||
        checks.some((c) => inWeek(c.local_date) && (c.pain === 'yes' || c.pain === 'a_little'));
      const couldNotRelease = logs.some((l) => inWeek(l.local_date) && (l.off_ticks ?? []).includes('could_not_release'));
      const regressionHold = prog.regression_hold_until != null && wk[wk.length - 1] <= prog.regression_hold_until;
      const checkinWorse = worseNow || holdState(checkins, wk[wk.length - 1]).active;
      const q = weekQualifies({ days, painReported, couldNotRelease, regressionHold, checkinWorse }, Math.min(2, settings.sessions_per_day_target));
      if (q.qualifies) {
        p = countTier2Week(p);
        const res = chooseChange(p, w);
        if (res) {
          p = enforceCaps(res.next);
          out.push(res.change);
        }
      }
      lastWeek = w;
    }
  }
  await db.transaction(async () => {
    await updateProgramme(db, { ...fromPrescription(p), last_evaluated_week: lastWeek, active_days: dates.length, last_evaluated_at: new Date().toISOString() });
    await recordChanges(db, out, 'progression');
  });
  return out;
}

export async function currentWeek(db: SqlDb, today: LocalDate): Promise<number> {
  return programmeWeek((await computeActiveDates(db, today)).length);
}

export interface PendingGap {
  days: number;
  band: Exclude<GapBand, 'none'>;
}

/** PRG-032: a break longer than 7 days since the last strengthening session, not yet handled. */
export async function pendingGap(db: SqlDb, today: LocalDate): Promise<PendingGap | null> {
  const prog = await getProgramme(db);
  if (!prog.last_session_date || !strengthUnlocked(prog.learn_status)) return null;
  const days = gapDays(prog.last_session_date, today);
  const band = gapBand(days);
  if (band === 'none') return null;
  const seen = await seenContent(db);
  if (seen.has(`gap:${prog.last_session_date}`)) return null;
  return { days, band };
}

export async function applyGapChoice(db: SqlDb, today: LocalDate, pickUp: boolean): Promise<void> {
  const prog = await getProgramme(db);
  const gap = await pendingGap(db, today);
  if (!gap || !prog.last_session_date) return;
  const res = applyGap(toPrescription(prog), gap.days, prog.phase === 'maintenance', pickUp);
  await db.transaction(async () => {
    const patch: Partial<ProgrammeRow> = { ...fromPrescription(enforceCaps(res.next)) };
    if (res.holdNextCheck) patch.regression_hold_until = addDays(today, 7);
    if (res.needsSelfCheck) patch.baseline_offer_until = addDays(today, 14);
    if (res.needsTechniqueRecheck) patch.technique_prompt_at = new Date().toISOString();
    if (res.returnToBuild) {
      patch.phase = 'return_to_build';
      patch.return_to_build_until_active_day = prog.active_days + 28;
    }
    await updateProgramme(db, patch);
    await recordChanges(db, res.changes, 'restart_after_gap');
    if (res.returnToBuild) await addLevelChange(db, { reason: 'return_to_build', variable: 'phase', before: prog.phase, after: 'return_to_build' });
    await markContentSeen(db, `gap:${prog.last_session_date}`);
  });
}

export async function switchToMaintenance(db: SqlDb): Promise<void> {
  const prog = await getProgramme(db);
  await db.transaction(async () => {
    await updateProgramme(db, { phase: 'maintenance', maintenance_since: new Date().toISOString() });
    await addLevelChange(db, { reason: 'to_maintenance', variable: 'phase', before: prog.phase, after: 'maintenance' });
  });
}

export async function keepBuilding(db: SqlDb): Promise<void> {
  const prog = await getProgramme(db);
  await db.transaction(async () => {
    await updateProgramme(db, { keep_building_until_active_day: prog.active_days + 28 });
    await addLevelChange(db, { reason: 'keep_building', variable: 'none', before: null, after: null });
  });
}
