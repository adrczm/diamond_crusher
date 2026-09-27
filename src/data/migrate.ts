import { MIGRATIONS, SCHEMA_VERSION } from './migrations';
import { insert, nowIso, type SqlDb } from './sql';

export type MigrateResult = { status: 'ok'; from: number; to: number } | { status: 'newer'; version: number };

export async function userVersion(db: SqlDb): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Runs pending migrations, each in one transaction (DATA-201). A database made by a newer app version is
 * never written to (DATA-203).
 */
export async function migrate(db: SqlDb, appVersion: string, target = SCHEMA_VERSION): Promise<MigrateResult> {
  const from = await userVersion(db);
  if (from > SCHEMA_VERSION) return { status: 'newer', version: from };
  for (const m of MIGRATIONS) {
    if (m.version <= from || m.version > target) continue;
    await db.transaction(async () => {
      await m.up(db);
      await db.exec(`PRAGMA user_version = ${m.version}`);
      const meta = await db.get('SELECT id FROM meta WHERE id = 1');
      if (meta) {
        await db.run('UPDATE meta SET schema_version = ?, last_migrated_at = ?, updated_at = ? WHERE id = 1', [m.version, nowIso(), nowIso()]);
      } else {
        await insert(db, 'meta', { id: 1, schema_version: m.version, created_app_version: appVersion, content_version: 1 });
      }
    });
  }
  return { status: 'ok', from, to: await userVersion(db) };
}
