// Weekly summary (06c §6, 08 §5): days trained vs target, sessions, pain, and the progression note.
import { addDays, toLocalDate, weekStart, type LocalDate } from '../domain/dates';
import { progressionNote, sessionsCounted, trainedDaysBetween } from '../domain/adherence';
import { listEvents } from '../data/repositories/events';
import { listWeeklySummaries, saveWeeklySummary, type WeeklySummaryRow } from '../data/repositories/misc';
import { getProgramme } from '../data/repositories/programme';
import { listSessionLogs, listSessionsWithReps } from '../data/repositories/sessions';
import { getSettings } from '../data/repositories/settings';
import type { SqlDb } from '../data/sql';
import { toDay } from './trainingService';

/** Writes the summary for last week if it isn't there yet. Returns it when it's new and unviewed. */
export async function ensureLastWeekSummary(db: SqlDb, now = new Date()): Promise<WeeklySummaryRow | null> {
  const prog = await getProgramme(db);
  if (!prog.build_started_on) return null;
  const settings = await getSettings(db);
  const today = toLocalDate(now);
  const start = addDays(weekStart(today, settings.week_start_day), -7);
  const end = addDays(start, 6);
  if (end < prog.build_started_on) return null;
  const existing = await listWeeklySummaries(db);
  if (!existing.some((s) => s.week_start === start)) {
    const sessions = (await listSessionsWithReps(db, start, end)).map(toDay);
    const logs = await listSessionLogs(db, start);
    const pain = logs.some((l) => l.local_date <= end && (l.pain === 'yes' || l.pain === 'a_little'));
    const daily = prog.phase === 'maintenance' ? 1 : settings.sessions_per_day_target;
    const days = trainedDaysBetween(sessions, start, end);
    const target = prog.phase === 'maintenance' ? settings.maintenance_days_target ?? settings.weekly_days_target : settings.weekly_days_target;
    const counted = sessionsCounted(sessions, start, end, daily);
    const fullDays = new Map<LocalDate, number>();
    for (const s of sessions) if (s.countsTowardDay && s.completion === 'complete' && s.templateKey === 'strength') fullDays.set(s.localDate, (fullDays.get(s.localDate) ?? 0) + 1);
    const sessionsOk = [...fullDays.values()].filter((n) => n >= Math.min(2, daily)).length >= 5;
    const note =
      prog.phase === 'build' || prog.phase === 'return_to_build'
        ? progressionNote({
            weekStart: start,
            daysTrained: days,
            targetDays: target,
            sessionsCounted: counted,
            sessionsPlanned: 7 * daily,
            painReported: pain,
            progression: { qualifies: sessionsOk && !pain, failedOnlyOnSessions: !sessionsOk && !pain },
            nextCheck: null,
            logged: { leaks: 0, sexual: 0 },
            messageLine: null,
          })
        : null;
    await saveWeeklySummary(db, {
      week_start: start,
      days_trained: days,
      target_days: target,
      sessions_counted: counted,
      sessions_planned: 7 * daily,
      message_id: days < target ? 'neutral' : null,
      pain_reported: pain,
      progression_note: note,
    });
  }
  const row = (await listWeeklySummaries(db)).find((s) => s.week_start === start) ?? null;
  return row && !row.viewed_at ? row : null;
}

export async function loggedInWeek(db: SqlDb, start: LocalDate): Promise<{ leaks: number; sexual: number }> {
  const end = addDays(start, 6);
  const ev = (await listEvents(db)).filter((e) => e.local_date >= start && e.local_date <= end);
  return { leaks: ev.filter((e) => e.type === 'leak').length, sexual: ev.filter((e) => e.type === 'sexual_activity').length };
}
