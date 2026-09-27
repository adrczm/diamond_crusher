import type { AudioMode } from '../../domain/types';
import { fromBool, insert, parseJson, type SqlDb, type SqlValue, update } from '../sql';

export interface Settings {
  sessions_per_day_target: number;
  weekly_days_target: number;
  maintenance_days_target: number | null;
  week_start_day: number;
  audio_mode: AudioMode;
  vibration: boolean;
  theme: 'system' | 'light' | 'dark';
  monthly_check_weekday: number | null;
  export_reminder_days: number;
  knack_nudge_enabled: boolean;
  knack_nudge_time: string | null;
  functional_cues_enabled: boolean;
  precise_reminders: boolean;
  notification_permission: 'granted' | 'denied' | 'undetermined';
  lock_screen_mode: 'private' | 'secret';
  reminders_paused: boolean;
  reminders_paused_until: string | null;
  reminder_backoff_state: 'normal' | 'first_slot_only' | 'stopped';
  last_delivery_test_at: string | null;
  last_delivery_test_result: 'seen' | 'not_seen' | null;
  plan_review_offered_at: string | null;
  weekly_summary_notification: boolean;
  chart_range: 'since_baseline' | '12w' | '12m';
  floor_ceiling_explained: Record<string, boolean>;
  lock_enabled: boolean;
  lock_timeout_s: number;
}

const BOOLS: (keyof Settings)[] = [
  'vibration',
  'knack_nudge_enabled',
  'functional_cues_enabled',
  'precise_reminders',
  'reminders_paused',
  'weekly_summary_notification',
  'lock_enabled',
];

export async function ensureSettings(db: SqlDb): Promise<void> {
  if (!(await db.get('SELECT id FROM settings WHERE id = 1'))) await insert(db, 'settings', { id: 1 });
}

export async function getSettings(db: SqlDb): Promise<Settings> {
  const row = await db.get<Record<string, unknown>>('SELECT * FROM settings WHERE id = 1');
  if (!row) throw new Error('settings missing');
  const out: Record<string, unknown> = { ...row };
  for (const k of BOOLS) out[k] = fromBool(row[k]);
  out.floor_ceiling_explained = parseJson(row.floor_ceiling_explained, {});
  return out as unknown as Settings;
}

export async function updateSettings(db: SqlDb, patch: Partial<Settings>): Promise<void> {
  const row: Record<string, SqlValue> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (typeof v === 'boolean') row[k] = v ? 1 : 0;
    else if (k === 'floor_ceiling_explained') row[k] = JSON.stringify(v);
    else row[k] = v as SqlValue;
  }
  await update(db, 'settings', row, 'id = 1');
}
