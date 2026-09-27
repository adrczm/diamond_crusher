// Weekly target, trained days and the weekly summary (08 §5, 06c §6).
import { addDays, type LocalDate, weekStart } from './dates';
import type { Completion } from './types';

export interface SessionForDay {
  localDate: LocalDate;
  completion: Completion;
  countsTowardDay: boolean;
  plannedReps: number;
  completedReps: number;
  templateKey: 'strength' | 'relax_only';
}

/** MOT-002: a day counts when a session is complete, or partial sessions total at least half of one session's reps. */
export function isTrainedDay(sessions: readonly SessionForDay[]): boolean {
  const counted = sessions.filter((s) => s.countsTowardDay);
  if (counted.some((s) => s.completion === 'complete')) return true;
  const partial = counted.filter((s) => s.completion !== 'complete');
  if (!partial.length) return false;
  const planned = Math.max(...partial.map((s) => s.plannedReps));
  const done = partial.reduce((a, s) => a + s.completedReps, 0);
  return planned > 0 && done >= planned * 0.5;
}

export function groupByDate<T extends { localDate: LocalDate }>(rows: readonly T[]): Map<LocalDate, T[]> {
  const m = new Map<LocalDate, T[]>();
  for (const r of rows) {
    const list = m.get(r.localDate) ?? [];
    list.push(r);
    m.set(r.localDate, list);
  }
  return m;
}

export interface WeekDots {
  start: LocalDate;
  days: { date: LocalDate; trained: boolean; isToday: boolean; future: boolean }[];
  trainedCount: number;
}

/** MOT-003: 7 neutral day dots for the week containing `today`. */
export function weekDots(sessions: readonly SessionForDay[], today: LocalDate, weekStartDay: number): WeekDots {
  const start = weekStart(today, weekStartDay);
  const byDate = groupByDate(sessions);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, trained: isTrainedDay(byDate.get(date) ?? []), isToday: date === today, future: date > today };
  });
  return { start, days, trainedCount: days.filter((d) => d.trained).length };
}

export function trainedDaysBetween(sessions: readonly SessionForDay[], from: LocalDate, to: LocalDate): number {
  const byDate = groupByDate(sessions.filter((s) => s.localDate >= from && s.localDate <= to));
  let n = 0;
  for (const list of byDate.values()) if (isTrainedDay(list)) n++;
  return n;
}

/** PFB-051 (2): sessions done vs planned, capped at the daily dose. */
export function sessionsCounted(sessions: readonly SessionForDay[], from: LocalDate, to: LocalDate, dailyDose: number): number {
  const byDate = groupByDate(
    sessions.filter((s) => s.localDate >= from && s.localDate <= to && s.countsTowardDay && s.templateKey === 'strength')
  );
  let n = 0;
  for (const list of byDate.values()) n += Math.min(dailyDose, list.length);
  return n;
}

export interface WeeklySummaryInput {
  weekStart: LocalDate;
  daysTrained: number;
  targetDays: number;
  sessionsCounted: number;
  sessionsPlanned: number;
  painReported: boolean;
  /** PFB-054: progression check result for build/return-to-build weeks; null otherwise. */
  progression: null | { qualifies: boolean; failedOnlyOnSessions: boolean };
  nextCheck: LocalDate | null;
  logged: { leaks: number; sexual: number };
  messageLine: string | null;
}

export type ProgressionNote = 'sessions' | 'other' | null;

/** PFB-054: extra line when the target was met but the progression check didn't qualify. */
export function progressionNote(i: WeeklySummaryInput): ProgressionNote {
  if (i.painReported || !i.progression || i.progression.qualifies) return null;
  if (i.daysTrained < i.targetDays) return null;
  return i.progression.failedOnlyOnSessions ? 'sessions' : 'other';
}
