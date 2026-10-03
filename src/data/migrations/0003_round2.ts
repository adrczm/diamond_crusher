// Schema version 3: design round 2 (decisions of 2026-10-03).
// - Sessions a day has no upper limit (min 1): settings and training_slot lose their 2-3 and 1-3 checks (04 PRG-040).
// - Day notes are free text up to 280 characters (06a EVT-033, 07 DATA-091).
// - Logged events keep the part of the day they were logged for (06a EVT-010, 07 DATA-090).
// - The timer view (synced) and the Today top card (per device, can sync) are settings (03 ENG-070, 08 MOT-033).
// SQLite cannot change a CHECK in place, so the three tables are rebuilt and their sync triggers made again.
import type { SqlDb } from '../sql';
import { fieldTriggers, rowTriggers } from './0002_sync';

/** Rebuilds `table` from its own CREATE statement after `edit`, keeping every row and column. */
async function rebuild(db: SqlDb, table: string, edit: (sql: string) => string): Promise<void> {
  const row = await db.get<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`, [table]);
  if (!row) throw new Error(`no table ${table}`);
  const next = edit(row.sql);
  if (next === row.sql) throw new Error(`rebuild of ${table} changed nothing`);
  const tmp = `${table}__v3`;
  const cols = (await db.all<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name).join(', ');
  await db.exec(`
${next.replace(new RegExp(`^CREATE TABLE "?${table}"?`), `CREATE TABLE ${tmp}`)};
INSERT INTO ${tmp} (${cols}) SELECT ${cols} FROM ${table};
DROP TABLE ${table};
ALTER TABLE ${tmp} RENAME TO ${table};
`);
}

const PERIODS = "'morning', 'noon', 'afternoon', 'evening', 'night'";

export async function up(db: SqlDb): Promise<void> {
  await rebuild(db, 'settings', (sql) =>
    sql.replace(/CHECK \(\(sessions_per_day_target >= 2 AND sessions_per_day_target <= 3\)\)/, 'CHECK (sessions_per_day_target >= 1)')
  );
  await db.exec(`
ALTER TABLE settings ADD COLUMN timer_view TEXT CHECK (timer_view IS NULL OR timer_view IN ('ring', 'wave'));
ALTER TABLE settings ADD COLUMN today_hero TEXT CHECK (today_hero IS NULL OR today_hero IN ('path', 'rings'));
ALTER TABLE settings ADD COLUMN today_hero_shared TEXT CHECK (today_hero_shared IS NULL OR today_hero_shared IN ('path', 'rings'));
ALTER TABLE settings ADD COLUMN today_hero_sync INTEGER NOT NULL DEFAULT 0 CHECK (today_hero_sync IN (0, 1));
`);
  await fieldTriggers(db, 'settings');

  await rebuild(db, 'training_slot', (sql) => sql.replace(/CHECK \(\(slot_no >= 1 AND slot_no <= 3\)\)/, 'CHECK (slot_no >= 1)'));
  await rowTriggers(db, 'training_slot', false);

  await rebuild(db, 'context_flag', (sql) => sql.replace('length(note) <= 60', 'length(note) <= 280'));
  await rowTriggers(db, 'context_flag', false);

  await db.exec(`ALTER TABLE event ADD COLUMN occurred_period TEXT CHECK (occurred_period IS NULL OR occurred_period IN (${PERIODS}));`);
  await rowTriggers(db, 'event', false);
}
