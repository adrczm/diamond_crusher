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
  /** Session timer picture, synced; null until the person picks one (phone starts on ring, Mac on wave). */
  timer_view: 'ring' | 'wave' | null;
  /** Today top card on this device (never syncs). */
  today_hero: 'path' | 'rings' | null;
  /** Today top card shared between devices, used when today_hero_sync is on. */
  today_hero_shared: 'path' | 'rings' | null;
  today_hero_sync: boolean;
}

const BOOLS: (keyof Settings)[] = [
  'vibration',
  'knack_nudge_enabled',
  'functional_cues_enabled',
  'precise_reminders',
  'reminders_paused',
  'weekly_summary_notification',
  'lock_enabled',
  'today_hero_sync',
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

export type TodayHero = 'path' | 'rings';

/** The Today top card in use: the shared choice when the person syncs it, else this device's (default Path). */
export function todayHero(s: Pick<Settings, 'today_hero' | 'today_hero_shared' | 'today_hero_sync'>): TodayHero {
  return (s.today_hero_sync ? s.today_hero_shared ?? s.today_hero : s.today_hero) ?? 'path';
}

/** Saves the Today top card for this device, and for the other device too when syncing is on. */
export async function setTodayHero(db: SqlDb, s: Pick<Settings, 'today_hero_sync'>, v: TodayHero): Promise<void> {
  await updateSettings(db, s.today_hero_sync ? { today_hero: v, today_hero_shared: v } : { today_hero: v });
}

/** Turns syncing of the Today top card on or off; turning it on shares this device's choice. */
export async function setTodayHeroSync(db: SqlDb, s: Pick<Settings, 'today_hero' | 'today_hero_shared' | 'today_hero_sync'>, on: boolean): Promise<void> {
  await updateSettings(db, on ? { today_hero_sync: true, today_hero_shared: todayHero(s) } : { today_hero_sync: false, today_hero: todayHero(s) });
}

export type TimerView = 'ring' | 'wave';

/** The session timer picture: the synced choice, or the device default (ring on phones, wave on a wide window). */
export function timerView(s: Pick<Settings, 'timer_view'>, wide: boolean): TimerView {
  return s.timer_view ?? (wide ? 'wave' : 'ring');
}
