// Everything the home screen shows, derived in one pass (09 ARCH-034 step 5).
import { weekDots, type WeekDots } from '../domain/adherence';
import { addDays, atLocalTime, diffDays, toLocalDate, type LocalDate } from '../domain/dates';
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
import { getMeta, markContentSeen, seenContent } from '../data/repositories/misc';
import { listScheduledChecks, listSelfChecks } from '../data/repositories/checks';
import { activeGoals, getProfile, updateProfile, type ProfileRow } from '../data/repositories/profile';
import { getProgramme, listLevelChanges, toPrescription, type ProgrammeRow } from '../data/repositories/programme';
import { listReminders, listSlots } from '../data/repositories/reminders';
import { getSafetyState, type SafetyStateRow } from '../data/repositories/safety';
import { listSessions, listSessionsWithReps } from '../data/repositories/sessions';
import { getSettings, type Settings } from '../data/repositories/settings';
import { nowIso } from '../data/sql';
import type { SqlDb } from '../data/sql';
import type { Goal } from '../domain/types';
import type { WeeklySummaryRow } from '../data/repositories/misc';
import { currentCheck, ensureSchedule, safetyRecheckDue, type CheckDue } from './checkService';
import { ensureLastWeekSummary } from './summaryService';
import { pendingGap, planToday, toDay, type PendingGap, type TodayPlan } from './trainingService';

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
}

export type SetupKey = 'plan' | 'expect' | 'lock';
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
export async function dismissSetup(db: SqlDb, key: SetupKey): Promise<void> {
  if (key === 'expect') await updateProfile(db, { expectations_ack_at: nowIso() });
  else await markContentSeen(db, `today:${key}`);
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
  const [allSessions, slots, seen] = await Promise.all([listSessions(db), listSlots(db), seenContent(db)]);
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
  const hasData = sessions.length > 0 || checks.length > 0;
  const lastExport = meta?.last_export_at ? toLocalDate(new Date(meta.last_export_at)) : null;
  const firstUse = profile.onboarding_completed_at ? toLocalDate(new Date(profile.onboarding_completed_at)) : todayStr;
  return {
    profile,
    goals,
    settings,
    safety,
    programme,
    today,
    week,
    weekTarget,
    ...progressOf(programme, records),
    levelName: inc ? { variable: inc.variable, after: inc.after } : null,
    goodDaySessions: Math.min(2, settings.sessions_per_day_target),
    nextReminder: await loadNextReminder(db, settings, now, today.slotsDone, today.kind === 'day_done'),
    gap: await pendingGap(db, todayStr),
    check: unlocked ? await currentCheck(db, todayStr) : null,
    safetyRecheck: await safetyRecheckDue(db, todayStr),
    baselineOffer:
      unlocked && programme.baseline_offer_until != null && baselineOfferOpen(trainingDates, todayStr) && !checks.some((c) => c.kind === 'baseline'),
    techniqueCheck: programme.technique_prompt_at != null && new Date(programme.technique_prompt_at) <= now,
    summary: await ensureLastWeekSummary(db, now),
    maintenanceOffer: maintenanceDue({
      phase: programme.phase,
      activeDays: programme.active_days,
      reviewDoneOrSkipped: reviewDone,
      keepBuildingUntilActiveDay: programme.keep_building_until_active_day,
    }),
    exportReminder: hasData && diffDays(lastExport ?? firstUse, todayStr) >= settings.export_reminder_days,
    cautions: safety.reasons.filter((r) => ['Q-G1', 'Q-G2', 'Q-G3', 'Q-G4', 'Q-G5', 'Q-F1', 'Q-F2'].includes(r)),
    setup,
  };
}
