import type { ReminderKind } from '../../domain/reminders';
import type { Position } from '../../domain/types';
import { uuid } from '../ids';
import { bool, fromBool, insert, nowIso, parseJson, type SqlDb, type SqlValue, update } from '../sql';

export interface TrainingSlotRow {
  id: string;
  slot_no: number;
  anchor_key: string | null;
  anchor_custom: string | null;
  default_position: Position | null;
  active: boolean;
}

export async function listSlots(db: SqlDb): Promise<TrainingSlotRow[]> {
  const rows = await db.all<Record<string, unknown>>('SELECT * FROM training_slot ORDER BY slot_no');
  return rows.map((r) => ({ ...(r as unknown as TrainingSlotRow), active: fromBool(r.active) }));
}

export interface ReminderRow {
  id: string;
  kind: ReminderKind;
  slot_no: number | null;
  enabled: boolean;
  time_local: string;
  weekdays: number;
  title: string | null;
  body: string | null;
  os_ids: string[];
  last_scheduled_at: string | null;
}

export async function listReminders(db: SqlDb): Promise<ReminderRow[]> {
  const rows = await db.all<Record<string, unknown>>('SELECT * FROM reminder ORDER BY kind, slot_no');
  return rows.map((r) => ({ ...(r as unknown as ReminderRow), enabled: fromBool(r.enabled), os_ids: parseJson<string[]>(r.os_ids, []) }));
}

export interface SlotPlan {
  slotNo: number;
  anchorKey: string | null;
  anchorCustom: string | null;
  timeLocal: string;
  weekdays: number;
  enabled: boolean;
}

/** One slot of the if-then plan and its session reminder, written by slot number (training_slot.slot_no is unique). */
async function upsertSlot(db: SqlDb, p: SlotPlan, existing: ReminderRow[], slots: TrainingSlotRow[]): Promise<void> {
  const t = slots.find((x) => x.slot_no === p.slotNo);
  if (t) await update(db, 'training_slot', { anchor_key: p.anchorKey, anchor_custom: p.anchorCustom, active: bool(p.enabled) }, 'id = ?', [t.id]);
  else await insert(db, 'training_slot', { id: uuid(), slot_no: p.slotNo, anchor_key: p.anchorKey, anchor_custom: p.anchorCustom, active: bool(p.enabled) });
  const r = existing.find((x) => x.kind === 'session' && x.slot_no === p.slotNo);
  if (r) await update(db, 'reminder', { enabled: bool(p.enabled), time_local: p.timeLocal, weekdays: p.weekdays }, 'id = ?', [r.id]);
  else await insert(db, 'reminder', { id: uuid(), kind: 'session', slot_no: p.slotNo, enabled: bool(p.enabled), time_local: p.timeLocal, weekdays: p.weekdays, os_ids: '[]' });
}

/**
 * Saves the if-then plan and its session reminders (REM-001 to REM-004). Any number of slots (round 2). Slots left out
 * of `plan` are turned off, not deleted, so their time comes back if sessions a day goes up again.
 */
export async function savePlan(db: SqlDb, plan: SlotPlan[]): Promise<void> {
  await db.transaction(async () => {
    const existing = await listReminders(db);
    const slots = await listSlots(db);
    for (const p of plan) await upsertSlot(db, p, existing, slots);
    const keep = new Set(plan.map((p) => p.slotNo));
    for (const r of existing) {
      if (r.kind === 'session' && r.slot_no != null && !keep.has(r.slot_no) && r.enabled) await update(db, 'reminder', { enabled: 0 }, 'id = ?', [r.id]);
    }
    for (const t of slots) if (!keep.has(t.slot_no) && t.active) await update(db, 'training_slot', { active: 0 }, 'id = ?', [t.id]);
  });
}

/** Every session slot, on and off, with its time, days and anchor (the Reminders screen and the keep-in-step rules). */
export async function listPlan(db: SqlDb): Promise<SlotPlan[]> {
  const [slots, reminders] = await Promise.all([listSlots(db), listReminders(db)]);
  const nos = new Set<number>([...slots.map((s) => s.slot_no), ...reminders.filter((r) => r.kind === 'session' && r.slot_no != null).map((r) => r.slot_no as number)]);
  return [...nos]
    .sort((a, b) => a - b)
    .map((no) => {
      const s = slots.find((x) => x.slot_no === no);
      const r = reminders.find((x) => x.kind === 'session' && x.slot_no === no);
      return {
        slotNo: no,
        anchorKey: s?.anchor_key ?? null,
        anchorCustom: s?.anchor_custom ?? null,
        timeLocal: r?.time_local ?? '09:00',
        weekdays: r?.weekdays ?? 127,
        enabled: r?.enabled ?? s?.active ?? false,
      };
    });
}

/**
 * Writes a whole set of session slots, as the keep-in-step rules or their Undo give it. Slots not in `plan` are
 * deleted: only Undo leaves one out (a slot that the change being undone had added).
 */
export async function replacePlan(db: SqlDb, plan: SlotPlan[]): Promise<void> {
  await db.transaction(async () => {
    const existing = await listReminders(db);
    const slots = await listSlots(db);
    for (const p of plan) await upsertSlot(db, p, existing, slots);
    const keep = new Set(plan.map((p) => p.slotNo));
    for (const r of existing) if (r.kind === 'session' && r.slot_no != null && !keep.has(r.slot_no)) await db.run('DELETE FROM reminder WHERE id = ?', [r.id]);
    for (const t of slots) if (!keep.has(t.slot_no)) await db.run('DELETE FROM training_slot WHERE id = ?', [t.id]);
  });
}

export async function ensureReminder(db: SqlDb, kind: ReminderKind, timeLocal = '09:00'): Promise<ReminderRow> {
  const found = (await listReminders(db)).find((r) => r.kind === kind);
  if (found) return found;
  await insert(db, 'reminder', { id: uuid(), kind, slot_no: null, enabled: 1, time_local: timeLocal, weekdays: 127, os_ids: '[]' });
  return (await listReminders(db)).find((r) => r.kind === kind) as ReminderRow;
}

export async function updateReminder(db: SqlDb, id: string, patch: Partial<Omit<ReminderRow, 'id'>>): Promise<void> {
  const row: Record<string, SqlValue> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === 'boolean') row[k] = v ? 1 : 0;
    else if (Array.isArray(v)) row[k] = JSON.stringify(v);
    else row[k] = v as SqlValue;
  }
  await update(db, 'reminder', row, 'id = ?', [id]);
}

export type ReminderActionKind = 'opened' | 'snoozed' | 'done_already' | 'dismissed' | 'test_sent' | 'test_received';

export async function logReminderAction(db: SqlDb, reminderId: string | null, action: ReminderActionKind, scheduledFor: string | null = null): Promise<void> {
  await insert(db, 'reminder_action', { id: uuid(), reminder_id: reminderId, scheduled_for: scheduledFor, action, at: nowIso() });
}

/** DATA-121: actions kept 90 days. */
export async function pruneReminderActions(db: SqlDb, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - 90 * 86400000).toISOString();
  await db.run('DELETE FROM reminder_action WHERE at < ?', [cutoff]);
}
