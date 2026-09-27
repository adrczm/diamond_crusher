import { SCHEMA_VERSION, TABLES } from '../../src/data/migrations';
import { migrate, userVersion } from '../../src/data/migrate';
import { openNodeDb } from '../../src/data/nodeSql';
import { freshDb } from '../helpers/db';

describe('migrations (DATA-200 to DATA-204)', () => {
  it('creates every table at the current schema version', async () => {
    const db = await freshDb();
    expect(await userVersion(db)).toBe(SCHEMA_VERSION);
    for (const t of TABLES) {
      expect(await db.get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [t])).not.toBeNull();
    }
    const meta = await db.get<{ schema_version: number }>('SELECT schema_version FROM meta');
    expect(meta?.schema_version).toBe(SCHEMA_VERSION);
  });

  it('is idempotent on reopen', async () => {
    const db = await freshDb();
    const res = await migrate(db, 'test');
    expect(res).toEqual({ status: 'ok', from: SCHEMA_VERSION, to: SCHEMA_VERSION });
  });

  it('refuses to write to a database made by a newer version (DATA-203)', async () => {
    const db = openNodeDb();
    await db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    expect(await migrate(db, 'test')).toEqual({ status: 'newer', version: SCHEMA_VERSION + 1 });
    expect(await db.get(`SELECT name FROM sqlite_master WHERE name = 'profile'`)).toBeNull();
  });

  it('rolls back a failing migration and leaves the version unchanged (A-DATA-7)', async () => {
    const db = openNodeDb();
    await db.exec('CREATE TABLE profile (x INTEGER)'); // clashes with 0001
    await expect(migrate(db, 'test')).rejects.toThrow();
    expect(await userVersion(db)).toBe(0);
    expect(await db.get(`SELECT name FROM sqlite_master WHERE name = 'meta'`)).toBeNull();
  });

  it('rejects out-of-range values at the database layer (A-DATA-3)', async () => {
    const db = await freshDb();
    await expect(
      db.run(
        `INSERT INTO self_check (id, kind, performed_at, local_date, tz_offset_min, position, anatomy_at_check, bladder_empty, not_after_session, same_position, quick_flicks, status, item_set_version, created_at)
         VALUES ('a', 'monthly', 'x', '2026-01-01', 0, 'lying', 'male', 1, 1, 1, 11, 'complete', 1, 'x')`
      )
    ).rejects.toThrow();
    await expect(
      db.run(
        `INSERT INTO event (id, type, occurred_at, local_date, tz_offset_min, entered_at, hardness, item_set_version, created_at)
         VALUES ('b', 'sexual_activity', 'x', '2026-01-01', 0, 'x', 5, 1, 'x')`
      )
    ).rejects.toThrow();
  });
});
