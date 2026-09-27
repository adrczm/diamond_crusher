import { uuid } from '../ids';
import { bool, insert, nowIso, parseJson, type SqlDb, update } from '../sql';

export async function getMeta(db: SqlDb) {
  return db.get<{ schema_version: number; created_app_version: string; last_export_at: string | null; content_version: number; created_at: string }>(
    'SELECT * FROM meta WHERE id = 1'
  );
}

export async function setLastExport(db: SqlDb, at: string): Promise<void> {
  await update(db, 'meta', { last_export_at: at }, 'id = 1');
}

export type DataOp = 'created' | 'migrated' | 'exported' | 'imported_replace' | 'imported_merge' | 'lock_on' | 'lock_off' | 'restart_after_unreadable';

/** DATA-140: counts and versions only, never health content. */
export async function logDataOp(db: SqlDb, op: DataOp, detail: Record<string, number | string> = {}): Promise<void> {
  await insert(db, 'data_op_log', { id: uuid(), op, at: nowIso(), detail: JSON.stringify(detail) });
}

export async function listDataOps(db: SqlDb) {
  const rows = await db.all<{ op: DataOp; at: string; detail: string }>('SELECT op, at, detail FROM data_op_log ORDER BY at');
  return rows.map((r) => ({ ...r, detail: parseJson<Record<string, unknown>>(r.detail, {}) }));
}

export async function markContentSeen(db: SqlDb, key: string, version = 1, completed = true): Promise<void> {
  const existing = await db.get('SELECT content_key FROM content_view WHERE content_key = ? AND content_version = ?', [key, version]);
  const now = nowIso();
  if (existing) {
    if (completed) await update(db, 'content_view', { completed_at: now }, 'content_key = ? AND content_version = ?', [key, version]);
  } else {
    await insert(db, 'content_view', { content_key: key, content_version: version, first_seen_at: now, completed_at: completed ? now : null });
  }
}

export async function seenContent(db: SqlDb): Promise<Set<string>> {
  const rows = await db.all<{ content_key: string }>('SELECT content_key FROM content_view WHERE completed_at IS NOT NULL');
  return new Set(rows.map((r) => r.content_key));
}

export interface MilestoneRow {
  key: string;
  reached_at: string;
  seen_at: string | null;
  ref: string | null;
}

export async function reachMilestone(db: SqlDb, key: string, ref: string | null = null): Promise<boolean> {
  if (await db.get('SELECT key FROM milestone WHERE key = ?', [key])) return false;
  await insert(db, 'milestone', { key, reached_at: nowIso(), ref });
  return true;
}

export async function listMilestones(db: SqlDb): Promise<MilestoneRow[]> {
  return db.all<MilestoneRow>('SELECT key, reached_at, seen_at, ref FROM milestone ORDER BY reached_at');
}

export async function markMilestoneSeen(db: SqlDb, key: string): Promise<void> {
  await update(db, 'milestone', { seen_at: nowIso() }, 'key = ?', [key]);
}

export interface WeeklySummaryRow {
  week_start: string;
  days_trained: number;
  target_days: number;
  sessions_counted: number;
  sessions_planned: number;
  message_id: string | null;
  pain_reported: boolean;
  progression_note: 'sessions' | 'other' | null;
  viewed_at: string | null;
}

export async function saveWeeklySummary(db: SqlDb, s: Omit<WeeklySummaryRow, 'viewed_at'>): Promise<void> {
  if (await db.get('SELECT week_start FROM weekly_summary WHERE week_start = ?', [s.week_start])) return;
  await insert(db, 'weekly_summary', { ...s, pain_reported: bool(s.pain_reported) });
}

export async function listWeeklySummaries(db: SqlDb): Promise<WeeklySummaryRow[]> {
  const rows = await db.all<Record<string, unknown>>('SELECT * FROM weekly_summary ORDER BY week_start DESC');
  return rows.map((r) => ({ ...(r as unknown as WeeklySummaryRow), pain_reported: r.pain_reported === 1 }));
}

export async function markSummaryViewed(db: SqlDb, weekStart: string): Promise<void> {
  await update(db, 'weekly_summary', { viewed_at: nowIso() }, 'week_start = ?', [weekStart]);
}

export async function logMessage(db: SqlDb, messageId: string, surface: 'progress_header' | 'weekly_summary' | 'check_result'): Promise<void> {
  await insert(db, 'message_event', { id: uuid(), message_id: messageId, shown_at: nowIso(), surface });
}
