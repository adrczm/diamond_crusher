// Symptom check-in (06c PFB-048, 01 ONB-034) and the progression hold it drives (04 PRG-004 condition 5, PRG-035).
// Pure rules: no storage and no copy. Thresholds are design choices (research/symptom-worsening/findings.md, progression-l2a.md).
import { addDays, diffDays, toLocalDate, type LocalDate } from './dates';
import { compareWithPrevious, type Dated } from './progress';

/** Why the check-in is offered. `follow_up` is the next check-in during a hold (PRG-035: a later check-in releases it). */
export type CheckinReason = 'leaks' | 'erections' | 'feel' | 'follow_up';

/** PFB-047, PFB-048: at most once every 28 days per reason, unless the signal worsens again. */
export const COOLDOWN_DAYS = 28;

/** A hold that is still open at this programme week shows the firmer card (ONB-034, PRG-035; ICI 8 to 12 weeks, NICE 3 months). */
export const ESCALATION_WEEK = 12;

/** Days a chosen lighter week lasts (PRG-035, opt-in only). */
export const LIGHTER_WEEK_DAYS = 7;

/** Answer values of the "Compared with a month ago" item (instrument app_symptom_checkin, item G1). */
export const OVERALL = { better: 1, same: 2, worse: 3 } as const;
export type Overall = (typeof OVERALL)[keyof typeof OVERALL];

/** Answer value "worse" on the per-topic items (leaks, urgency, erections). */
export const TOPIC_WORSE = 3;

export interface Signal {
  reason: CheckinReason;
  /** How strong the signal is. Higher is worse; the cooldown lets a stronger signal through (PFB-047). */
  severity: number;
  /** What fired, for the stored signal key. */
  detail: 'new' | 'doubled' | 'firmness' | 'monthly' | 'feel' | 'hold';
}

/** The stored signal key ("doubled:6"): the detail and the severity, so a later signal can be compared with it. */
export function signalKey(s: Pick<Signal, 'detail' | 'severity'>): string {
  return `${s.detail}:${s.severity}`;
}

/** The severity in a stored signal key, or null for keys that carry none (for example cards raised by a check-in). */
export function severityOf(key: string | null): number | null {
  const m = key ? /:(-?\d+(?:\.\d+)?)$/.exec(key) : null;
  return m ? Number(m[1]) : null;
}

/**
 * PFB-041 new leaks: a leak in the last 4 weeks with none in the 8 weeks before it; or doubled leaks: the last 4-week block
 * has at least 3 leaks and at least twice the block before. Both need leak logging long enough to know the earlier weeks
 * (`trackingSince`: the first day the app was in use), so a first leak logged in week 2 is not "new" (design choice).
 * Severity (the signal level of AC-PFB-9): 1 for new leaks, the leaks in the last 4 weeks (3 or more) for doubled leaks.
 */
export function leakSignal(leakDates: readonly LocalDate[], today: LocalDate, trackingSince: LocalDate | null): Signal | null {
  if (!trackingSince) return null;
  const curFrom = addDays(today, -27);
  const prevFrom = addDays(today, -55);
  const current = leakDates.filter((d) => d >= curFrom && d <= today).sort();
  if (!current.length) return null;
  const previous = leakDates.filter((d) => d >= prevFrom && d < curFrom).length;
  if (current.length >= 3 && current.length >= 2 * previous && trackingSince <= prevFrom) {
    return { reason: 'leaks', severity: current.length, detail: 'doubled' };
  }
  for (const d of current) {
    const from = addDays(d, -56);
    if (trackingSince > from) continue;
    if (!leakDates.some((x) => x >= from && x < d)) return { reason: 'leaks', severity: 1, detail: 'new' };
  }
  return null;
}

/**
 * PFB-042 erection change (male only): the firmness 4-week median is at least 1 point lower than the 8 weeks before
 * (3 or more events in each window), or the monthly item S1 is two levels or more below its first answer.
 * Severity = the drop in points.
 */
export function erectionSignal(firmness: readonly Dated[], monthlyS1: readonly number[], today: LocalDate): Signal | null {
  const c = compareWithPrevious(firmness, today, 3, 1);
  const eventDrop = c.current != null && c.previous != null && c.countPrevious >= 3 ? c.previous - c.current : 0;
  const monthlyDrop = monthlyS1.length >= 2 ? monthlyS1[0] - monthlyS1[monthlyS1.length - 1] : 0;
  if (eventDrop >= 1 && eventDrop >= monthlyDrop) return { reason: 'erections', severity: eventDrop, detail: 'firmness' };
  if (monthlyDrop >= 2) return { reason: 'erections', severity: monthlyDrop, detail: 'monthly' };
  return null;
}

/**
 * PFB-048: session feel (LOG-011) lower 2 weeks running. The 4-week median (6 or more sessions, PFB-014) is "lower" than
 * the 8 weeks before (PFB-024) both today and 7 days ago. Feel never gates progression and never brings a referral on
 * its own (PRG-004 R1, PFB-046): it only offers the check-in. Severity = the drop in points today.
 */
export function feelSignal(feel: readonly Dated[], today: LocalDate): Signal | null {
  const now = compareWithPrevious(feel, today, 6, 1);
  const before = compareWithPrevious(feel, addDays(today, -7), 6, 1);
  if (now.direction !== 'lower' || before.direction !== 'lower') return null;
  return { reason: 'feel', severity: (now.previous as number) - (now.current as number), detail: 'feel' };
}

export interface PastSignal {
  severity: number | null;
  date: LocalDate;
}

/**
 * PFB-047, PFB-048 cooldown: a reason fires again only 28 days or more after the last time, unless the signal is now
 * stronger than every time it fired in those 28 days ("unless it gets worse again"). Rows without a severity do not count.
 */
export function cooldownAllows(past: readonly PastSignal[], severity: number, today: LocalDate): boolean {
  const recent = past.filter((p) => p.severity != null && diffDays(p.date, today) < COOLDOWN_DAYS);
  if (!recent.length) return true;
  return severity > Math.max(...recent.map((p) => p.severity as number));
}

export interface CheckinRecord {
  id: string;
  /** Local date of the check-in. */
  date: LocalDate;
  /** ISO time, for ordering. */
  at: string;
  /** "Compared with a month ago": 1 better, 2 same, 3 worse; null when skipped. */
  overall: number | null;
}

/**
 * Check-ins from stored questionnaire responses. The "Compared with a month ago" item is the instrument's only scored
 * item, so `total_score` holds its answer (null when skipped).
 */
export function checkinRecords(
  rows: readonly { id: string; instrument_key: string; started_at: string; completed_at: string | null; total_score: number | null }[],
  moduleId: string
): CheckinRecord[] {
  return rows
    .filter((r) => r.instrument_key === moduleId)
    .map((r) => {
      const at = r.completed_at ?? r.started_at;
      return { id: r.id, at, date: toLocalDate(new Date(at)), overall: r.total_score };
    })
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

export interface HoldState {
  /** PRG-035: the last answered check-in says "worse". */
  active: boolean;
  /** The first "worse" of the current run: when the hold started. */
  startId: string | null;
  since: LocalDate | null;
  /** The answered check-ins in the current run of "worse" answers, oldest first. */
  run: CheckinRecord[];
  /** The last answered check-in. */
  last: CheckinRecord | null;
}

/** PRG-035: the hold from the check-ins up to `at` (all when omitted). Skipped answers change nothing. */
export function holdState(checkins: readonly CheckinRecord[], at?: LocalDate): HoldState {
  const answered = checkins
    .filter((c) => c.overall != null && (at == null || c.date <= at))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const run: CheckinRecord[] = [];
  for (let i = answered.length - 1; i >= 0 && answered[i].overall === OVERALL.worse; i--) run.unshift(answered[i]);
  const last = answered[answered.length - 1] ?? null;
  return { active: run.length > 0, startId: run[0]?.id ?? null, since: run[0]?.date ?? null, run, last };
}

/**
 * ONB-034, PRG-035: the firmer card ("See a pelvic health physio or doctor.") is due when the next check-in still says
 * "worse" (one key per repeat) or while a hold is open at programme week 12 or later (one key per hold). Training continues.
 */
export function escalationKeys(hold: HoldState, programmeWeek: number): string[] {
  const keys = hold.run.slice(1).map((c) => `repeat:${c.id}`);
  if (hold.active && programmeWeek >= ESCALATION_WEEK) keys.push(`week12:${hold.startId}`);
  return keys;
}

/** PRG-035: during a hold, the next check-in is offered 28 days after the last one, so a hold can end. */
export function followUpDue(hold: HoldState, today: LocalDate): boolean {
  return hold.active && hold.last != null && diffDays(hold.last.date, today) >= COOLDOWN_DAYS;
}

/** content_view key that stores a chosen lighter week: the prefix plus its first day. */
export const LIGHTER_KEY = 'checkin:lighter:';

/** The last day of a lighter week that covers `today`, from the stored keys; null when none does. */
export function lighterWeekUntil(keys: Iterable<string>, today: LocalDate): LocalDate | null {
  let until: LocalDate | null = null;
  for (const k of keys) {
    if (!k.startsWith(LIGHTER_KEY)) continue;
    const start = k.slice(LIGHTER_KEY.length);
    const end = addDays(start, LIGHTER_WEEK_DAYS - 1);
    if (start <= today && today <= end && (!until || end > until)) until = end;
  }
  return until;
}

export interface LoadLike {
  holdS: number;
  holdReps: number;
  enduranceHoldS: number;
}

/**
 * The opt-in lighter week (PRG-035): holds 1 s shorter and 2 fewer a set, steady holds 1 s shorter, within the floors.
 * Only today's plan changes: the stored level and load stay as they are (PRG-034).
 */
export function lighterLoad<T extends LoadLike>(load: T): T {
  return {
    ...load,
    holdS: Math.max(3, load.holdS - 1),
    holdReps: Math.max(3, load.holdReps - 2),
    enduranceHoldS: Math.max(5, load.enduranceHoldS - 1),
  };
}
