// Everything the home screen shows, derived in one pass (09 ARCH-034 step 5).
// Round 2 (2026-10-03): the level path and rings (A1), today's sessions as a timeline (A3), the health note that hides
// until something changes (A2), one suggestion queue (critique priority 2) and the level-up card (MOT-032).
import { Platform } from 'react-native';
import { groupByDate, weekDots, type WeekDots } from '../domain/adherence';
import { addDays, atLocalTime, minutesOfDay, toLocalDate, type LocalDate } from '../domain/dates';
import { strengthUnlocked } from '../domain/learn';
import {
  chooseChange,
  countTier2Week,
  enforceCaps,
  lastIncrease,
  level,
  LIMITS,
  maintenanceDue,
  nextMilestone,
  programmeWeek,
  type Change,
  type LevelChangeRecord,
  type Prescription,
} from '../domain/progression';
import { weekdayBit } from '../domain/reminders';
import { isBlocked, type QuestionKey } from '../domain/safety';
import { personalBest, type CheckForTrend, type Measure } from '../domain/selfcheck';
import { dayPlan } from '../domain/session/plan';
import type { Position } from '../domain/types';
import { getMeta, listMilestones, markContentSeen, markMilestoneSeen, seenContent } from '../data/repositories/misc';
import { backupDue } from '../domain/backup';
import { listScheduledChecks, listSelfChecks } from '../data/repositories/checks';
import { activeGoals, getProfile, updateProfile, type ProfileRow } from '../data/repositories/profile';
import { getProgramme, listLevelChanges, toPrescription, type ProgrammeRow } from '../data/repositories/programme';
import { listReminders, listSlots } from '../data/repositories/reminders';
import { getSafetyState, type SafetyStateRow } from '../data/repositories/safety';
import { listSessions, listSessionsWithReps } from '../data/repositories/sessions';
import { getSettings, todayHero, type Settings, type TodayHero } from '../data/repositories/settings';
import { nowIso } from '../data/sql';
import type { SqlDb } from '../data/sql';
import type { Goal } from '../domain/types';
import type { WeeklySummaryRow } from '../data/repositories/misc';
import { currentCheck, ensureSchedule, forTrend, safetyRecheckDue, type CheckDue } from './checkService';
import { ensureCautionFlags, healthNoteState, type HealthNoteState } from './safetyService';
import { ensureLastWeekSummary } from './summaryService';
import { loadOf, pendingGap, planToday, toDay, type PendingGap, type TodayPlan } from './trainingService';

export interface HomeModel {
  profile: ProfileRow;
  goals: Goal[];
  settings: Settings;
  safety: SafetyStateRow;
  programme: ProgrammeRow;
  today: TodayPlan;
  week: WeekDots;
  weekTarget: number;
  level: number;
  /** The highest level the programme reaches from here (level + steps left). */
  levelMax: number | null;
  levelName: { variable: string; after: unknown } | null;
  next: ReturnType<typeof nextMilestone> | null;
  /** Good weeks until `next` unlocks (build phase only). */
  weeksToNext: number | null;
  /** Complete sessions a day that make a good week (PRG-004). */
  goodDaySessions: number;
  nextReminder: Date | null;
  gap: PendingGap | null;
  check: CheckDue | null;
  safetyRecheck: boolean;
  baselineOffer: boolean;
  techniqueCheck: boolean;
  summary: WeeklySummaryRow | null;
  maintenanceOffer: boolean;
  exportReminder: boolean;
  cautions: QuestionKey[];
  /** Setup cards moved out of onboarding (C2), in the order to show them. */
  setup: SetupKey[];
  /** The doctor note (ONB-023 as changed by A2): shown, hidden behind "1 health note", or none. */
  healthNote: HealthNoteState;
  /** Everything the app suggests, in one queue: safety first, then the rest (decision 6, critique priority 2). */
  suggestions: SuggestionKey[];
  /** Sessions counted on each day of `week` (same order), for the day rings. */
  daySessions: number[];
  /** Sessions a day in the plan (the rings' segments). */
  dayDose: number;
  /** Today's sessions at their reminder times (A3). Empty in learn, relax and blocked states. */
  timeline: TimelineSlot[];
  /** Where the "now" line goes: before timeline[nowAt]; null when the sessions have no times. */
  nowAt: number | null;
  /** Level path stations (A1, MOT-031). */
  path: LevelPath;
  /** Personal bests from the monthly self-check (SC-031, D1.5). */
  bests: Record<BestMeasure, BestTile>;
  /** Path or Rings on this device (A1). */
  hero: TodayHero;
  /** A new level not yet seen on Today (MOT-032): the milestone key. */
  levelUp: string | null;
  /** Hold length now, for the level name before the first step ("3 s holds", HE-09). */
  holdS: number;
}

export type SetupKey = 'plan' | 'expect' | 'lock';

/** Everything Today can suggest. `safety` comes first and has no "Not now". */
export type SuggestionKey = 'safety' | 'check' | 'review' | 'technique' | 'baseline' | 'summary' | SetupKey | 'backup';

/** At most this many suggestions show; the rest wait behind one "Show more" button (decision 6). */
export const SUGGESTION_CAP = 2;

export interface TimelineSlot {
  /** 1-based session number of the day. */
  n: number;
  position: Position;
  /** 'HH:MM' from the reminder for this session, or null. */
  time: string | null;
  state: 'done' | 'next' | 'later';
}

export type Station = 'lying' | 'sitting' | 'standing' | 'steady' | 'longer';
export const STATIONS: Station[] = ['lying', 'sitting', 'standing', 'steady', 'longer'];

export interface LevelPath {
  /** Index into STATIONS of where the person is now; STATIONS.length at the top of the programme. */
  current: number;
  /** Good weeks since the last station step, and the good weeks still needed for the next milestone. */
  goodWeeksDone: number;
  goodWeeksLeft: number | null;
}

export type BestMeasure = 'hold' | 'inRow';

export interface BestTile {
  /** Best value of all valid lying checks, or null before the first check. */
  best: number | null;
  /** Value at each valid check, oldest first (last 6). */
  series: number[];
  /** How much the best is above the first check; 0 when it is not higher (only rises are shown). */
  rise: number;
}
export type Milestone = ReturnType<typeof nextMilestone>;

const STEP_VARS: Record<Milestone, Change['variable'][]> = {
  sitting: ['position'],
  standing: ['position'],
  endurance: ['endurance'],
  more_standing: ['position'],
  longer_holds: ['hold_s', 'hold_reps', 'endurance_hold_s'],
  top: [],
};

/**
 * Simulates good weeks from programme week `week` (PRG-006: one change per good week).
 * Returns the steps left to the top, and the good weeks until the change that brings `nextMilestone`.
 * For the step count the hold ceiling is the maximum, as later self-checks can raise it (PRG-013).
 */
export function stepsAhead(p: Prescription, week: number): { steps: number; weeksToNext: number | null } {
  const next = nextMilestone(p, week);
  const run = (start: Prescription, stopAtNext: boolean) => {
    let q = start;
    let steps = 0;
    let misses = 0;
    for (let w = week; w < week + 200 && misses < 3; w++) {
      q = countTier2Week(q);
      const res = chooseChange(q, w);
      if (!res) {
        misses++;
        continue;
      }
      misses = 0;
      q = enforceCaps(res.next);
      steps++;
      if (stopAtNext && STEP_VARS[next].includes(res.change.variable)) return { steps, weeks: w - week + 1 };
    }
    return { steps, weeks: null };
  };
  return { steps: run({ ...p, holdCeiling: LIMITS.holdMax }, false).steps, weeksToNext: next === 'top' ? null : run(p, true).weeks };
}

export interface ReminderTime {
  timeLocal: string;
  weekdays: number;
  enabled: boolean;
  slotNo: number | null;
}

/** The next session reminder after `now`. Today, only the slots after the ones already done count. */
export function nextReminderAt(slots: readonly ReminderTime[], now: Date, slotsDoneToday: number, dayDone: boolean): Date | null {
  const today = toLocalDate(now);
  for (let i = dayDone ? 1 : 0; i < 8; i++) {
    const day = addDays(today, i);
    const times = slots
      .filter((s) => s.enabled && (s.weekdays & weekdayBit(day)) !== 0 && (i > 0 || (s.slotNo ?? 0) > slotsDoneToday))
      .map((s) => atLocalTime(day, s.timeLocal))
      .filter((d) => d > now)
      .sort((a, b) => a.getTime() - b.getTime());
    if (times.length) return times[0];
  }
  return null;
}

async function loadNextReminder(db: SqlDb, settings: Settings, now: Date, slotsDone: number, dayDone: boolean): Promise<Date | null> {
  if (settings.notification_permission !== 'granted') return null;
  if (settings.reminders_paused && (!settings.reminders_paused_until || new Date(settings.reminders_paused_until) > now)) return null;
  const rows = (await listReminders(db)).filter((r) => r.kind === 'session');
  return nextReminderAt(
    rows.map((r) => ({ timeLocal: r.time_local, weekdays: r.weekdays, enabled: r.enabled, slotNo: r.slot_no })),
    now,
    slotsDone,
    dayDone
  );
}

function progressOf(programme: ProgrammeRow, records: LevelChangeRecord[]) {
  const unlocked = strengthUnlocked(programme.learn_status);
  const building = programme.phase === 'build' || programme.phase === 'return_to_build';
  const week = programmeWeek(programme.active_days);
  const p = toPrescription(programme);
  const lvl = level(records);
  const ahead = unlocked && building ? stepsAhead(p, week) : null;
  return {
    level: lvl,
    levelMax: ahead ? lvl + ahead.steps : null,
    next: unlocked ? nextMilestone(p, week) : null,
    weeksToNext: ahead?.weeksToNext ?? null,
  };
}

function weekTargetOf(programme: ProgrammeRow, settings: Settings): number {
  return programme.phase === 'maintenance' ? settings.maintenance_days_target ?? settings.weekly_days_target : settings.weekly_days_target;
}

/** The station the next milestone leads away from (A1). The path is a summary; the "Next:" line names the real step. */
const STATION_OF: Record<Milestone, number> = { sitting: 0, standing: 1, endurance: 2, more_standing: 3, longer_holds: 4, top: STATIONS.length };

/** Level path: the station now, and the good weeks done since the last station step (each good week makes one change, PRG-006). */
export function levelPath(next: Milestone | null, weeksToNext: number | null, records: readonly LevelChangeRecord[]): LevelPath {
  let since = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.variable === 'position' || r.variable === 'endurance' || r.reason === 'post_surgery' || r.reason === 'restart_after_gap') break;
    if (r.reason === 'progression') since++;
  }
  return { current: next ? STATION_OF[next] : 0, goodWeeksDone: since, goodWeeksLeft: weeksToNext };
}

/** Today's sessions in order, with the reminder time for each (A3). */
export function todayTimeline(
  positions: readonly Position[],
  slotsDone: number,
  dayDone: boolean,
  reminders: readonly ReminderTime[],
  day: LocalDate,
  now: Date
): { slots: TimelineSlot[]; nowAt: number | null } {
  const timeOf = (n: number) => reminders.find((r) => r.enabled && r.slotNo === n && (r.weekdays & weekdayBit(day)) !== 0)?.timeLocal ?? null;
  const slots = positions.map((position, i): TimelineSlot => {
    const n = i + 1;
    const state = dayDone || n <= slotsDone ? 'done' : n === slotsDone + 1 ? 'next' : 'later';
    return { n, position, time: timeOf(n), state };
  });
  if (!slots.some((s) => s.time)) return { slots, nowAt: null };
  const nowMin = minutesOfDay(now);
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let nowAt = 0;
  slots.forEach((s, i) => {
    if (s.time && mins(s.time) <= nowMin) nowAt = i + 1;
  });
  return { slots, nowAt };
}

/** Personal-best tiles from valid lying self-checks (SC-031). A drop is never drawn as a loss (MOT-020). */
export function bestTiles(checks: readonly CheckForTrend[]): Record<BestMeasure, BestTile> {
  const lying = checks.filter((c) => c.position === 'lying').sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  const tile = (m: Measure, pick: (c: CheckForTrend) => number | null): BestTile => {
    const best = personalBest(lying, m);
    const series = lying
      .filter((c) => c.conditionsMet && !c.techniqueFlag)
      .map(pick)
      .filter((v): v is number => v != null);
    return { best, series: series.slice(-6), rise: best != null && series.length ? Math.max(0, best - series[0]) : 0 };
  };
  return { hold: tile('longest_hold', (c) => c.longestHoldS), inRow: tile('repeated_holds', (c) => c.repeatedHolds) };
}

/** Sessions counted each day of the week, for the day rings (capped at the dose: extra sessions never count, MOT-010). */
export function sessionsPerDay(sessions: readonly ReturnType<typeof toDay>[], week: WeekDots, dose: number): number[] {
  const byDate = groupByDate(sessions.filter((s) => s.countsTowardDay && s.templateKey === 'strength'));
  return week.days.map((d) => Math.min(dose, byDate.get(d.date)?.length ?? 0));
}

/** The session-complete summary (H2): today, the week, progress and the next session. */
export interface SessionSummary {
  slotsDone: number;
  slotsTotal: number;
  dayDone: boolean;
  week: WeekDots;
  weekTarget: number;
  level: number;
  levelMax: number | null;
  next: Milestone | null;
  weeksToNext: number | null;
  nextReminder: Date | null;
}

export async function loadSessionSummary(db: SqlDb, now = new Date()): Promise<SessionSummary> {
  const [settings, programme, changes] = await Promise.all([getSettings(db), getProgramme(db), listLevelChanges(db)]);
  const today = await planToday(db, now);
  const from = toLocalDate(new Date(now.getTime() - 8 * 86400000));
  const week = weekDots((await listSessionsWithReps(db, from)).map(toDay), toLocalDate(now), settings.week_start_day);
  const dayDone = today.kind === 'day_done';
  return {
    slotsDone: today.slotsDone,
    slotsTotal: today.slotsTotal,
    dayDone,
    week,
    weekTarget: weekTargetOf(programme, settings),
    ...progressOf(programme, changes as unknown as LevelChangeRecord[]),
    nextReminder: await loadNextReminder(db, settings, now, today.slotsDone, dayDone),
  };
}

/** Hides a setup card for good. For "What to expect", opening it or dismissing it counts as read. */
const BACKUP_LATER = 'today:backup-later:';

/** "Not now" on the backup card: it comes back after a few days (3 on the web, 14 on phones). */
export async function backupLater(db: SqlDb, today: LocalDate): Promise<void> {
  await markContentSeen(db, `${BACKUP_LATER}${today}`);
}

export async function dismissSetup(db: SqlDb, key: SetupKey): Promise<void> {
  if (key === 'expect') await updateProfile(db, { expectations_ack_at: nowIso() });
  else await markContentSeen(db, `today:${key}`);
}

const LATER = 'today:later:';

/** "Not now" on a suggestion: setup cards go for good, the backup card for a few days, the others until tomorrow. */
export async function suggestionLater(db: SqlDb, key: SuggestionKey, today: LocalDate): Promise<void> {
  if (key === 'safety') return;
  if (key === 'plan' || key === 'expect' || key === 'lock') return dismissSetup(db, key);
  if (key === 'backup') return backupLater(db, today);
  await markContentSeen(db, `${LATER}${key}:${today}`);
}

/** The level-up card was seen (MOT-032): every level milestone reached so far is marked seen. */
export async function seeLevelUp(db: SqlDb): Promise<void> {
  for (const m of await listMilestones(db)) if (m.key.startsWith('level:') && !m.seen_at) await markMilestoneSeen(db, m.key);
}

/**
 * One queue for everything Today suggests (critique priority 2, decision 6): the safety re-check first, then
 * checks and prompts, then setup, then the backup. The screen shows SUGGESTION_CAP of them.
 */
export function suggestionQueue(input: {
  safety: boolean;
  check: 'check' | 'review' | null;
  technique: boolean;
  baseline: boolean;
  summary: boolean;
  setup: readonly SetupKey[];
  backup: boolean;
  later: ReadonlySet<SuggestionKey>;
}): SuggestionKey[] {
  const out: SuggestionKey[] = [];
  if (input.safety) out.push('safety');
  if (input.check) out.push(input.check);
  if (input.technique) out.push('technique');
  if (input.baseline) out.push('baseline');
  if (input.summary) out.push('summary');
  out.push(...input.setup);
  if (input.backup) out.push('backup');
  return out.filter((k) => k === 'safety' || !input.later.has(k));
}

/** C2: the baseline self-check is offered from the 3rd training day for 14 days, not straight after Learn. */
export const BASELINE_FROM_DAY = 3;
export const BASELINE_OFFER_DAYS = 14;

export function baselineOfferOpen(trainingDates: readonly LocalDate[], today: LocalDate): boolean {
  const third = [...new Set(trainingDates)].sort()[BASELINE_FROM_DAY - 1];
  return third != null && today <= addDays(third, BASELINE_OFFER_DAYS);
}

export async function loadHome(db: SqlDb, now = new Date()): Promise<HomeModel | null> {
  const profile = await getProfile(db);
  if (!profile) return null;
  const todayStr = toLocalDate(now);
  await ensureSchedule(db, todayStr).catch((e) => console.warn('schedule', e));
  const [goals, settings, safety, programme, changes, checks, meta] = await Promise.all([
    activeGoals(db),
    getSettings(db),
    getSafetyState(db),
    getProgramme(db),
    listLevelChanges(db),
    listSelfChecks(db),
    getMeta(db),
  ]);
  const today = await planToday(db, now);
  const [allSessions, slots, seen, reminders, milestones, flags] = await Promise.all([
    listSessions(db),
    listSlots(db),
    seenContent(db),
    listReminders(db),
    listMilestones(db),
    ensureCautionFlags(db),
  ]);
  const strength = allSessions.filter((s) => s.template_key === 'strength');
  const trainingDates = strength.filter((s) => s.counts_toward_day).map((s) => s.local_date);
  const setup: SetupKey[] = [];
  if (strength.some((s) => s.completion === 'complete') && !isBlocked(safety.mode)) {
    if ((slots.length === 0 || settings.notification_permission === 'undetermined') && !seen.has('today:plan')) setup.push('plan');
    if (!profile.expectations_ack_at) setup.push('expect');
    if (!settings.lock_enabled && !seen.has('today:lock')) setup.push('lock');
  }
  const from = toLocalDate(new Date(now.getTime() - 8 * 86400000));
  const sessions = (await listSessionsWithReps(db, from)).map(toDay);
  const week = weekDots(sessions, todayStr, settings.week_start_day);
  const weekTarget = weekTargetOf(programme, settings);
  const records = changes as unknown as LevelChangeRecord[];
  const inc = lastIncrease(records);
  const unlocked = strengthUnlocked(programme.learn_status);
  const reviewDone = (await listScheduledChecks(db)).some((c) => c.kind === 'quarterly_review' && (c.status === 'completed' || c.status === 'skipped'));
  const lastExport = meta?.last_export_at ? toLocalDate(new Date(meta.last_export_at)) : null;
  // "Not now" on the backup card is stored as a content_view key with the date it was pressed.
  const laterOn = [...seen].filter((k) => k.startsWith(BACKUP_LATER)).map((k) => k.slice(BACKUP_LATER.length)).sort().pop();
  const progress = progressOf(programme, records);
  const check = unlocked ? await currentCheck(db, todayStr) : null;
  const safetyRecheck = await safetyRecheckDue(db, todayStr);
  const baselineOffer =
    unlocked && programme.baseline_offer_until != null && baselineOfferOpen(trainingDates, todayStr) && !checks.some((c) => c.kind === 'baseline');
  const techniqueCheck = programme.technique_prompt_at != null && new Date(programme.technique_prompt_at) <= now;
  const summary = await ensureLastWeekSummary(db, now);
  // UX audit C3: first ask after the 3rd session, then weekly on the web (Safari can clear its storage).
  const exportReminder = backupDue({
    platform: Platform.OS === 'web' ? 'web' : 'native',
    sessionsCount: allSessions.length,
    lastExport,
    today: todayStr,
    reminderDays: settings.export_reminder_days,
    dismissedUntil: laterOn ? addDays(laterOn, Platform.OS === 'web' ? 3 : 14) : null,
  });
  const later = new Set(
    [...seen].filter((k) => k.startsWith(LATER) && k.endsWith(`:${todayStr}`)).map((k) => k.slice(LATER.length).split(':')[0] as SuggestionKey)
  );
  const suggestions = suggestionQueue({
    safety: safetyRecheck && safety.mode !== 'blocked_urgent',
    check: check?.open ? (check.row.kind === 'quarterly_review' ? 'review' : 'check') : null,
    technique: techniqueCheck,
    baseline: baselineOffer,
    summary: !!summary,
    // C2: the app lock exists on Android only.
    setup: setup.filter((k) => k !== 'lock' || Platform.OS === 'android'),
    backup: exportReminder,
    later,
  });
  const strengthDay = today.kind === 'strength' || today.kind === 'day_done';
  const dose = strengthDay ? today.slotsTotal : Math.max(1, settings.sessions_per_day_target);
  const positions = strengthDay
    ? dayPlan(loadOf(toPrescription(programme)), settings.sessions_per_day_target, programme.phase === 'maintenance')
        .map((d) => d.position)
        .slice(0, today.slotsTotal)
    : [];
  const line = todayTimeline(
    positions,
    today.slotsDone,
    today.kind === 'day_done',
    reminders.filter((r) => r.kind === 'session').map((r) => ({ timeLocal: r.time_local, weekdays: r.weekdays, enabled: r.enabled, slotNo: r.slot_no })),
    todayStr,
    now
  );
  const levelUp = milestones.filter((m) => m.key.startsWith('level:') && !m.seen_at).pop()?.key ?? null;
  return {
    profile,
    goals,
    settings,
    safety,
    programme,
    today,
    week,
    weekTarget,
    ...progress,
    levelName: inc ? { variable: inc.variable, after: inc.after } : null,
    goodDaySessions: Math.min(2, settings.sessions_per_day_target),
    nextReminder: await loadNextReminder(db, settings, now, today.slotsDone, today.kind === 'day_done'),
    gap: await pendingGap(db, todayStr),
    check,
    safetyRecheck,
    baselineOffer,
    techniqueCheck,
    summary,
    maintenanceOffer: maintenanceDue({
      phase: programme.phase,
      activeDays: programme.active_days,
      reviewDoneOrSkipped: reviewDone,
      keepBuildingUntilActiveDay: programme.keep_building_until_active_day,
    }),
    exportReminder,
    cautions: safety.reasons.filter((r) => ['Q-G1', 'Q-G2', 'Q-G3', 'Q-G4', 'Q-G5', 'Q-F1', 'Q-F2'].includes(r)),
    setup,
    healthNote: healthNoteState(safety.mode, safety.reasons, flags),
    suggestions,
    daySessions: sessionsPerDay(sessions, week, dose),
    dayDose: dose,
    timeline: line.slots,
    nowAt: line.nowAt,
    path: levelPath(progress.next, progress.weeksToNext, records),
    bests: bestTiles(checks.filter((c) => c.status === 'complete').map(forTrend)),
    hero: todayHero(settings),
    levelUp,
    holdS: programme.hold_s,
  };
}
