// Reconciles the phone's scheduled notifications with the plan (08 REM-012 to REM-017; 09 ARCH-046).
import { addDays, toLocalDate } from '../domain/dates';
import { ALL_DAYS, keepInStep, planNotifications, type BundleDue, type PlanInput, type StepResult } from '../domain/reminders';
import { listScheduledChecks } from '../data/repositories/checks';
import { getProfile } from '../data/repositories/profile';
import { getProgramme } from '../data/repositories/programme';
import { ensureReminder, listPlan, listReminders, pruneReminderActions, replacePlan, updateReminder, type SlotPlan } from '../data/repositories/reminders';
import { getSafetyState } from '../data/repositories/safety';
import { lastSession, listSessions } from '../data/repositories/sessions';
import { getSettings, updateSettings } from '../data/repositories/settings';
import type { SqlDb } from '../data/sql';
import { cancelAll, configureNotifications, getPermission, schedule } from '../platform/notifications';

let running: Promise<void> | null = null;

/** What a change of sessions a day did to the reminders, and what Undo needs to put back. */
export interface SessionsChange {
  from: number;
  to: number;
  /** `updated`: reminders followed. `mismatch`: they did not match before, so they were left alone. */
  result: StepResult;
  /** The session slots before the change, for Undo. */
  before: SlotPlan[];
}

/**
 * Changes sessions a day and keeps the session reminders in step (round 2 decision, 08 REM-001 keep-in-step rules).
 * The plan changes even when reminders are off or paused: the reminders then match when they are turned on again.
 */
export async function setSessionsPerDay(db: SqlDb, to: number): Promise<SessionsChange | null> {
  const settings = await getSettings(db);
  const from = settings.sessions_per_day_target;
  const next = Math.max(1, Math.floor(to));
  if (next === from) return null;
  const before = await listPlan(db);
  const result = keepInStep(
    before.map((p) => ({ slotNo: p.slotNo, timeLocal: p.timeLocal, enabled: p.enabled, anchorKey: p.anchorKey })),
    from,
    next
  );
  await db.transaction(async () => {
    await updateSettings(db, { sessions_per_day_target: next });
    if (result.kind === 'updated') {
      await replacePlan(
        db,
        result.slots.map((s) => {
          const old = before.find((p) => p.slotNo === s.slotNo);
          return old
            ? { ...old, enabled: s.enabled }
            : { slotNo: s.slotNo, anchorKey: s.anchorKey, anchorCustom: null, timeLocal: s.timeLocal, weekdays: ALL_DAYS, enabled: true };
        })
      );
    }
  });
  await reconcileReminders(db);
  return { from, to: next, result, before };
}

/** Undo of setSessionsPerDay: the old number and the session reminders exactly as they were. */
export async function undoSessionsChange(db: SqlDb, change: SessionsChange): Promise<void> {
  await db.transaction(async () => {
    await updateSettings(db, { sessions_per_day_target: change.from });
    if (change.result.kind === 'updated') await replacePlan(db, change.before);
  });
  await reconcileReminders(db);
}

/** Cancel-and-reschedule of the next 7 days. Serialised so two triggers never race. */
export function reconcileReminders(db: SqlDb, now = new Date()): Promise<void> {
  const next = (running ?? Promise.resolve()).then(() => doReconcile(db, now)).catch((e) => console.warn('reminders', e));
  running = next;
  return next;
}

async function doReconcile(db: SqlDb, now: Date) {
  const settings = await getSettings(db);
  const perm = await getPermission().catch(() => 'undetermined' as const);
  if (perm !== settings.notification_permission) await updateSettings(db, { notification_permission: perm });
  await configureNotifications(settings.lock_screen_mode);
  await cancelAll();
  if (perm !== 'granted') return;
  const profile = await getProfile(db);
  if (!profile?.onboarding_completed_at) return;
  const today = toLocalDate(now);
  const [safety, prog, reminders, checks] = await Promise.all([getSafetyState(db), getProgramme(db), listReminders(db), listScheduledChecks(db)]);
  const todays = (await listSessions(db, today, today)).filter((s) => s.counts_toward_day && s.ended_at);
  const last = await lastSession(db);
  const monthly = await ensureReminder(db, 'monthly_check', '09:00');
  const weekly = await ensureReminder(db, 'weekly_summary', '19:00');
  const knack = await ensureReminder(db, 'knack_nudge', settings.knack_nudge_time ?? '10:00');
  const comeback = await ensureReminder(db, 'comeback_note', '18:00');
  const bundles: BundleDue[] = checks
    .filter((c) => (c.kind === 'monthly_check' || c.kind === 'quarterly_review') && (c.status === 'upcoming' || c.status === 'open' || c.status === 'partial'))
    .filter((c) => c.window_open <= addDays(today, 7))
    .map((c) => ({ kind: c.kind as 'monthly_check' | 'quarterly_review', windowOpen: c.window_open, dueOn: c.due_on, reminderId: monthly.id }));
  const input: PlanInput = {
    now,
    today,
    mode: safety.mode,
    slots: reminders
      .filter((r) => r.kind === 'session' && r.slot_no != null)
      .map((r) => ({ reminderId: r.id, slotNo: r.slot_no as number, timeLocal: r.time_local, weekdays: r.weekdays, enabled: r.enabled, title: r.title, body: r.body })),
    lastActiveDate: last?.local_date ?? toLocalDate(new Date(profile.onboarding_completed_at)),
    todaySessionEnds: todays.map((s) => new Date(s.ended_at as string)),
    dailyDose: prog.phase === 'maintenance' ? 1 : settings.sessions_per_day_target,
    paused: settings.reminders_paused,
    pausedUntil: settings.reminders_paused_until ? new Date(settings.reminders_paused_until) : null,
    bundles,
    weeklySummary: { enabled: settings.weekly_summary_notification, weekStartDay: settings.week_start_day, reminderId: weekly.id },
    knack: { enabled: settings.knack_nudge_enabled, time: settings.knack_nudge_time, reminderId: knack.id },
    comebackReminderId: comeback.id,
  };
  const plan = planNotifications(input);
  const ids = new Map<string, string[]>();
  for (const n of plan) {
    const id = await schedule(n);
    if (n.reminderId) ids.set(n.reminderId, [...(ids.get(n.reminderId) ?? []), id]);
  }
  const stamp = now.toISOString();
  for (const r of await listReminders(db)) await updateReminder(db, r.id, { os_ids: ids.get(r.id) ?? [], last_scheduled_at: stamp });
  await pruneReminderActions(db, now);
}
