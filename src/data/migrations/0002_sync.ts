// Schema version 2: sync between a paired phone and Mac (07 §11, SYNC-010 to SYNC-013, SYNC-022).
// Every synced row gets a hybrid logical clock (`hlc`). Triggers stamp it on local writes, write tombstones for
// deletes and keep a clock per field for single-row tables. While a received change set is applied,
// `sync_clock.applying` is 1 and the triggers stay quiet, so received rows keep the sender's clock.
import { DEVICE_COLUMNS, FIELD_TABLES, ROW_TABLES, SKIP_COLUMNS } from '../sync/policy';
import { PRIMARY_KEYS } from './index';
import type { SqlDb } from '../sql';

const NOW_MS = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";
const TICK = `UPDATE sync_clock SET counter = CASE WHEN ${NOW_MS} > wall THEN 0 ELSE counter + 1 END, wall = MAX(wall, ${NOW_MS}) WHERE id = 1;`;
export const HLC_EXPR = "(SELECT printf('%013d-%06x-%s', wall, counter, node) FROM sync_clock WHERE id = 1)";
const QUIET = '(SELECT applying FROM sync_clock WHERE id = 1) = 0';

const SQL = `
CREATE TABLE sync_clock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  node TEXT NOT NULL,
  wall INTEGER NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  applying INTEGER NOT NULL DEFAULT 0
);
INSERT INTO sync_clock (id, node, wall, counter, applying) VALUES (1, lower(hex(randomblob(4))), ${NOW_MS}, 0, 0);

CREATE TABLE sync_tombstone (
  table_name TEXT NOT NULL,
  pk TEXT NOT NULL,
  hlc TEXT NOT NULL,
  PRIMARY KEY (table_name, pk)
);

CREATE TABLE sync_field (
  table_name TEXT NOT NULL,
  field TEXT NOT NULL,
  hlc TEXT NOT NULL,
  PRIMARY KEY (table_name, field)
);

CREATE TABLE sync_peer (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  peer_node TEXT NOT NULL,
  peer_kind TEXT NOT NULL CHECK (peer_kind IN ('phone', 'computer')),
  sync_key TEXT NOT NULL,
  paired_at TEXT NOT NULL,
  last_sent_hlc TEXT NOT NULL DEFAULT '',
  last_received_hlc TEXT NOT NULL DEFAULT '',
  last_sync_at TEXT
);
`;

async function columns(db: SqlDb, table: string): Promise<string[]> {
  return (await db.all<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name);
}

export function syncedColumns(table: string, cols: string[]): string[] {
  const device = DEVICE_COLUMNS[table as keyof typeof DEVICE_COLUMNS] ?? [];
  return cols.filter((c) => !SKIP_COLUMNS.includes(c) && !device.includes(c) && c !== 'id');
}

const changed = (cols: string[]) => cols.map((c) => `NEW.${c} IS NOT OLD.${c}`).join(' OR ');
const backfillHlc = "printf('%013d-%06x-%s', CAST((julianday(COALESCE(updated_at, created_at)) - 2440587.5) * 86400000 AS INTEGER), 0, (SELECT node FROM sync_clock WHERE id = 1))";

/** Clock, update and delete triggers for one row table (SYNC-014). Re-run after its columns change (0003). */
export async function rowTriggers(db: SqlDb, t: string, backfill: boolean): Promise<void> {
  const cols = await columns(db, t);
  const pk = PRIMARY_KEYS[t as keyof typeof PRIMARY_KEYS];
  const watched = cols.filter((c) => !SKIP_COLUMNS.includes(c) && !(DEVICE_COLUMNS[t as keyof typeof DEVICE_COLUMNS] ?? []).includes(c));
  await db.exec(`
${backfill ? `ALTER TABLE ${t} ADD COLUMN hlc TEXT NOT NULL DEFAULT '';
UPDATE ${t} SET hlc = ${backfillHlc};` : ''}
DROP TRIGGER IF EXISTS sync_ai_${t};
DROP TRIGGER IF EXISTS sync_au_${t};
DROP TRIGGER IF EXISTS sync_ad_${t};
DROP INDEX IF EXISTS sync_hlc_${t};
CREATE TRIGGER sync_ai_${t} AFTER INSERT ON ${t} WHEN ${QUIET} BEGIN
  ${TICK}
  UPDATE ${t} SET hlc = ${HLC_EXPR} WHERE rowid = NEW.rowid;
END;
CREATE TRIGGER sync_au_${t} AFTER UPDATE ON ${t} WHEN ${QUIET} AND (${changed(watched)}) BEGIN
  ${TICK}
  UPDATE ${t} SET hlc = ${HLC_EXPR} WHERE rowid = NEW.rowid;
END;
CREATE TRIGGER sync_ad_${t} AFTER DELETE ON ${t} WHEN ${QUIET} BEGIN
  ${TICK}
  INSERT OR REPLACE INTO sync_tombstone (table_name, pk, hlc) VALUES ('${t}', json_array(${pk.map((k) => `OLD.${k}`).join(', ')}), ${HLC_EXPR});
END;
CREATE INDEX sync_hlc_${t} ON ${t}(hlc);
`);
}

/**
 * The per-field clock trigger for one single-row table (SYNC-013). Fields without a clock yet get one from the row's
 * last change, so a new column (0003) starts with a clock like the others.
 */
export async function fieldTriggers(db: SqlDb, t: string): Promise<void> {
  const fields = syncedColumns(t, await columns(db, t));
  await db.exec(`
INSERT OR IGNORE INTO sync_field (table_name, field, hlc)
  SELECT '${t}', f.value, ${backfillHlc} FROM ${t}, json_each('${JSON.stringify(fields)}') AS f WHERE ${t}.id = 1;
DROP TRIGGER IF EXISTS sync_au_${t};
CREATE TRIGGER sync_au_${t} AFTER UPDATE ON ${t} WHEN ${QUIET} AND (${changed(fields)}) BEGIN
  ${TICK}
${fields.map((f) => `  INSERT OR REPLACE INTO sync_field (table_name, field, hlc) SELECT '${t}', '${f}', ${HLC_EXPR} WHERE NEW.${f} IS NOT OLD.${f};`).join('\n')}
END;
`);
}

export async function up(db: SqlDb): Promise<void> {
  await db.exec(SQL);
  for (const t of ROW_TABLES) await rowTriggers(db, t, true);
  for (const t of FIELD_TABLES) await fieldTriggers(db, t);
}
