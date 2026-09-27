// Builds and applies change sets between a paired phone and Mac (07 SYNC-014, SYNC-016, SYNC-031, SYNC-032).
import { PRIMARY_KEYS, TABLES, type TableName } from '../migrations';
import { syncedColumns } from '../migrations/0002_sync';
import type { SqlDb, SqlValue } from '../sql';
import { FIELD_GROUPS, FIELD_TABLES, NATURAL_KEYS, ROW_TABLES } from './policy';

type Row = Record<string, SqlValue>;

export interface ChangeSet {
  v: 1;
  /** Sender's node id. */
  from: string;
  /** Highest clock from the receiver that the sender has applied (the receiver's changes up to here arrived). */
  ack: string;
  rows: Partial<Record<TableName, Row[]>>;
  /** [table, primary key as JSON array, hlc] */
  del: [TableName, string, string][];
  /** [table, field, value, hlc] */
  fields: [TableName, string, SqlValue, string][];
}

export interface SyncPeer {
  peer_node: string;
  peer_kind: 'phone' | 'computer';
  sync_key: string;
  paired_at: string;
  last_sent_hlc: string;
  last_received_hlc: string;
  last_sync_at: string | null;
}

export async function localNode(db: SqlDb): Promise<string> {
  return (await db.get<{ node: string }>('SELECT node FROM sync_clock WHERE id = 1'))!.node;
}

export async function getPeer(db: SqlDb): Promise<SyncPeer | null> {
  return db.get<SyncPeer>('SELECT * FROM sync_peer WHERE id = 1');
}

const columnCache = new Map<string, string[]>();
async function columnsOf(db: SqlDb, table: string): Promise<string[]> {
  let cols = columnCache.get(table);
  if (!cols) {
    cols = (await db.all<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name);
    columnCache.set(table, cols);
  }
  return cols;
}

async function rowColumns(db: SqlDb, table: TableName): Promise<string[]> {
  const all = await columnsOf(db, table);
  const synced = new Set(syncedColumns(table, all));
  // Primary key columns, timestamps and the clock always travel with the row.
  return all.filter((c) => synced.has(c) || PRIMARY_KEYS[table].includes(c) || c === 'hlc' || c === 'created_at' || c === 'updated_at');
}

const ownClock = (node: string) => `substr(hlc, -${node.length}) = '${node}'`;

/** Local changes the peer has not confirmed yet (SYNC-031). `since` = '' sends everything made on this device. */
export async function buildChangeSet(db: SqlDb, since?: string): Promise<ChangeSet> {
  const node = await localNode(db);
  const peer = await getPeer(db);
  const after = since ?? peer?.last_sent_hlc ?? '';
  const out: ChangeSet = { v: 1, from: node, ack: peer?.last_received_hlc ?? '', rows: {}, del: [], fields: [] };
  for (const t of ROW_TABLES) {
    const cols = await rowColumns(db, t);
    const rows = await db.all<Row>(`SELECT ${cols.join(', ')} FROM ${t} WHERE hlc > ? AND ${ownClock(node)} ORDER BY hlc`, [after]);
    if (rows.length) out.rows[t] = rows;
  }
  const tombs = await db.all<{ table_name: TableName; pk: string; hlc: string }>(
    `SELECT table_name, pk, hlc FROM sync_tombstone WHERE hlc > ? AND ${ownClock(node)} ORDER BY hlc`,
    [after]
  );
  out.del = tombs.map((d) => [d.table_name, d.pk, d.hlc]);
  for (const t of FIELD_TABLES) {
    const clocks = await db.all<{ field: string; hlc: string }>('SELECT field, hlc FROM sync_field WHERE table_name = ?', [t]);
    // A single-row table travels whole (it is small) once any of its fields changed here.
    if (!clocks.some((c) => c.hlc > after && c.hlc.endsWith(node))) continue;
    const row = await db.get<Row>(`SELECT * FROM ${t} WHERE id = 1`);
    if (!row) continue;
    for (const c of clocks) if (c.field in row) out.fields.push([t, c.field, row[c.field], c.hlc]);
  }
  return out;
}

export function changeCount(cs: ChangeSet): number {
  return Object.values(cs.rows).reduce((n, r) => n + (r?.length ?? 0), 0) + cs.del.length + (cs.fields.length ? new Set(cs.fields.map((f) => f[0])).size : 0);
}

export function maxClock(cs: ChangeSet): string {
  let m = '';
  for (const rows of Object.values(cs.rows)) for (const r of rows ?? []) if (String(r.hlc) > m) m = String(r.hlc);
  for (const d of cs.del) if (d[2] > m) m = d[2];
  for (const f of cs.fields) if (f[3] > m && f[3].endsWith(cs.from)) m = f[3];
  return m;
}

const wallOf = (hlc: string) => Number(hlc.slice(0, 13)) || 0;

export interface ApplyResult {
  applied: number;
  /** Tables whose fields changed, so derived state can be refreshed. */
  touched: Set<TableName>;
  clockWarning: boolean;
}

/** Applies a received change set in one transaction; applying the same set twice changes nothing (SYNC-016). */
export async function applyChangeSet(db: SqlDb, cs: ChangeSet): Promise<ApplyResult> {
  const res: ApplyResult = { applied: 0, touched: new Set(), clockWarning: false };
  const top = maxClock(cs);
  await db.transaction(async () => {
    await db.run('UPDATE sync_clock SET applying = 1 WHERE id = 1');
    // Deletes first, children before parents.
    const order = [...TABLES].reverse();
    const dels = [...cs.del].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    for (const [t, pkJson, hlc] of dels) {
      if (!ROW_TABLES.includes(t)) continue;
      const pk = PRIMARY_KEYS[t];
      const vals = JSON.parse(pkJson) as SqlValue[];
      const where = pk.map((k) => `${k} = ?`).join(' AND ');
      const local = await db.get<{ hlc: string }>(`SELECT hlc FROM ${t} WHERE ${where}`, vals);
      if (local && local.hlc < hlc) {
        await db.run(`DELETE FROM ${t} WHERE ${where}`, vals);
        res.applied++;
        res.touched.add(t);
      }
      await db.run(
        `INSERT INTO sync_tombstone (table_name, pk, hlc) VALUES (?, ?, ?) ON CONFLICT (table_name, pk) DO UPDATE SET hlc = excluded.hlc WHERE excluded.hlc > sync_tombstone.hlc`,
        [t, pkJson, hlc]
      );
    }
    for (const t of TABLES) {
      const rows = cs.rows[t];
      if (!rows?.length || !ROW_TABLES.includes(t)) continue;
      const cols = await rowColumns(db, t);
      const pk = PRIMARY_KEYS[t];
      const where = pk.map((k) => `${k} = ?`).join(' AND ');
      const natural = NATURAL_KEYS[t];
      for (const r of rows) {
        const hlc = String(r.hlc ?? '');
        const keyVals = pk.map((k) => r[k] ?? null);
        const tomb = await db.get<{ hlc: string }>('SELECT hlc FROM sync_tombstone WHERE table_name = ? AND pk = ?', [t, JSON.stringify(keyVals)]);
        if (tomb && tomb.hlc >= hlc) continue;
        const local = await db.get<{ hlc: string }>(`SELECT hlc FROM ${t} WHERE ${where}`, keyVals);
        const keys = Object.keys(r).filter((k) => cols.includes(k));
        if (local) {
          if (local.hlc >= hlc) continue;
          const set = keys.filter((k) => !pk.includes(k));
          await db.run(`UPDATE ${t} SET ${set.map((c) => `${c} = ?`).join(', ')} WHERE ${where}`, [...set.map((c) => r[c] ?? null), ...keyVals]);
        } else {
          if (natural) {
            const probe = `SELECT ${natural} AS k FROM (SELECT ${keys.map((k) => `? AS ${k}`).join(', ')})`;
            const nk = (await db.get<{ k: SqlValue }>(probe, keys.map((k) => r[k] ?? null)))?.k;
            const clash = await db.get<{ id: string; hlc: string }>(`SELECT id, hlc FROM ${t} WHERE ${natural} = ?`, [nk ?? null]);
            if (clash && clash.hlc >= hlc) continue;
            if (clash) await db.run(`DELETE FROM ${t} WHERE id = ?`, [clash.id]);
          }
          try {
            await db.run(`INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, keys.map((k) => r[k] ?? null));
          } catch {
            // Its parent was deleted on this device (a newer tombstone won): skip the orphan.
            continue;
          }
        }
        res.applied++;
        res.touched.add(t);
      }
    }
    const byTable = new Map<TableName, [string, SqlValue, string][]>();
    for (const [t, f, v, h] of cs.fields) {
      if (!FIELD_TABLES.includes(t)) continue;
      if (!byTable.has(t)) byTable.set(t, []);
      byTable.get(t)!.push([f, v, h]);
    }
    for (const [t, incoming] of byTable) {
      const allowed = new Set(syncedColumns(t, await columnsOf(db, t)));
      const local = new Map((await db.all<{ field: string; hlc: string }>('SELECT field, hlc FROM sync_field WHERE table_name = ?', [t])).map((c) => [c.field, c.hlc]));
      const inc = new Map(incoming.filter(([f]) => allowed.has(f)).map(([f, v, h]) => [f, { v, h }]));
      const groups = FIELD_GROUPS[t] ?? [];
      const grouped = new Set(groups.flat());
      const units: string[][] = [...groups, ...[...inc.keys()].filter((f) => !grouped.has(f)).map((f) => [f])];
      const set: Record<string, SqlValue> = {};
      const clocks: [string, string][] = [];
      for (const unit of units) {
        const fields = unit.filter((f) => inc.has(f));
        if (!fields.length) continue;
        const theirs = fields.reduce((m, f) => (inc.get(f)!.h > m ? inc.get(f)!.h : m), '');
        const mine = unit.reduce((m, f) => ((local.get(f) ?? '') > m ? local.get(f)! : m), '');
        if (theirs <= mine) continue;
        for (const f of fields) {
          set[f] = inc.get(f)!.v;
          clocks.push([f, inc.get(f)!.h]);
        }
      }
      const cols = Object.keys(set);
      if (!cols.length) continue;
      await db.run(`UPDATE ${t} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = 1`, cols.map((c) => set[c]));
      for (const [f, h] of clocks) await db.run('INSERT OR REPLACE INTO sync_field (table_name, field, hlc) VALUES (?, ?, ?)', [t, f, h]);
      res.applied++;
      res.touched.add(t);
    }
    // Receive rule of the hybrid logical clock: local clocks stay ahead of everything seen (SYNC-010).
    const wall = wallOf(top);
    if (wall) {
      await db.run('UPDATE sync_clock SET wall = MAX(wall, ?), counter = counter + 1 WHERE id = 1', [wall]);
      res.clockWarning = wall > Date.now() + 24 * 3600 * 1000;
    }
    const peer = await getPeer(db);
    if (peer) {
      await db.run('UPDATE sync_peer SET last_sent_hlc = MAX(last_sent_hlc, ?), last_received_hlc = MAX(last_received_hlc, ?), last_sync_at = ? WHERE id = 1', [
        cs.ack,
        top,
        new Date().toISOString(),
      ]);
    }
    await db.run('UPDATE sync_clock SET applying = 0 WHERE id = 1');
  });
  return res;
}

/** Local changes not yet confirmed by the peer, for "N changes waiting" (SYNC-045). */
export async function pendingCount(db: SqlDb): Promise<number> {
  const peer = await getPeer(db);
  if (!peer) return 0;
  return changeCount(await buildChangeSet(db));
}
