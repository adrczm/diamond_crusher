// expo-sqlite adapter with SQLCipher (DATA-010). The key is applied before any other statement.
import * as SQLite from 'expo-sqlite';
import type { SqlDb, SqlValue } from './sql';

export const DB_NAME = 'dc.db';

export class WrongKeyError extends Error {
  constructor() {
    super('The database could not be opened with the stored key.');
  }
}

export async function openExpoDb(keyHex: string, name = DB_NAME): Promise<SqlDb> {
  const db = await SQLite.openDatabaseAsync(name);
  try {
    await db.execAsync(`PRAGMA key = "x'${keyHex}'"`);
    // Fails with "file is not a database" when the key is wrong.
    await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master');
  } catch {
    await db.closeAsync().catch(() => undefined);
    throw new WrongKeyError();
  }
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync('PRAGMA journal_mode = WAL');

  let depth = 0;
  let queue: Promise<unknown> = Promise.resolve();

  const api: SqlDb = {
    async exec(sql) {
      await db.execAsync(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes };
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return (await db.getAllAsync(sql, params)) as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      return ((await db.getFirstAsync(sql, params)) as T | null) ?? null;
    },
    async transaction<T>(fn: () => Promise<T>) {
      if (depth > 0) {
        const name = `sp${depth++}`;
        await db.execAsync(`SAVEPOINT ${name}`);
        try {
          const out = await fn();
          await db.execAsync(`RELEASE ${name}`);
          return out;
        } catch (err) {
          await db.execAsync(`ROLLBACK TO ${name}`);
          throw err;
        } finally {
          depth--;
        }
      }
      // Serialise top-level transactions.
      const run = async () => {
        depth = 1;
        await db.execAsync('BEGIN');
        try {
          const out = await fn();
          await db.execAsync('COMMIT');
          return out;
        } catch (err) {
          await db.execAsync('ROLLBACK');
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
      await db.closeAsync();
    },
  };
  return api;
}

export async function deleteExpoDb(name = DB_NAME): Promise<void> {
  try {
    await SQLite.deleteDatabaseAsync(name);
  } catch {
    // Already gone, or unreadable: the file helpers below remove leftovers.
  }
}
