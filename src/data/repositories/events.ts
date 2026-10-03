// Event log and day notes (06a §4; 07 DATA-090, DATA-091).
import type { Period } from '../../domain/when';
import { uuid } from '../ids';
import { insert, type SqlDb, type SqlValue, update } from '../sql';

export type LeakSituation = 'cough_sneeze' | 'lifting' | 'urge' | 'after_urinating' | 'other';
export type EjacBand = 'lt1' | '1to2' | '2to3' | '3to5' | '5to10' | '10to20' | '20to30' | 'gt30' | 'no_ejaculation' | 'not_sure';

export interface EventRow {
  id: string;
  type: 'leak' | 'sexual_activity';
  occurred_at: string;
  local_date: string;
  tz_offset_min: number;
  entered_at: string;
  leak_situation: LeakSituation | null;
  leak_amount: 'drops' | 'more' | null;
  activity_type: 'penetrative_vaginal' | 'other_partnered' | 'solo' | null;
  hardness: number | null;
  ejac_time_band: EjacBand | null;
  ejac_time_min: number | null;
  control_0_10: number | null;
  bother_0_10: number | null;
  item_set_version: number;
  /** DATA-090 (schema 3): the part of the day picked on the slider; null = the exact time "now" (or an entry from before round 2). */
  occurred_period: Period | null;
}

export async function insertEvent(db: SqlDb, e: Omit<EventRow, 'id' | 'occurred_period'> & { occurred_period?: Period | null }): Promise<string> {
  const id = uuid();
  await insert(db, 'event', { id, ...(e as unknown as Record<string, SqlValue>), occurred_period: e.occurred_period ?? null });
  return id;
}

export async function listEvents(db: SqlDb, type?: EventRow['type']): Promise<EventRow[]> {
  return db.all<EventRow>(`SELECT * FROM event ${type ? 'WHERE type = ?' : ''} ORDER BY occurred_at`, type ? [type] : []);
}

export async function deleteEvent(db: SqlDb, id: string): Promise<void> {
  await db.run('DELETE FROM event WHERE id = ?', [id]);
}

export type ContextKind = 'illness' | 'alcohol' | 'new_medication' | 'tired_stressed' | 'no_sexual_activity_period' | 'other';

export interface ContextFlagRow {
  id: string;
  kind: ContextKind;
  from_date: string;
  to_date: string | null;
  note: string | null;
}

export async function insertContextFlag(db: SqlDb, f: Omit<ContextFlagRow, 'id'>): Promise<string> {
  const id = uuid();
  await insert(db, 'context_flag', { id, ...f });
  return id;
}

export async function listContextFlags(db: SqlDb): Promise<ContextFlagRow[]> {
  return db.all<ContextFlagRow>('SELECT id, kind, from_date, to_date, note FROM context_flag ORDER BY from_date');
}

export async function deleteContextFlag(db: SqlDb, id: string): Promise<void> {
  await db.run('DELETE FROM context_flag WHERE id = ?', [id]);
}

export async function updateContextFlag(db: SqlDb, id: string, patch: Partial<Omit<ContextFlagRow, 'id'>>): Promise<void> {
  await update(db, 'context_flag', patch as Record<string, SqlValue>, 'id = ?', [id]);
}
