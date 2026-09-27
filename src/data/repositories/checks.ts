import type { BundleKind, BundleStatus } from '../../domain/schedule';
import type { Anatomy, Pain3, Ynu } from '../../domain/types';
import { uuid } from '../ids';
import { bool, fromBool, insert, nowIso, parseJson, type SqlDb, type SqlValue, update } from '../sql';

export interface SelfCheckRow {
  id: string;
  kind: 'baseline' | 'monthly' | 'ad_hoc';
  performed_at: string;
  local_date: string;
  tz_offset_min: number;
  completed_at: string | null;
  position: 'lying' | 'standing';
  anatomy_at_check: Anatomy;
  bladder_empty: boolean;
  not_after_session: boolean;
  same_position: boolean;
  time_of_day_shifted: boolean;
  sign_method: 'mirror' | 'touch' | 'none';
  sign_result: 'yes' | 'no' | 'unsure' | 'not_done' | null;
  bulge: Ynu | null;
  longest_hold_s: number | null;
  longest_hold_retry_s: number | null;
  repeated_hold_len_s: number | null;
  repeated_holds: number | null;
  quick_flicks: number | null;
  breathing_ok: Ynu | null;
  glutes_belly_relaxed: Ynu | null;
  full_release: Ynu | null;
  pain: Pain3 | null;
  technique_flag: boolean;
  technique_unsure_at_baseline: boolean;
  aborted_at_step: number | null;
  status: 'complete' | 'incomplete';
  item_set_version: number;
  scheduled_check_id: string | null;
}

const SC_BOOLS = ['bladder_empty', 'not_after_session', 'same_position', 'time_of_day_shifted', 'technique_flag', 'technique_unsure_at_baseline'] as const;

export async function insertSelfCheck(db: SqlDb, c: Omit<SelfCheckRow, 'id'>): Promise<string> {
  const id = uuid();
  const row: Record<string, SqlValue> = { id };
  for (const [k, v] of Object.entries(c)) row[k] = typeof v === 'boolean' ? bool(v) : (v as SqlValue);
  await insert(db, 'self_check', row);
  return id;
}

export async function listSelfChecks(db: SqlDb): Promise<SelfCheckRow[]> {
  const rows = await db.all<Record<string, unknown>>('SELECT * FROM self_check ORDER BY performed_at');
  return rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    for (const k of SC_BOOLS) out[k] = fromBool(r[k]);
    return out as unknown as SelfCheckRow;
  });
}

export async function deleteSelfCheck(db: SqlDb, id: string): Promise<void> {
  await db.run('DELETE FROM self_check WHERE id = ?', [id]);
}

export interface ScheduledCheckRow {
  id: string;
  kind: BundleKind | 'periodic_safety' | 'export_backup' | 'milestone_review';
  due_on: string;
  window_open: string;
  window_close: string;
  status: BundleStatus;
  completed_at: string | null;
  completed_ref: string | null;
  parts_done: string[];
}

export async function insertScheduledCheck(db: SqlDb, c: Omit<ScheduledCheckRow, 'id' | 'completed_at' | 'completed_ref' | 'parts_done'>): Promise<string> {
  const id = uuid();
  await insert(db, 'scheduled_check', { id, kind: c.kind, due_on: c.due_on, window_open: c.window_open, window_close: c.window_close, status: c.status, parts_done: '[]' });
  return id;
}

export async function listScheduledChecks(db: SqlDb): Promise<ScheduledCheckRow[]> {
  const rows = await db.all<Record<string, unknown>>('SELECT * FROM scheduled_check ORDER BY due_on');
  return rows.map((r) => ({ ...(r as unknown as ScheduledCheckRow), parts_done: parseJson<string[]>(r.parts_done, []) }));
}

export async function updateScheduledCheck(db: SqlDb, id: string, patch: Partial<Omit<ScheduledCheckRow, 'id'>>): Promise<void> {
  const row: Record<string, SqlValue> = {};
  for (const [k, v] of Object.entries(patch)) row[k] = Array.isArray(v) ? JSON.stringify(v) : (v as SqlValue);
  await update(db, 'scheduled_check', row, 'id = ?', [id]);
}

export interface ResponseRow {
  id: string;
  scheduled_check_id: string | null;
  instrument_key: string;
  instrument_version: number;
  content_hash: string;
  context: 'baseline' | 'monthly' | 'quarterly' | 'ad_hoc';
  started_at: string;
  completed_at: string | null;
  duration_s: number | null;
  status: 'in_progress' | 'complete' | 'incomplete' | 'abandoned';
  total_score: number | null;
  subscale_scores: Record<string, number> | null;
  scoring_version: number;
  flags: string[];
  consistency_note_action: 'kept' | 'reviewed' | null;
}

export interface AnswerRow {
  item_key: string;
  value_num: number | null;
  value_text: string | null;
  skipped: boolean;
}

export async function insertResponse(db: SqlDb, r: Omit<ResponseRow, 'id'>, answers: AnswerRow[]): Promise<string> {
  const id = uuid();
  await db.transaction(async () => {
    await insert(db, 'questionnaire_response', {
      id,
      scheduled_check_id: r.scheduled_check_id,
      instrument_key: r.instrument_key,
      instrument_version: r.instrument_version,
      content_hash: r.content_hash,
      context: r.context,
      started_at: r.started_at,
      completed_at: r.completed_at,
      duration_s: r.duration_s,
      status: r.status,
      total_score: r.total_score,
      subscale_scores: r.subscale_scores ? JSON.stringify(r.subscale_scores) : null,
      scoring_version: r.scoring_version,
      flags: JSON.stringify(r.flags),
      consistency_note_action: r.consistency_note_action,
    });
    const now = nowIso();
    for (const a of answers) {
      await insert(db, 'questionnaire_answer', { response_id: id, item_key: a.item_key, value_num: a.value_num, value_text: a.value_text, skipped: bool(a.skipped), answered_at: now });
    }
  });
  return id;
}

export async function listResponses(db: SqlDb): Promise<ResponseRow[]> {
  const rows = await db.all<Record<string, unknown>>('SELECT * FROM questionnaire_response ORDER BY started_at');
  return rows.map((r) => ({
    ...(r as unknown as ResponseRow),
    subscale_scores: parseJson<Record<string, number> | null>(r.subscale_scores, null),
    flags: parseJson<string[]>(r.flags, []),
  }));
}

export async function answersFor(db: SqlDb, responseId: string): Promise<AnswerRow[]> {
  const rows = await db.all<Record<string, unknown>>('SELECT item_key, value_num, value_text, skipped FROM questionnaire_answer WHERE response_id = ?', [responseId]);
  return rows.map((r) => ({ ...(r as unknown as AnswerRow), skipped: fromBool(r.skipped) }));
}

export async function deleteResponse(db: SqlDb, id: string): Promise<void> {
  await db.run('DELETE FROM questionnaire_response WHERE id = ?', [id]);
}
