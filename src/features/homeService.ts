// Everything the home screen shows, derived in one pass (09 ARCH-034 step 5).
import { weekDots, type WeekDots } from '../domain/adherence';
import { diffDays, toLocalDate } from '../domain/dates';
import { strengthUnlocked } from '../domain/learn';
import { lastIncrease, level, maintenanceDue, nextMilestone, type LevelChangeRecord } from '../domain/progression';
import type { QuestionKey } from '../domain/safety';
import { getMeta } from '../data/repositories/misc';
import { listScheduledChecks, listSelfChecks } from '../data/repositories/checks';
import { activeGoals, getProfile, type ProfileRow } from '../data/repositories/profile';
import { getProgramme, listLevelChanges, toPrescription, type ProgrammeRow } from '../data/repositories/programme';
import { getSafetyState, type SafetyStateRow } from '../data/repositories/safety';
import { listSessionsWithReps } from '../data/repositories/sessions';
import { getSettings, type Settings } from '../data/repositories/settings';
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
  levelName: { variable: string; after: unknown } | null;
  next: ReturnType<typeof nextMilestone> | null;
  gap: PendingGap | null;
  check: CheckDue | null;
  safetyRecheck: boolean;
  baselineOffer: boolean;
  techniqueCheck: boolean;
  summary: WeeklySummaryRow | null;
  maintenanceOffer: boolean;
  exportReminder: boolean;
  cautions: QuestionKey[];
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
  const from = toLocalDate(new Date(now.getTime() - 8 * 86400000));
  const sessions = (await listSessionsWithReps(db, from)).map(toDay);
  const week = weekDots(sessions, todayStr, settings.week_start_day);
  const weekTarget = programme.phase === 'maintenance' ? settings.maintenance_days_target ?? settings.weekly_days_target : settings.weekly_days_target;
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
    level: level(records),
    levelName: inc ? { variable: inc.variable, after: inc.after } : null,
    next: unlocked ? nextMilestone(toPrescription(programme), Math.floor(programme.active_days / 7) + 1) : null,
    gap: await pendingGap(db, todayStr),
    check: unlocked ? await currentCheck(db, todayStr) : null,
    safetyRecheck: await safetyRecheckDue(db, todayStr),
    baselineOffer:
      unlocked && programme.baseline_offer_until != null && todayStr <= programme.baseline_offer_until && !checks.some((c) => c.kind === 'baseline'),
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
  };
}
