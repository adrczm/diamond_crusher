// Node adapter over the built-in `node:sqlite` module, used by tests and scripts only (ARCH-081).
import type { SqlDb, SqlValue } from './sql';

type Stmt = { run(...p: SqlValue[]): { changes: number | bigint }; all(...p: SqlValue[]): unknown[]; get(...p: SqlValue[]): unknown };
type NodeDb = { exec(sql: string): void; prepare(sql: string): Stmt; close(): void };

export function openNodeDb(path = ':memory:'): SqlDb {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (p: string) => NodeDb };
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  let depth = 0;
  const api: SqlDb = {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params = []) {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async transaction<T>(fn: () => Promise<T>) {
      const name = `sp${depth++}`;
      db.exec(depth === 1 ? 'BEGIN' : `SAVEPOINT ${name}`);
      try {
        const out = await fn();
        db.exec(depth === 1 ? 'COMMIT' : `RELEASE ${name}`);
        return out;
      } catch (err) {
        db.exec(depth === 1 ? 'ROLLBACK' : `ROLLBACK TO ${name}`);
        throw err;
      } finally {
        depth--;
      }
    },
    async close() {
      db.close();
    },
  };
  return api;
}
