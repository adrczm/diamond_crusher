import type { BlockResult } from '../../domain/session/engine';
import type { SessionPlan } from '../../domain/session/plan';
import type { Completion, OffTick, Pain3, SessionPosition } from '../../domain/types';
import { uuid } from '../ids';
import { bool, fromBool, insert, nowIso, parseJson, type SqlDb } from '../sql';

export interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  local_date: string;
  tz_offset_min: number;
  slot_no: number | null;
  mode: 'standard' | 'relax_only' | 'maintenance' | 'pre_surgery' | 'restart';
  position: SessionPosition;
  template_key: 'strength' | 'relax_only';
  template_version: number;
  planned: SessionPlan;
  completion: Completion;
  active_duration_s: number;
  counts_toward_day: boolean;
  from_reminder_id: string | null;
}

export interface ExerciseSetRow {
  session_id: string;
  seq: number;
  block: BlockResult['block'];
  position: SessionPosition;
  planned_reps: number;
  planned_hold_s: number;
  planned_rest_s: number;
  completed_reps: number;
  end_reason: BlockResult['endReason'];
  near_max_contractions: number;
}

export async function insertSession(db: SqlDb, s: Omit<SessionRow, 'id'>, sets: BlockResult[]): Promise<string> {
  const id = uuid();
  await db.transaction(async () => {
    await insert(db, 'session', {
      id,
      started_at: s.started_at,
      ended_at: s.ended_at,
      local_date: s.local_date,
      tz_offset_min: s.tz_offset_min,
      slot_no: s.slot_no,
      mode: s.mode,
      position: s.position,
      template_key: s.template_key,
      template_version: s.template_version,
      planned: JSON.stringify(s.planned),
      completion: s.completion,
      active_duration_s: Math.round(s.active_duration_s),
      counts_toward_day: bool(s.counts_toward_day),
      from_reminder_id: s.from_reminder_id,
    });
    for (const b of sets) {
      await insert(db, 'exercise_set', {
        session_id: id,
        seq: b.seq,
        block: b.block,
        position: s.position,
        planned_reps: b.plannedReps,
        planned_hold_s: b.plannedHoldS,
        planned_rest_s: b.plannedRestS,
        completed_reps: b.completedReps,
        end_reason: b.endReason,
        near_max_contractions: b.block === 'hold' ? b.completedReps : 0,
      });
    }
  });
  return id;
}

function mapSession(r: Record<string, unknown>): SessionRow {
  return {
    ...(r as unknown as SessionRow),
    planned: parseJson<SessionPlan>(r.planned, {} as SessionPlan),
    counts_toward_day: fromBool(r.counts_toward_day),
  };
}

export async function listSessions(db: SqlDb, from?: string, to?: string): Promise<SessionRow[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (from) {
    where.push('local_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('local_date <= ?');
    params.push(to);
  }
  const rows = await db.all<Record<string, unknown>>(
    `SELECT * FROM session ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY started_at`,
    params
  );
  return rows.map(mapSession);
}

export interface SessionWithReps extends SessionRow {
  planned_reps: number;
  completed_reps: number;
  strong_holds: number;
}

/** Sessions with reps summed from exercise_set (LOG-010). */
export async function listSessionsWithReps(db: SqlDb, from?: string, to?: string): Promise<SessionWithReps[]> {
  const sessions = await listSessions(db, from, to);
  const sums = await db.all<{ session_id: string; planned: number; done: number; holds: number }>(
    `SELECT session_id,
            SUM(CASE WHEN block IN ('hold','flick','endurance') THEN planned_reps ELSE 0 END) AS planned,
            SUM(CASE WHEN block IN ('hold','flick','endurance') THEN completed_reps ELSE 0 END) AS done,
            SUM(CASE WHEN block = 'hold' THEN completed_reps ELSE 0 END) AS holds
       FROM exercise_set GROUP BY session_id`
  );
  const bySession = new Map(sums.map((s) => [s.session_id, s]));
  return sessions.map((s) => {
    const x = bySession.get(s.id);
    return { ...s, planned_reps: x?.planned ?? 0, completed_reps: x?.done ?? 0, strong_holds: x?.holds ?? 0 };
  });
}

export async function lastSession(db: SqlDb, templateKey?: 'strength' | 'relax_only'): Promise<SessionRow | null> {
  const row = await db.get<Record<string, unknown>>(
    `SELECT * FROM session ${templateKey ? 'WHERE template_key = ?' : ''} ORDER BY started_at DESC LIMIT 1`,
    templateKey ? [templateKey] : []
  );
  return row ? mapSession(row) : null;
}

export async function deleteSession(db: SqlDb, id: string): Promise<void> {
  await db.run('DELETE FROM session WHERE id = ?', [id]);
}

export interface SessionLogRow {
  session_id: string;
  feel: number | null;
  pain: Pain3 | null;
  off_ticks: OffTick[] | null;
  item_set_version: number;
  logged_at: string;
}

export async function saveSessionLog(db: SqlDb, l: Omit<SessionLogRow, 'logged_at'>): Promise<void> {
  await db.run('DELETE FROM session_log WHERE session_id = ?', [l.session_id]);
  await insert(db, 'session_log', {
    session_id: l.session_id,
    feel: l.feel,
    pain: l.pain,
    off_ticks: l.off_ticks ? JSON.stringify(l.off_ticks) : null,
    item_set_version: l.item_set_version,
    logged_at: nowIso(),
  });
}

export async function getSessionLog(db: SqlDb, sessionId: string): Promise<SessionLogRow | null> {
  const r = await db.get<Record<string, unknown>>('SELECT * FROM session_log WHERE session_id = ?', [sessionId]);
  return r ? { ...(r as unknown as SessionLogRow), off_ticks: parseJson<OffTick[] | null>(r.off_ticks, null) } : null;
}

export interface SessionLogWithDate extends SessionLogRow {
  local_date: string;
}

export async function listSessionLogs(db: SqlDb, from?: string): Promise<SessionLogWithDate[]> {
  const rows = await db.all<Record<string, unknown>>(
    `SELECT l.*, s.local_date FROM session_log l JOIN session s ON s.id = l.session_id ${from ? 'WHERE s.local_date >= ?' : ''} ORDER BY s.started_at`,
    from ? [from] : []
  );
  return rows.map((r) => ({ ...(r as unknown as SessionLogWithDate), off_ticks: parseJson<OffTick[] | null>(r.off_ticks, null) }));
}

export async function setHabitDay(db: SqlDb, localDate: string, used: boolean): Promise<void> {
  await db.run('DELETE FROM functional_habit_day WHERE local_date = ?', [localDate]);
  await insert(db, 'functional_habit_day', { local_date: localDate, used: bool(used), answered_at: nowIso() });
}

export async function getHabitDay(db: SqlDb, localDate: string): Promise<boolean | null> {
  const r = await db.get<{ used: number }>('SELECT used FROM functional_habit_day WHERE local_date = ?', [localDate]);
  return r ? fromBool(r.used) : null;
}

export function newId(): string {
  return uuid();
}
