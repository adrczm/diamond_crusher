// Web build of the database adapter: sql.js in the browser, saved encrypted to IndexedDB (see ./webSql.ts).
import Constants from 'expo-constants';
import { idb } from '../platform/idb';
import type { SqlDb } from './sql';
import { openWebDb, WrongKeyError, type BlobStore, type SqlJsStatic } from './webSql';

export { WrongKeyError };

export const DB_NAME = 'dc.db';

const PREFIX = 'db:';
const FLAG = 'dc.db.exists:';

/** Marks that a saved database exists, so the start-up check can stay synchronous (files.dbFileExists). */
export function dbExistsFlag(name: string): boolean {
  try {
    return localStorage.getItem(FLAG + name) === '1';
  } catch {
    return false;
  }
}

function setFlag(name: string, on: boolean) {
  try {
    if (on) localStorage.setItem(FLAG + name, '1');
    else localStorage.removeItem(FLAG + name);
  } catch {
    // Private browsing without storage: the app still runs, but nothing is kept.
  }
}

const store: BlobStore = {
  get: (name) => idb.get(PREFIX + name),
  async set(name, value) {
    await idb.set(PREFIX + name, value);
    setFlag(name, true);
  },
  async remove(name) {
    setFlag(name, false);
    await idb.remove(PREFIX + name);
  },
};

function baseUrl(): string {
  const b = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
  return b.endsWith('/') ? b : `${b}/`;
}

let loading: Promise<SqlJsStatic> | null = null;

/** Loads sql.js from the site's own files (public/), never from another server. */
function loadSqlJs(): Promise<SqlJsStatic> {
  if (!loading) {
    loading = new Promise<SqlJsStatic>((resolve, reject) => {
      const w = window as unknown as { initSqlJs?: (o: { locateFile: (f: string) => string }) => Promise<SqlJsStatic> };
      const init = () => w.initSqlJs!({ locateFile: (f) => `${baseUrl()}${f}` }).then(resolve, reject);
      if (w.initSqlJs) return void init();
      const s = document.createElement('script');
      s.src = `${baseUrl()}sql-wasm.js`;
      s.onload = init;
      s.onerror = () => reject(new Error('Could not load the database engine.'));
      document.head.appendChild(s);
    }).catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

export async function openExpoDb(keyHex: string, name = DB_NAME): Promise<SqlDb> {
  await idb.persist();
  return openWebDb(await loadSqlJs(), store, keyHex, name);
}

export async function deleteExpoDb(name = DB_NAME): Promise<void> {
  await store.remove(name);
}

/** Used by files.web.ts to wipe the saved database. */
export const webDbStore = store;
