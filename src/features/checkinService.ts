// Symptom check-in (06c PFB-048), its safety handling (01 ONB-034) and the progression hold (04 PRG-035).
// Storage (no schema change): answers are a questionnaire_response of the app-own instrument app_symptom_checkin; offers,
// signal cards and the firmer card are safety_flag rows; a chosen lighter week is a content_view key.
import { addDays, toLocalDate, type LocalDate } from '../domain/dates';
import type { Dated } from '../domain/progress';
import { itemForProfile, type AnswerValue, type QuestionnaireModule } from '../domain/questionnaire';
import {
  checkinRecords,
  cooldownAllows,
  COOLDOWN_DAYS,
  erectionSignal,
  escalationKeys,
  feelSignal,
  followUpDue,
  holdState,
  leakSignal,
  LIGHTER_KEY,
  lighterWeekUntil,
  OVERALL,
  severityOf,
  signalKey,
  TOPIC_WORSE,
  type CheckinReason,
  type HoldState,
  type Signal,
} from '../domain/symptomCheckin';
import type { Anatomy } from '../domain/types';
import { CHECKIN_MODULE_ID, MODULES } from '../content/en/questionnaires';
import { answersFor, listResponses } from '../data/repositories/checks';
import { listEvents } from '../data/repositories/events';
import { markContentSeen, seenContent } from '../data/repositories/misc';
import { getProfile } from '../data/repositories/profile';
import { getProgramme, updateProgramme } from '../data/repositories/programme';
import { listFlags, raiseFlag, respondFlags, type FlagResponse, type SafetyFlagRow } from '../data/repositories/safety';
import { listSessionLogs, listSessions } from '../data/repositories/sessions';
import { nowIso, type SqlDb } from '../data/sql';
import { saveQuestionnaire } from './checkService';
import { reportPain } from './safetyService';
import { currentWeek } from './trainingService';

/** safety_flag.flag_key values used here. The signal cards reuse the keys SIGNAL_FLAG_CARD (safetyService) already maps. */
export const CHECKIN_FLAGS = {
  /** An offered check-in; signal_key "<reason>:<detail>:<severity>". Closed when a check-in is saved. */
  offer: 'checkin_offer',
  /** The firmer card (ONB-034); signal_key "repeat:<response id>" or "week12:<response id of the hold start>". */
  escalation: 'checkin_escalation',
  /** PFB-041 card (Q-G1 text). */
  newLeaks: 'new_leaks',
  /** PFB-042 card (Q-G2 text). */
  erectionChange: 'erection_change',
  /** A "worse" leaks, urgency or overall answer (Q-G1 text). */
  worsening: 'symptom_worsening',
} as const;

export function checkinModule(): QuestionnaireModule {
  const m = MODULES.find((x) => x.moduleId === CHECKIN_MODULE_ID);
  if (!m) throw new Error('check-in module missing');
  return m;
}

/** The check-in items for a profile (erections for the male profile only). */
export function checkinItems(anatomy: Anatomy) {
  return checkinModule().items.filter((i) => itemForProfile(i, anatomy));
}

const dateOf = (iso: string) => toLocalDate(new Date(iso));

/** Offers are kept as "<reason>:<detail>:<severity>". */
function offerReason(f: SafetyFlagRow): CheckinReason | null {
  return (f.signal_key?.split(':')[0] as CheckinReason | undefined) ?? null;
}

/** PFB-041, PFB-042 and the feel signal (PFB-048), from the stored records. */
export async function detectSignals(db: SqlDb, today: LocalDate): Promise<Signal[]> {
  const [profile, prog, events, logs, sessions, responses] = await Promise.all([
    getProfile(db),
    getProgramme(db),
    listEvents(db),
    listSessionLogs(db),
    listSessions(db),
    listResponses(db),
  ]);
  const out: Signal[] = [];
  // The app has known about leaks since the first training day or the first logged event, whichever is first.
  const since = [prog.build_started_on, sessions[0]?.local_date, events[0]?.local_date].filter((x): x is string => !!x).sort()[0] ?? null;
  const leaks = leakSignal(
    events.filter((e) => e.type === 'leak').map((e) => e.local_date),
    today,
    since
  );
  if (leaks) out.push(leaks);
  if (profile?.anatomy === 'male') {
    const firmness: Dated[] = events.filter((e) => e.type === 'sexual_activity' && e.hardness != null).map((e) => ({ date: e.local_date, value: e.hardness as number }));
    const monthly: number[] = [];
    for (const r of responses.filter((x) => x.instrument_key === 'app_monthly_sexual' && x.status !== 'abandoned')) {
      const s1 = (await answersFor(db, r.id)).find((a) => a.item_key === 'S1');
      if (s1?.value_num != null) monthly.push(s1.value_num);
    }
    const erections = erectionSignal(firmness, monthly, today);
    if (erections) out.push(erections);
  }
  const feel = feelSignal(
    logs.filter((l) => l.feel != null).map((l) => ({ date: l.local_date, value: l.feel as number })),
    today
  );
  if (feel) out.push(feel);
  return out;
}

async function checkins(db: SqlDb) {
  return checkinRecords(await listResponses(db), CHECKIN_MODULE_ID);
}

/** Raises `flagKey` for a signal unless the PFB-047 cooldown holds it back. Returns whether it was raised. */
async function raiseWithCooldown(db: SqlDb, flags: readonly SafetyFlagRow[], flagKey: string, reason: string | null, s: Signal, now: Date): Promise<boolean> {
  const today = toLocalDate(now);
  const past = flags
    .filter((f) => f.flag_key === flagKey && (reason == null || offerReason(f) === reason))
    .map((f) => ({ severity: severityOf(f.signal_key), date: dateOf(f.raised_at) }));
  if (!cooldownAllows(past, s.severity, today)) return false;
  await raiseFlag(db, flagKey, { signalKey: reason ? `${reason}:${signalKey(s)}` : signalKey(s), sourceRef: 'symptom_checkin', raisedAt: nowIso(now) });
  return true;
}

/** Raises the firmer card for each due key not raised before (ONB-034). */
async function raiseEscalations(db: SqlDb, flags: readonly SafetyFlagRow[], hold: HoldState, week: number, now: Date): Promise<string[]> {
  const raised: string[] = [];
  for (const key of escalationKeys(hold, week)) {
    if (flags.some((f) => f.flag_key === CHECKIN_FLAGS.escalation && f.signal_key === key)) continue;
    await raiseFlag(db, CHECKIN_FLAGS.escalation, { signalKey: key, sourceRef: 'symptom_checkin', raisedAt: nowIso(now) });
    raised.push(key);
  }
  return raised;
}

/**
 * Runs on each Today load: detects the signals, raises their cards (PFB-041, PFB-042; a drop in feel brings no card,
 * PFB-046) and check-in offers (PFB-048), each with the 28-day cooldown per reason unless the signal worsens. During a
 * hold it offers the follow-up check-in and raises the firmer card at programme week 12 (PRG-035, ONB-034).
 */
export async function refreshCheckin(db: SqlDb, now = new Date()): Promise<void> {
  const today = toLocalDate(now);
  const signals = await detectSignals(db, today);
  let flags = await listFlags(db);
  for (const s of signals) {
    if (s.reason === 'leaks') await raiseWithCooldown(db, flags, CHECKIN_FLAGS.newLeaks, null, s, now);
    if (s.reason === 'erections') await raiseWithCooldown(db, flags, CHECKIN_FLAGS.erectionChange, null, s, now);
    await raiseWithCooldown(db, flags, CHECKIN_FLAGS.offer, s.reason, s, now);
  }
  const hold = holdState(await checkins(db));
  if (hold.active) {
    flags = await listFlags(db);
    if (followUpDue(hold, today)) await raiseWithCooldown(db, flags, CHECKIN_FLAGS.offer, 'follow_up', { reason: 'follow_up', severity: 0, detail: 'hold' }, now);
    await raiseEscalations(db, flags, hold, await currentWeek(db, today), now);
  }
}

export interface CheckinHome {
  /** Reasons with an open offer (raised in the last 28 days and no check-in since). */
  offers: CheckinReason[];
  hold: { active: boolean; since: LocalDate | null; lighterUntil: LocalDate | null };
  /** Open firmer cards, and why (ONB-034). */
  escalation: { ids: string[]; why: ('repeat' | 'week12')[] };
}

export async function checkinHome(db: SqlDb, now = new Date()): Promise<CheckinHome> {
  const today = toLocalDate(now);
  const [flags, seen, records] = await Promise.all([listFlags(db), seenContent(db), checkins(db)]);
  const hold = holdState(records);
  const offers = flags.filter((f) => f.flag_key === CHECKIN_FLAGS.offer && !f.dismissed_at && dateOf(f.raised_at) > addDays(today, -COOLDOWN_DAYS));
  const esc = flags.filter((f) => f.flag_key === CHECKIN_FLAGS.escalation && !f.dismissed_at);
  return {
    offers: Array.from(new Set(offers.map(offerReason).filter((r): r is CheckinReason => r != null))),
    hold: { active: hold.active, since: hold.since, lighterUntil: hold.active ? lighterWeekUntil(seen, today) : null },
    escalation: {
      ids: esc.map((f) => f.id),
      why: Array.from(new Set(esc.map((f) => (f.signal_key?.startsWith('week12') ? 'week12' : 'repeat') as 'repeat' | 'week12'))),
    },
  };
}

export interface CheckinOutcome {
  responseId: string;
  overall: number | null;
  /** PRG-035: the hold after this check-in. */
  holdActive: boolean;
  holdStarted: boolean;
  holdReleased: boolean;
  /** ONB-034: the firmer card was raised by this check-in. */
  escalated: boolean;
  /** The training-pain answer switched on relax-only (ONB-041, ONB-042). */
  relaxOnly: boolean;
  /** Caution card keys to show with the result (ONB-023 text). */
  cautionKeys: ('Q-G1' | 'Q-G2')[];
}

/**
 * Saves a check-in. The urgent and pain questions were already routed through completeScreening before the items
 * (ONB-034). Here: the training-pain answer follows the pain route; a "worse" answer starts or keeps the hold, offers the
 * technique re-check, shows the matching caution card and, when it repeats or the hold is at week 12, the firmer card;
 * a "same" or "better" answer ends the hold. Every open offer is closed.
 */
export async function saveCheckin(
  db: SqlDb,
  answers: Record<string, AnswerValue>,
  opts: { startedAt: Date; now?: Date }
): Promise<CheckinOutcome> {
  const now = opts.now ?? new Date();
  const today = toLocalDate(now);
  const anatomy = (await getProfile(db))?.anatomy ?? 'other_unspecified';
  const before = holdState(await checkins(db));
  // Items that do not apply to this profile are not stored (they were never asked).
  const responseId = await saveQuestionnaire(db, checkinModule(), answers, {
    startedAt: opts.startedAt,
    scheduledCheckId: null,
    context: 'ad_hoc',
    now,
    items: checkinItems(anatomy),
  });
  const after = holdState(await checkins(db));
  const overall = typeof answers.G1 === 'number' ? answers.G1 : null;

  const pain = answers.T1;
  const relaxOnly = pain === 'yes' || pain === 'a_little' ? await reportPain(db, pain, `symptom_checkin:${responseId}`, today) : false;

  const cautionKeys: ('Q-G1' | 'Q-G2')[] = [];
  let escalated = false;
  const flags = await listFlags(db);
  const at = nowIso(now);
  const worse = (k: string) => answers[k] === TOPIC_WORSE;
  if (worse('L1') || worse('U1') || (overall === OVERALL.worse && !worse('E1'))) {
    await raiseFlag(db, CHECKIN_FLAGS.worsening, { signalKey: `checkin:${responseId}`, sourceRef: responseId, raisedAt: at });
    cautionKeys.push('Q-G1');
  }
  if (anatomy === 'male' && worse('E1')) {
    await raiseFlag(db, CHECKIN_FLAGS.erectionChange, { signalKey: `checkin:${responseId}`, sourceRef: responseId, raisedAt: at });
    cautionKeys.push('Q-G2');
  }
  if (after.active) {
    escalated = (await raiseEscalations(db, flags, after, await currentWeek(db, today), now)).length > 0;
    // LRN-050: the technique re-check is offered while the hold is on.
    const prog = await getProgramme(db);
    if (!before.active || prog.technique_prompt_at == null) await updateProgramme(db, { technique_prompt_at: at });
  }
  const open = flags.filter((f) => f.flag_key === CHECKIN_FLAGS.offer && !f.dismissed_at).map((f) => f.id);
  await respondFlags(db, open, 'dismissed');
  return {
    responseId,
    overall,
    holdActive: after.active,
    holdStarted: after.active && !before.active,
    holdReleased: before.active && !after.active,
    escalated,
    relaxOnly,
    cautionKeys,
  };
}

/** PRG-035: the opt-in lighter week, from today for 7 days. Only today's plan changes; the level stays (PRG-034). */
export async function startLighterWeek(db: SqlDb, today: LocalDate): Promise<void> {
  await markContentSeen(db, `${LIGHTER_KEY}${today}`);
}

/** Got it / I will book a check / Already seen someone on the firmer card (PFB-047). */
export async function answerEscalation(db: SqlDb, response: FlagResponse): Promise<void> {
  const flags = await listFlags(db);
  await respondFlags(
    db,
    flags.filter((f) => f.flag_key === CHECKIN_FLAGS.escalation && !f.dismissed_at).map((f) => f.id),
    response
  );
}
