// SQLite for the web build (Safari on a Mac): sql.js (SQLite compiled to WebAssembly) in memory, saved after every
// write as one AES-256-GCM encrypted blob in IndexedDB. The database key never leaves secure storage in plain form
// (see src/platform/secureStore.web.ts). This stands in for SQLCipher, which has no browser build (DATA-010).
import type { SqlDb, SqlValue } from './sql';

export class WrongKeyError extends Error {
  constructor() {
    super('The database could not be opened with the stored key.');
  }
}

/** The parts of sql.js this adapter uses. */
export interface SqlJsDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): {
    bind(params: SqlValue[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, SqlValue>;
    free(): boolean;
  };
  getRowsModified(): number;
  export(): Uint8Array;
  close(): void;
}

export interface SqlJsStatic {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
}

export interface BlobStore {
  get(name: string): Promise<{ iv: Uint8Array; data: Uint8Array } | undefined>;
  set(name: string, value: { iv: Uint8Array; data: Uint8Array }): Promise<void>;
  remove(name: string): Promise<void>;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function aesKey(keyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', hexToBytes(keyHex) as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const AAD = new TextEncoder().encode('diamond-crusher-db-v1');

export async function openWebDb(sqljs: SqlJsStatic, store: BlobStore, keyHex: string, name: string): Promise<SqlDb> {
  const key = await aesKey(keyHex);
  const saved = await store.get(name);
  let initial: Uint8Array | undefined;
  if (saved) {
    try {
      initial = new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: saved.iv as BufferSource, additionalData: AAD }, key, saved.data as BufferSource),
      );
    } catch {
      throw new WrongKeyError();
    }
  }
  const db = new sqljs.Database(initial);
  db.exec('PRAGMA foreign_keys = ON');

  let depth = 0;
  let dirty = false;
  let queue: Promise<unknown> = Promise.resolve();
  let saving: Promise<void> = Promise.resolve();

  async function save() {
    if (!dirty || depth > 0) return;
    dirty = false;
    const bytes = db.export();
    // sql.js turns foreign keys off while exporting.
    db.exec('PRAGMA foreign_keys = ON');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, bytes as BufferSource));
    saving = saving.then(() => store.set(name, { iv, data }));
    await saving;
  }

  function rows<T>(sql: string, params: SqlValue[]): T[] {
    const st = db.prepare(sql);
    try {
      if (params.length) st.bind(params);
      const out: T[] = [];
      while (st.step()) out.push(st.getAsObject() as T);
      return out;
    } finally {
      st.free();
    }
  }

  const api: SqlDb = {
    async exec(sql) {
      db.exec(sql);
      dirty = true;
      await save();
    },
    async run(sql, params: SqlValue[] = []) {
      rows(sql, params);
      const changes = db.getRowsModified();
      dirty = true;
      await save();
      return { changes };
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return rows<T>(sql, params);
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      return rows<T>(sql, params)[0] ?? null;
    },
    async transaction<T>(fn: () => Promise<T>) {
      if (depth > 0) {
        const sp = `sp${depth++}`;
        db.exec(`SAVEPOINT ${sp}`);
        try {
          const out = await fn();
          db.exec(`RELEASE ${sp}`);
          return out;
        } catch (err) {
          db.exec(`ROLLBACK TO ${sp}`);
          throw err;
        } finally {
          depth--;
        }
      }
      const run = async () => {
        depth = 1;
        db.exec('BEGIN');
        try {
          const out = await fn();
          db.exec('COMMIT');
          depth = 0;
          dirty = true;
          await save();
          return out;
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        } finally {
          depth = 0;
        }
      };
      const p = queue.then(run, run);
      queue = p.catch(() => undefined);
      return p;
    },
    async close() {
      await save();
      await saving;
      db.close();
    },
  };
  return api;
}
