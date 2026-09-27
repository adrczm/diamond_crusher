// Export and import of all user data (PRIV-030, PRIV-035 to PRIV-037; DATA-205).
import { PRIMARY_KEYS, SCHEMA_VERSION, SINGLETONS, TABLES, type TableName } from '../migrations';
import type { SqlDb, SqlValue } from '../sql';
import { BackupError } from './container';

export const EXPORT_FORMAT_VERSION = 1;

export interface Payload {
  export_format_version: number;
  schema_version: number;
  app_version: string;
  exported_at: string;
  install_id: string;
  bootstrap: { lock_enabled: boolean; lock_timeout_s: number };
  tables: Partial<Record<TableName, Record<string, SqlValue>[]>>;
}

export async function buildPayload(
  db: SqlDb,
  info: { appVersion: string; installId: string; lockEnabled: boolean; lockTimeoutS: number; now: Date }
): Promise<Payload> {
  const tables: Payload['tables'] = {};
  for (const t of TABLES) tables[t] = await db.all<Record<string, SqlValue>>(`SELECT * FROM ${t}`);
  return {
    export_format_version: EXPORT_FORMAT_VERSION,
    schema_version: SCHEMA_VERSION,
    app_version: info.appVersion,
    exported_at: info.now.toISOString(),
    install_id: info.installId,
    bootstrap: { lock_enabled: info.lockEnabled, lock_timeout_s: info.lockTimeoutS },
    tables,
  };
}

async function columnsOf(db: SqlDb, table: string): Promise<string[]> {
  const rows = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.map((r) => r.name);
}

/** Checks the decrypted JSON against the export shape before anything is written. */
export function validatePayload(obj: unknown): Payload {
  const bad = () => new BackupError('invalid_content', 'The backup could not be read.');
  if (!obj || typeof obj !== 'object') throw bad();
  const p = obj as Partial<Payload>;
  if (p.export_format_version !== EXPORT_FORMAT_VERSION) {
    throw new BackupError('unsupported_version', 'This backup was made by a newer version of the app.');
  }
  if (typeof p.schema_version !== 'number' || p.schema_version < 1) throw bad();
  if (p.schema_version > SCHEMA_VERSION) {
    throw new BackupError('unsupported_version', 'This backup was made by a newer version of the app. Install the newer version first.');
  }
  if (!p.tables || typeof p.tables !== 'object') throw bad();
  for (const [name, rows] of Object.entries(p.tables)) {
    if (!(TABLES as readonly string[]).includes(name)) throw bad();
    if (!Array.isArray(rows)) throw bad();
    for (const r of rows) {
      if (!r || typeof r !== 'object' || Array.isArray(r)) throw bad();
      for (const v of Object.values(r)) {
        if (v !== null && typeof v !== 'string' && typeof v !== 'number') throw bad();
      }
    }
  }
  return upgradePayload(p as Payload);
}

/**
 * DATA-205: older exports are brought up to the current schema before writing. Schema 1 is the only version
 * so far; later migrations add their row transforms here.
 */
export function upgradePayload(p: Payload): Payload {
  return p;
}

export interface Preview {
  from: string | null;
  to: string | null;
  sessions: number;
  selfChecks: number;
  questionnaires: number;
  events: number;
  exportedAt: string;
}

export function preview(p: Payload): Preview {
  const dates = [
    ...(p.tables.session ?? []).map((r) => String(r.local_date)),
    ...(p.tables.self_check ?? []).map((r) => String(r.local_date)),
    ...(p.tables.event ?? []).map((r) => String(r.local_date)),
  ].sort();
  return {
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    sessions: p.tables.session?.length ?? 0,
    selfChecks: p.tables.self_check?.length ?? 0,
    questionnaires: p.tables.questionnaire_response?.length ?? 0,
    events: p.tables.event?.length ?? 0,
    exportedAt: p.exported_at,
  };
}

async function insertRow(db: SqlDb, table: string, row: Record<string, SqlValue>, cols: string[]) {
  const keys = Object.keys(row).filter((k) => cols.includes(k));
  await db.run(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, keys.map((k) => row[k]));
}

/** PRIV-036 Replace: one transaction; on failure nothing changes. */
export async function importReplace(db: SqlDb, p: Payload): Promise<void> {
  await db.transaction(async () => {
    for (const t of [...TABLES].reverse()) await db.run(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      const rows = p.tables[t] ?? [];
      if (!rows.length) continue;
      const cols = await columnsOf(db, t);
      for (const r of rows) await insertRow(db, t, t === 'meta' ? { ...r, schema_version: SCHEMA_VERSION } : r, cols);
    }
  });
}

const stamp = (r: Record<string, SqlValue>) => String(r.updated_at ?? r.created_at ?? '');

/**
 * PRIV-036 Merge: union by primary key; the later `updated_at` (or `created_at`) wins; singleton rows come from
 * the side the user picked.
 */
export async function importMerge(db: SqlDb, p: Payload, singletonsFrom: 'this_phone' | 'backup'): Promise<void> {
  await db.transaction(async () => {
    for (const t of TABLES) {
      const rows = p.tables[t] ?? [];
      if (!rows.length) continue;
      const cols = await columnsOf(db, t);
      const pk = PRIMARY_KEYS[t];
      const singleton = SINGLETONS.includes(t);
      if (singleton && (singletonsFrom === 'this_phone' || t === 'meta')) continue;
      for (const r of rows) {
        const where = pk.map((k) => `${k} = ?`).join(' AND ');
        const keyVals = pk.map((k) => r[k]);
        const existing = await db.get<Record<string, SqlValue>>(`SELECT * FROM ${t} WHERE ${where}`, keyVals);
        if (!existing) {
          await insertRow(db, t, r, cols);
          continue;
        }
        if (singleton || stamp(r) > stamp(existing)) {
          const setCols = Object.keys(r).filter((k) => cols.includes(k) && !pk.includes(k));
          if (setCols.length) {
            await db.run(`UPDATE ${t} SET ${setCols.map((c) => `${c} = ?`).join(', ')} WHERE ${where}`, [...setCols.map((c) => r[c]), ...keyVals]);
          }
        }
      }
    }
  });
}

/** For tests (A-PRIV-6): row counts per table. */
export async function tableCounts(db: SqlDb): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of TABLES) out[t] = (await db.get<{ n: number }>(`SELECT count(*) AS n FROM ${t}`))?.n ?? 0;
  return out;
}
