// Monthly self-check, the check schedule (bundles) and questionnaire answers (06a, 06b, 04 PRG-013, PRG-031).
import type { CheckWindow } from '../domain/checkins';
import { addDays, diffDays, formatShort, toLocalDate, tzOffsetMin, type LocalDate } from '../domain/dates';
import { applyCeiling, enforceCaps, holdCeiling, programmeWeek, startingLoad, type Change } from '../domain/progression';
import { itemVisible, possiblyRushed, score, type AnswerValue, type QuestionnaireModule } from '../domain/questionnaire';
import { kindForDue, nextDue, occurrence, shortScreenDue, statusOn, type BundleKind } from '../domain/schedule';
import { confirmedDrop, personalBest, trend, validLyingLongest, type CheckForTrend, type Measure, type Trend } from '../domain/selfcheck';
import type { Anatomy, Goal } from '../domain/types';
import { bundleModules, contentHash } from '../content/en/questionnaires';
import { HOME } from '../content/en/strings';
import {
  insertResponse,
  insertScheduledCheck,
  insertSelfCheck,
  listScheduledChecks,
  listSelfChecks,
  updateScheduledCheck,
  type ScheduledCheckRow,
  type SelfCheckRow,
} from '../data/repositories/checks';
import { insertContextFlag } from '../data/repositories/events';
import { reachMilestone } from '../data/repositories/misc';
import { activeGoals, getProfile } from '../data/repositories/profile';
import { addLevelChange, fromPrescription, getProgramme, toPrescription, updateProgramme } from '../data/repositories/programme';
import { lastScreeningOfKinds } from '../data/repositories/safety';
import { lastSession } from '../data/repositories/sessions';
import { nowIso, type SqlDb } from '../data/sql';
import { reportPain } from './safetyService';
import { computeActiveDates } from './trainingService';

export function forTrend(c: SelfCheckRow): CheckForTrend {
  return {
    id: c.id,
    performedAt: c.performed_at,
    position: c.position,
    conditionsMet: c.bladder_empty && c.not_after_session && c.same_position,
    techniqueFlag: c.technique_flag,
    longestHoldS: c.longest_hold_retry_s != null ? Math.max(c.longest_hold_s ?? 0, c.longest_hold_retry_s) : c.longest_hold_s,
    repeatedHolds: c.repeated_holds,
    repeatedHoldLenS: c.repeated_hold_len_s,
    quickFlicks: c.quick_flicks,
  };
}

export type NewSelfCheck = Omit<SelfCheckRow, 'id' | 'local_date' | 'tz_offset_min' | 'performed_at' | 'completed_at' | 'item_set_version'>;

export interface SelfCheckOutcome {
  id: string;
  previous: SelfCheckRow | null;
  /** Best of all checks in this position, for the result screen; null on the first check in that position. */
  best: Record<Measure, number | null>;
  personalBest: boolean;
  changes: Change[];
  confirmedDrop: boolean;
  topUpOffer: boolean;
  relaxOnly: boolean;
  trends: Record<Measure, Trend>;
}

/**
 * Saves a self-check and applies its consequences: hold ceiling (PRG-013), starting load for a baseline
 * before the first session (PRG-002), confirmed drop (PRG-031) and pain (ONB-041).
 */
export async function saveSelfCheck(db: SqlDb, c: NewSelfCheck, now = new Date()): Promise<SelfCheckOutcome> {
  const before = await listSelfChecks(db);
  const previous = [...before].reverse().find((x) => x.position === c.position && x.status === 'complete') ?? null;
  const id = await insertSelfCheck(db, {
    ...c,
    performed_at: nowIso(now),
    completed_at: c.status === 'complete' ? nowIso(now) : null,
    local_date: toLocalDate(now),
    tz_offset_min: tzOffsetMin(now),
    item_set_version: 1,
  });
  const all = (await listSelfChecks(db)).filter((x) => x.status === 'complete');
  const lying = all.filter((x) => x.position === 'lying').map(forTrend);
  const same = all.filter((x) => x.position === c.position).map(forTrend);
  const measures: Measure[] = ['longest_hold', 'repeated_holds', 'quick_flicks'];
  const best = Object.fromEntries(measures.map((m) => [m, personalBest(same, m)])) as Record<Measure, number | null>;
  const prevBest = before.filter((x) => x.position === c.position && x.status === 'complete').map(forTrend);
  const isPb =
    c.status === 'complete' &&
    prevBest.length > 0 &&
    measures.some((m) => {
      const pb = personalBest(prevBest, m);
      const nb = best[m];
      return pb != null && nb != null && nb > pb;
    });
  const trends = Object.fromEntries(measures.map((m) => [m, trend(same, m).trend])) as Record<Measure, Trend>;

  const prog = await getProgramme(db);
  let p = toPrescription(prog);
  const changes: Change[] = [];
  const patch: Parameters<typeof updateProgramme>[1] = {};
  if (c.status === 'complete') {
    // PRG-002: baseline before the first strengthening session sets the starting load.
    const first = await lastSession(db, 'strength');
    if (c.kind === 'baseline' && !first && c.position === 'lying' && !c.technique_flag) {
      const s = startingLoad({ longestHoldS: forTrend({ ...(c as SelfCheckRow), id }).longestHoldS, repeatedHolds: c.repeated_holds });
      if (s.holdS !== p.holdS) changes.push({ variable: 'hold_s', before: p.holdS, after: s.holdS });
      if (s.holdReps !== p.holdReps) changes.push({ variable: 'hold_reps', before: p.holdReps, after: s.holdReps });
      p = { ...p, ...s };
    }
    const ceil = applyCeiling(p, holdCeiling(validLyingLongest(lying)));
    p = enforceCaps(ceil.next);
    if (ceil.change) changes.push(ceil.change);
  }
  const drop = c.position === 'lying' && confirmedDrop(lying);
  let topUpOffer = false;
  if (drop) {
    if (prog.phase === 'maintenance') topUpOffer = true;
    else {
      patch.regression_hold_until = '9999-12-31';
      patch.technique_prompt_at = nowIso(now);
    }
  } else if (c.position === 'lying' && c.status === 'complete' && prog.regression_hold_until === '9999-12-31') {
    patch.regression_hold_until = null;
  }
  await db.transaction(async () => {
    await updateProgramme(db, { ...fromPrescription(p), ...patch, ...(c.kind === 'baseline' ? { baseline_offer_until: null } : {}) });
    for (const ch of changes) {
      await addLevelChange(db, { reason: c.kind === 'baseline' && ch.variable !== 'hold_s' ? 'initial' : 'ceiling', variable: ch.variable, before: ch.before, after: ch.after, evidenceRef: id });
    }
    if (drop) await addLevelChange(db, { reason: 'confirmed_drop', variable: 'none', before: null, after: null, evidenceRef: id });
  });
  if (isPb) await reachMilestone(db, `pr:${id}`, id);
  const relaxOnly = c.pain ? await reportPain(db, c.pain, `self_check:${id}`, toLocalDate(now)) : false;
  // UX audit M5: a first check has no best to compare with, so the result shows no "best" (not "best 0").
  const shownBest = prevBest.length ? best : ({ longest_hold: null, repeated_holds: null, quick_flicks: null } as Record<Measure, number | null>);
  return { id, previous, best: shownBest, personalBest: isPb, changes, confirmedDrop: drop, topUpOffer, relaxOnly, trends };
}

export async function acceptTopUp(db: SqlDb): Promise<void> {
  const prog = await getProgramme(db);
  await db.transaction(async () => {
    await updateProgramme(db, { phase: 'return_to_build', return_to_build_until_active_day: prog.active_days + 28 });
    await addLevelChange(db, { reason: 'return_to_build', variable: 'phase', before: prog.phase, after: 'return_to_build' });
  });
}

// ---------- Check schedule (06b §3.3) ----------

export type BundlePart = 'safety' | 'sexual_flag' | 'questionnaires' | 'self_check';

export function bundlePartsFor(kind: BundleKind, anatomy: Anatomy, goals: Goal[], modules: QuestionnaireModule[]): BundlePart[] {
  const parts: BundlePart[] = [];
  if (kind !== 'baseline') parts.push('safety');
  const sexual = anatomy === 'male' && (goals.includes('erection') || goals.includes('ejaculatory_control'));
  if (sexual) parts.push('sexual_flag');
  if (modules.length) parts.push('questionnaires');
  parts.push('self_check');
  return parts;
}

export async function modulesForCheck(db: SqlDb, kind: BundleKind): Promise<QuestionnaireModule[]> {
  const anatomy = (await getProfile(db))?.anatomy ?? 'other_unspecified';
  const goals = await activeGoals(db);
  return bundleModules(anatomy, goals, kind === 'quarterly_review' ? 'quarterly' : 'monthly');
}

const BUNDLE_KINDS = ['monthly_check', 'quarterly_review'] as const;

function isBundle(r: ScheduledCheckRow): boolean {
  return (BUNDLE_KINDS as readonly string[]).includes(r.kind);
}

/** Keeps the bundle schedule current: statuses, the next occurrence after a completed or missed one. */
export async function ensureSchedule(db: SqlDb, today: LocalDate): Promise<void> {
  const prog = await getProgramme(db);
  if (!prog.build_started_on) return;
  let rows = (await listScheduledChecks(db)).filter(isBundle);
  const active = await computeActiveDates(db, today);
  const weekNow = programmeWeek(active.length);
  const reviewsDone = () => rows.filter((r) => r.kind === 'quarterly_review' && (r.status === 'completed' || r.status === 'skipped')).length;
  const create = async (due: LocalDate) => {
    const weekAtDue = weekNow + Math.max(0, Math.floor(diffDays(today, due) / 7));
    const kind = kindForDue(weekAtDue, reviewsDone());
    const o = occurrence(kind, due);
    await insertScheduledCheck(db, { kind, due_on: due, window_open: o.windowOpen, window_close: o.windowClose, status: statusOn(o, today, false) });
    rows = (await listScheduledChecks(db)).filter(isBundle);
  };
  if (!rows.length) {
    await create(addDays(prog.build_started_on, 28));
    return;
  }
  for (const r of rows) {
    if (r.status === 'completed' || r.status === 'skipped' || r.status === 'missed') continue;
    const o = occurrence(r.kind as BundleKind, r.due_on);
    const s = statusOn(o, today, r.parts_done.length > 0);
    if (s !== r.status) await updateScheduledCheck(db, r.id, { status: s });
  }
  rows = (await listScheduledChecks(db)).filter(isBundle);
  const last = rows[rows.length - 1];
  if (last.status === 'completed' || last.status === 'skipped' || last.status === 'missed') {
    const completedOn = last.completed_at ? toLocalDate(new Date(last.completed_at)) : null;
    let due = nextDue(last.due_on, last.status === 'completed' ? completedOn : null);
    while (addDays(due, 14) < today) due = addDays(due, 28);
    await create(due);
  }
}

/** W2: "First check: opens Sat 24 Oct, due Tue 27 Oct", the same line on every screen that names the next check. */
export function checkLine(w: CheckWindow): string {
  return HOME.checkLine(w.first, formatShort(w.opensOn), formatShort(w.dueOn));
}

export interface CheckDue {
  row: ScheduledCheckRow;
  parts: BundlePart[];
  open: boolean;
}

/** The current (or next) bundle and its parts. */
export async function currentCheck(db: SqlDb, today: LocalDate): Promise<CheckDue | null> {
  const rows = (await listScheduledChecks(db)).filter(isBundle).filter((r) => r.status !== 'completed' && r.status !== 'skipped' && r.status !== 'missed');
  const row = rows[0];
  if (!row) return null;
  const anatomy = (await getProfile(db))?.anatomy ?? 'other_unspecified';
  const goals = await activeGoals(db);
  const modules = await modulesForCheck(db, row.kind as BundleKind);
  const parts = bundlePartsFor(row.kind as BundleKind, anatomy, goals, modules);
  return { row, parts, open: today >= row.window_open };
}

export async function markPart(db: SqlDb, checkId: string, part: BundlePart, parts: BundlePart[]): Promise<boolean> {
  const row = (await listScheduledChecks(db)).find((r) => r.id === checkId);
  if (!row) return false;
  const done = Array.from(new Set([...row.parts_done, part]));
  const complete = parts.every((p) => done.includes(p));
  await updateScheduledCheck(db, checkId, {
    parts_done: done,
    status: complete ? 'completed' : 'partial',
    completed_at: complete ? nowIso() : null,
  });
  return complete;
}

export async function skipCheck(db: SqlDb, checkId: string): Promise<void> {
  await updateScheduledCheck(db, checkId, { status: 'skipped', completed_at: nowIso() });
}

/** ONB-030: short safety re-check every 4 weeks. */
export async function safetyRecheckDue(db: SqlDb, today: LocalDate): Promise<boolean> {
  const last = await lastScreeningOfKinds(db, ['onboarding', 'something_changed', 'periodic', 'after_gap', 'review_12w', 'anatomy_change']);
  return shortScreenDue(last?.completed_at ? toLocalDate(new Date(last.completed_at)) : null, today);
}

// ---------- Questionnaires ----------

export async function saveQuestionnaire(
  db: SqlDb,
  m: QuestionnaireModule,
  answers: Record<string, AnswerValue>,
  opts: { startedAt: Date; scheduledCheckId: string | null; context: 'baseline' | 'monthly' | 'quarterly' | 'ad_hoc'; consistencyAction?: 'kept' | 'reviewed' | null }
): Promise<string> {
  const now = new Date();
  const res = score(m, answers);
  const durationS = Math.round((now.getTime() - opts.startedAt.getTime()) / 1000);
  const flags = possiblyRushed(durationS) ? ['possibly_rushed'] : [];
  return insertResponse(
    db,
    {
      scheduled_check_id: opts.scheduledCheckId,
      instrument_key: m.moduleId,
      instrument_version: m.version,
      content_hash: contentHash(m),
      context: opts.context,
      started_at: opts.startedAt.toISOString(),
      completed_at: now.toISOString(),
      duration_s: durationS,
      status: res.status,
      total_score: res.total,
      subscale_scores: res.subscales,
      scoring_version: 1,
      flags,
      consistency_note_action: opts.consistencyAction ?? null,
    },
    m.items
      .filter((i) => itemVisible(i, answers))
      .map((i) => {
        const v = answers[i.itemId];
        return {
          item_key: i.itemId,
          value_num: typeof v === 'number' ? v : null,
          value_text: typeof v === 'string' ? v : Array.isArray(v) ? JSON.stringify(v) : null,
          skipped: v == null,
        };
      })
  );
}

/** Monthly "any sexual activity?" flag: a "No" becomes a context note so charts can explain gaps (06a). */
export async function saveSexualFlag(db: SqlDb, answer: 'yes' | 'no' | 'prefer_not', today: LocalDate): Promise<void> {
  if (answer === 'no') await insertContextFlag(db, { kind: 'no_sexual_activity_period', from_date: addDays(today, -28), to_date: today, note: null });
}
