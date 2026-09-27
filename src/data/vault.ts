// Key, bootstrap metadata, startup routing, lock and delete-all (DATA-011, DATA-022, PRIV-011 to PRIV-014, PRIV-040, PRIV-050).
import { cancelAll } from '../platform/notifications';
import { files } from '../platform/files';
import { randomHex } from '../platform/random';
import { secureStore } from '../platform/secureStore';
import { DB_NAME, deleteExpoDb, openExpoDb, WrongKeyError } from './expoSql';
import { ensureSingletons } from './init';
import { migrate } from './migrate';
import { logDataOp } from './repositories/misc';
import { updateSettings } from './repositories/settings';
import type { SqlDb } from './sql';
import { uuid } from './ids';

const K_BOOT = 'dc.boot';
const K_KEY = 'dc.key';
const K_KEY_AUTH = 'dc.key.auth';
export const UNLOCK_PROMPT = 'Unlock Diamond Crusher';

export interface Bootstrap {
  lock_enabled: boolean;
  lock_timeout_s: number;
  install_id: string;
  key_created_at: string;
}

export async function readBootstrap(): Promise<Bootstrap | null> {
  const raw = await secureStore.get(K_BOOT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Bootstrap;
  } catch {
    return null;
  }
}

async function writeBootstrap(b: Bootstrap) {
  await secureStore.set(K_BOOT, JSON.stringify(b));
}

export type Route =
  | { kind: 'first_run' }
  | { kind: 'locked'; boot: Bootstrap }
  | { kind: 'ready'; db: SqlDb; boot: Bootstrap; firstRun: boolean }
  | { kind: 'unreadable' }
  | { kind: 'newer_version' };

async function openAndMigrate(keyHex: string, appVersion: string, firstRun: boolean): Promise<SqlDb | 'newer'> {
  const db = await openExpoDb(keyHex, DB_NAME);
  const res = await migrate(db, appVersion);
  if (res.status === 'newer') return 'newer';
  await ensureSingletons(db, firstRun);
  return db;
}

/** PRIV-040 routing table. */
export async function startupRoute(appVersion: string): Promise<Route> {
  const boot = await readBootstrap();
  const dbExists = files.dbFileExists(DB_NAME);
  if (!boot && !dbExists) return { kind: 'first_run' };
  if (!boot && dbExists) return { kind: 'unreadable' };
  if (boot && !dbExists) {
    // Orphan key: delete it, then first run.
    await wipeSecrets();
    return { kind: 'first_run' };
  }
  const b = boot as Bootstrap;
  if (b.lock_enabled) return { kind: 'locked', boot: b };
  return openWithKey(b, await secureStore.get(K_KEY).catch(() => null), appVersion);
}

async function openWithKey(boot: Bootstrap, key: string | null, appVersion: string): Promise<Route> {
  if (!key) return { kind: 'unreadable' };
  try {
    const db = await openAndMigrate(key, appVersion, false);
    if (db === 'newer') return { kind: 'newer_version' };
    return { kind: 'ready', db, boot, firstRun: false };
  } catch (e) {
    if (e instanceof WrongKeyError) return { kind: 'unreadable' };
    throw e;
  }
}

/** Reads the auth-bound key (the OS shows the biometric / PIN prompt) and opens the database. */
export async function unlock(boot: Bootstrap, appVersion: string): Promise<Route | 'cancelled'> {
  let key: string | null;
  try {
    key = await secureStore.get(K_KEY_AUTH, { prompt: UNLOCK_PROMPT });
  } catch {
    return 'cancelled';
  }
  return openWithKey(boot, key, appVersion);
}

/** First run: 256-bit random key, new database at the current schema (DATA-011). */
export async function createFresh(appVersion: string): Promise<{ db: SqlDb; boot: Bootstrap }> {
  const key = randomHex(32);
  const boot: Bootstrap = { lock_enabled: false, lock_timeout_s: 60, install_id: uuid(), key_created_at: new Date().toISOString() };
  await secureStore.set(K_KEY, key);
  await writeBootstrap(boot);
  const db = await openAndMigrate(key, appVersion, true);
  if (db === 'newer') throw new Error('unexpected newer schema on a fresh database');
  return { db, boot };
}

/**
 * PRIV-012: turning the lock on or off moves the same key between the plain and the auth-bound entry,
 * after a successful authentication. The database is not re-encrypted.
 */
export async function setLock(db: SqlDb, boot: Bootstrap, enabled: boolean): Promise<Bootstrap> {
  if (enabled === boot.lock_enabled) return boot;
  if (enabled) {
    const key = await secureStore.get(K_KEY);
    if (!key) throw new Error('key missing');
    await secureStore.set(K_KEY_AUTH, key, { prompt: UNLOCK_PROMPT });
    // Confirm the auth-bound copy can be read before removing the plain one.
    const check = await secureStore.get(K_KEY_AUTH, { prompt: UNLOCK_PROMPT });
    if (check !== key) throw new Error('lock could not be verified');
    await secureStore.remove(K_KEY);
  } else {
    const key = await secureStore.get(K_KEY_AUTH, { prompt: UNLOCK_PROMPT });
    if (!key) throw new Error('key missing');
    await secureStore.set(K_KEY, key);
    await secureStore.remove(K_KEY_AUTH);
  }
  const next = { ...boot, lock_enabled: enabled };
  await writeBootstrap(next);
  await updateSettings(db, { lock_enabled: enabled });
  await logDataOp(db, enabled ? 'lock_on' : 'lock_off');
  return next;
}

export async function setLockTimeout(db: SqlDb, boot: Bootstrap, seconds: number): Promise<Bootstrap> {
  const next = { ...boot, lock_timeout_s: seconds };
  await writeBootstrap(next);
  await updateSettings(db, { lock_timeout_s: seconds });
  return next;
}

async function wipeSecrets() {
  for (const k of [K_KEY, K_KEY_AUTH, K_BOOT]) await secureStore.remove(k).catch(() => undefined);
}

/** PRIV-050: cancel notifications, delete the database files and every secure-store entry. */
export async function deleteEverything(db: SqlDb | null): Promise<void> {
  await cancelAll().catch(() => undefined);
  if (db) await db.close().catch(() => undefined);
  await deleteExpoDb(DB_NAME);
  try {
    files.deleteDbFiles(DB_NAME);
  } catch {
    // Nothing left to delete.
  }
  try {
    files.clearTemp();
  } catch {
    // Nothing to clear.
  }
  await wipeSecrets();
}

/** Unreadable data → "Start fresh (erases the unreadable data)". */
export async function startFreshAfterUnreadable(appVersion: string): Promise<{ db: SqlDb; boot: Bootstrap }> {
  await deleteEverything(null);
  const res = await createFresh(appVersion);
  await logDataOp(res.db, 'restart_after_unreadable');
  return res;
}

/** After an import the lock preference comes from the backup's bootstrap (PRIV-030). */
export async function applyImportedBootstrap(db: SqlDb, boot: Bootstrap, imported: { lock_enabled: boolean; lock_timeout_s: number }): Promise<Bootstrap> {
  let next = await setLockTimeout(db, boot, imported.lock_timeout_s);
  await updateSettings(db, { lock_enabled: next.lock_enabled });
  if (imported.lock_enabled && !next.lock_enabled) {
    try {
      next = await setLock(db, next, true);
    } catch {
      // The user can turn the lock on in Settings.
    }
  }
  return next;
}
