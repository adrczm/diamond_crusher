// Minimal async SQL interface. The app uses expo-sqlite (SQLCipher); tests use Node's built-in sqlite.
export type SqlValue = string | number | null;

export interface SqlDb {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Runs `fn` in one transaction (DATA-162); rolls back if it throws. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function nowIso(d: Date = new Date()): string {
  return d.toISOString();
}

export const bool = (v: boolean | null | undefined): number | null => (v == null ? null : v ? 1 : 0);
export const fromBool = (v: unknown): boolean => v === 1 || v === true;

export function json(v: unknown): string {
  return JSON.stringify(v ?? null);
}

export function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string') return fallback;
  try {
    const out = JSON.parse(v);
    return out == null ? fallback : (out as T);
  } catch {
    return fallback;
  }
}

export async function insert(db: SqlDb, table: string, row: Record<string, SqlValue | undefined>): Promise<void> {
  const now = nowIso();
  const data: Record<string, SqlValue> = {};
  for (const [k, v] of Object.entries(row)) if (v !== undefined) data[k] = v;
  if (!('created_at' in data)) data.created_at = now;
  const cols = Object.keys(data);
  await db.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => data[c]));
}

export async function update(
  db: SqlDb,
  table: string,
  patch: Record<string, SqlValue | undefined>,
  where: string,
  params: SqlValue[] = [],
  touch = true
): Promise<void> {
  const data: Record<string, SqlValue> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) data[k] = v;
  if (touch) data.updated_at = nowIso();
  const cols = Object.keys(data);
  if (!cols.length) return;
  await db.run(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE ${where}`, [...cols.map((c) => data[c]), ...params]);
}
