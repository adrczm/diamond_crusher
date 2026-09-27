// Rolling 7-day reminder plan (08 REM-012 to REM-017, MOT-021, MOT-022; 09 ARCH-046, ARCH-047).
import { addDays, atLocalTime, diffDays, isoWeekday, type LocalDate } from './dates';
import type { SafetyMode } from './types';
import { isBlocked } from './safety';

export type ReminderKind = 'session' | 'monthly_check' | 'quarterly_review' | 'weekly_summary' | 'knack_nudge' | 'comeback_note';

export interface SlotReminder {
  reminderId: string;
  slotNo: number;
  timeLocal: string; // HH:MM
  weekdays: number; // bitmask Mon=1 … Sun=64
  enabled: boolean;
  title: string | null;
  body: string | null;
}

export interface BundleDue {
  kind: 'monthly_check' | 'quarterly_review';
  windowOpen: LocalDate;
  dueOn: LocalDate;
  reminderId: string | null;
}

export interface PlanInput {
  now: Date;
  today: LocalDate;
  mode: SafetyMode;
  slots: SlotReminder[];
  /** Last day with any session, or the first-use day if none yet. */
  lastActiveDate: LocalDate;
  /** Ended-at times of today's counted sessions. */
  todaySessionEnds: Date[];
  dailyDose: number;
  paused: boolean;
  pausedUntil: Date | null;
  bundles: BundleDue[];
  weeklySummary: { enabled: boolean; weekStartDay: number; reminderId: string | null };
  knack: { enabled: boolean; time: string | null; reminderId: string | null };
  comebackReminderId: string | null;
}

export interface PlannedNotification {
  key: string; // stable id for reconcile
  kind: ReminderKind;
  reminderId: string | null;
  slotNo: number | null;
  at: Date;
  title: string;
  body: string;
  channel: 'reminders' | 'checks';
}

export const DEFAULT_TEXTS = ['Time for a few minutes', 'A few minutes now?', 'Quick session?'];
export const RELAX_TEXT = 'Time for a few calm minutes.';
export const MONTHLY_TEXT = 'Your monthly check is ready';
export const WEEKLY_TEXT = 'Your weekly summary is ready';
export const KNACK_TEXT = 'Your small habit for today';
export const COMEBACK_TEXT = 'Whenever you are ready, your few minutes are here.';
export const APP_TITLE = 'Diamond Crusher';
export const MAX_PENDING = 48;

export function weekdayBit(date: LocalDate): number {
  return 1 << (isoWeekday(date) - 1);
}

function pausedOn(input: PlanInput, at: Date): boolean {
  if (!input.paused) return false;
  return input.pausedUntil == null || at < input.pausedUntil;
}

/** Builds the notifications to schedule for today and the next 6 days. */
export function planNotifications(input: PlanInput): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  if (isBlocked(input.mode)) return out; // REM-017

  const enabledSlots = input.slots.filter((s) => s.enabled).sort((a, b) => a.slotNo - b.slotNo);
  const firstSlot = enabledSlots[0] ?? null;
  const firstTime = firstSlot?.timeLocal ?? '09:00';
  const relax = input.mode === 'relax_only';
  let comebackScheduled = false;

  for (let i = 0; i < 7; i++) {
    const day = addDays(input.today, i);
    const idleBefore = diffDays(input.lastActiveDate, day) - 1; // full days with no session before `day`

    // MOT-021: after 14 idle days, one note, then nothing.
    if (idleBefore >= 14) {
      if (idleBefore === 14 && firstSlot && input.comebackReminderId !== undefined && !comebackScheduled) {
        const at = atLocalTime(day, firstTime);
        if (at > input.now && !pausedOn(input, at)) {
          out.push({
            key: `comeback:${day}`,
            kind: 'comeback_note',
            reminderId: input.comebackReminderId,
            slotNo: null,
            at,
            title: APP_TITLE,
            body: COMEBACK_TEXT,
            channel: 'reminders',
          });
          comebackScheduled = true;
        }
      }
      continue;
    }

    const slots = idleBefore >= 3 ? (firstSlot ? [firstSlot] : []) : enabledSlots;
    slots.forEach((s, idx) => {
      if (!(s.weekdays & weekdayBit(day))) return;
      const at = atLocalTime(day, s.timeLocal);
      if (at <= input.now || pausedOn(input, at)) return;
      if (day === input.today) {
        // REM-016
        if (input.todaySessionEnds.length >= input.dailyDose) return;
        if (input.todaySessionEnds.some((e) => e <= at && at.getTime() - e.getTime() <= 90 * 60000)) return;
      }
      const text = relax ? RELAX_TEXT : DEFAULT_TEXTS[(i + idx) % DEFAULT_TEXTS.length];
      out.push({
        key: `session:${s.slotNo}:${day}`,
        kind: 'session',
        reminderId: s.reminderId,
        slotNo: s.slotNo,
        at,
        title: s.title ?? APP_TITLE,
        body: relax ? RELAX_TEXT : s.body ?? text,
        channel: 'reminders',
      });
    });

    // REM-032: optional knack nudge, never tied to bathroom events.
    if (input.knack.enabled && input.knack.time && !relax && idleBefore < 3) {
      const at = atLocalTime(day, input.knack.time);
      if (at > input.now && !pausedOn(input, at)) {
        out.push({ key: `knack:${day}`, kind: 'knack_nudge', reminderId: input.knack.reminderId, slotNo: null, at, title: APP_TITLE, body: KNACK_TEXT, channel: 'checks' });
      }
    }

    // REM-031
    if (input.weeklySummary.enabled && isoWeekday(day) === input.weeklySummary.weekStartDay) {
      const at = atLocalTime(day, firstTime);
      if (at > input.now) {
        out.push({ key: `weekly:${day}`, kind: 'weekly_summary', reminderId: input.weeklySummary.reminderId, slotNo: null, at, title: APP_TITLE, body: WEEKLY_TEXT, channel: 'checks' });
      }
    }
  }

  // REM-030: window opens, due date, and 7 days after due.
  for (const b of input.bundles) {
    for (const d of [b.windowOpen, b.dueOn, addDays(b.dueOn, 7)]) {
      if (d < input.today || d > addDays(input.today, 6)) continue;
      const at = atLocalTime(d, firstTime);
      if (at <= input.now) continue;
      out.push({ key: `${b.kind}:${d}`, kind: b.kind, reminderId: b.reminderId, slotNo: null, at, title: APP_TITLE, body: MONTHLY_TEXT, channel: 'checks' });
    }
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.slice(0, MAX_PENDING);
}

/** REM-003 default times per anchor. */
export const ANCHOR_TIMES: Record<string, string> = {
  wake: '07:30',
  teeth: '07:45',
  commute: '08:30',
  lunch: '12:30',
  tv: '20:30',
  bed: '22:30',
};

export const ALL_DAYS = 127;
